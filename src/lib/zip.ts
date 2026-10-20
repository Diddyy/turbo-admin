/**
 * Reads the files of a ZIP archive as the client's `.nitro` bundles are kept: the central
 * directory once, each file only when it is asked for (stored, or deflated and inflated by the
 * browser's own `DecompressionStream`).
 */
export interface ZipArchive {
    names: string[];
    read: (name: string) => Promise<Uint8Array | null>;
}

const END_OF_DIRECTORY = 0x06054b50;
const DIRECTORY_ENTRY = 0x02014b50;
const STORED = 0;
const DEFLATED = 8;

interface Entry {
    method: number;
    size: number;
    offset: number;
}

const inflate = async (data: Uint8Array) => {
    const stream = new Blob([ data as BlobPart ]).stream().pipeThrough(new DecompressionStream('deflate-raw'));

    return new Uint8Array(await new Response(stream).arrayBuffer());
};

/** The archive's directory; throws on anything that is not a ZIP. */
export const openZip = (buffer: ArrayBuffer): ZipArchive => {
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);
    const decoder = new TextDecoder();
    let end = -1;

    // The end record sits in the last 64 KiB and 22 bytes (its comment may be up to 64 KiB long).
    for (let at = buffer.byteLength - 22; at >= Math.max(0, buffer.byteLength - 65557); at--) {
        if (view.getUint32(at, true) === END_OF_DIRECTORY) {
            end = at;
            break;
        }
    }

    if (end < 0)
        throw new Error('Not a ZIP archive.');

    const count = view.getUint16(end + 10, true);
    const entries = new Map<string, Entry>();
    let at = view.getUint32(end + 16, true);

    for (let index = 0; index < count; index++) {
        if (view.getUint32(at, true) !== DIRECTORY_ENTRY)
            throw new Error('The ZIP archive\'s directory is broken.');

        const nameLength = view.getUint16(at + 28, true);
        const extraLength = view.getUint16(at + 30, true);
        const commentLength = view.getUint16(at + 32, true);

        entries.set(decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength)), {
            method: view.getUint16(at + 10, true),
            size: view.getUint32(at + 20, true),
            offset: view.getUint32(at + 42, true),
        });
        at += 46 + nameLength + extraLength + commentLength;
    }

    return {
        names: [ ...entries.keys() ],
        read: async (name) => {
            const entry = entries.get(name);

            if (!entry)
                return null;

            // The local header's own name and extra lengths, which may differ from the directory's.
            const start = entry.offset + 30 + view.getUint16(entry.offset + 26, true) + view.getUint16(entry.offset + 28, true);
            const data = bytes.subarray(start, start + entry.size);

            if (entry.method === STORED)
                return data;

            return entry.method === DEFLATED ? inflate(data) : null;
        },
    };
};

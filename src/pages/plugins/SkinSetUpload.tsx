import { Check, FolderOpen, Upload, X } from 'lucide-react';
import { type DragEvent, useMemo, useState } from 'react';

import { uploadPluginImage, useOverlaysChange } from '#/api/noCode';
import type { SkinMap } from '#/api/windows';
import { useSaved } from '#/components/SaveFeedback';
import { toastError } from '#/components/toast';
import { Badge, Button, Panel, Select } from '#/components/ui';
import { openZip } from '#/lib/zip';
import { DesignPreview } from '#/preview/DesignPreview';
import { dataUrlOf } from '#/preview/images';

const IMAGE_FILE = /\.(png|gif|jpe?g|webp)$/i;

/** The images uploaded at once while applying: the server takes them one by one. */
const UPLOADS_AT_ONCE = 4;

const MIME: Record<string, string> = { png: 'image/png', gif: 'image/gif', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };

/** A sprite a file can stand in for: its sheet name, the `asset.overlays` key that replaces it, its size and the skins drawing it. */
interface SpriteTarget {
    sprite: string;
    overlay: string;
    width?: number;
    height?: number;
    slice?: { left: number; top: number; right: number; bottom: number };
    skins: string[];
}

/** A file of the set, read: its image, its size, and the sprite its name matches (if one). */
interface SetFile {
    name: string;
    file: File;
    url: string;
    width: number;
    height: number;
    target?: SpriteTarget;
    /** Why it is not used: matched nothing, or named two sprites. */
    problem?: string;
}

const stem = (name: string) => (name.split('/').pop() ?? name).replace(/\.[a-z0-9]+$/i, '').toLowerCase();

/** `frame:3` + `states.hovering` as a file names them: `frame-3-states-hovering`. */
const part = (...names: string[]) => names.join('-').replaceAll(/[:.]/g, '-').toLowerCase();

/**
 * Every name a file may have to stand in for a sprite: the sprite's own (`theme-habbo-frame-3-frame-3-default`,
 * or without `theme-`), the skin and part (`frame-3-plain`, `button-0-states-hovering`), the skin and the
 * part's last word where the skin has one such (`button-0-hovering`), and the skin alone for a skin of one
 * sprite (`border-9`). A name two different sprites take is no match: the file says which by a longer name.
 */
const spriteNames = (skins: SkinMap) => {
    const names = new Map<string, SpriteTarget | null>();
    const targets = new Map<string, SpriteTarget>();
    const add = (name: string, target: SpriteTarget) => {
        const had = names.get(name);

        if (had === undefined) names.set(name, target);
        else if (had && had.overlay !== target.overlay) names.set(name, null);
    };

    for (const [ id, skin ] of Object.entries(skins.skins)) {
        const sprites = new Map(skin.sprites.map(sprite => [ sprite.overlay, sprite ]));
        const lastWords = new Map<string, number>();

        for (const sprite of skin.sprites) lastWords.set(sprite.part.split('.').pop()!, (lastWords.get(sprite.part.split('.').pop()!) ?? 0) + 1);

        for (const sprite of skin.sprites) {
            let target = targets.get(sprite.overlay);

            if (!target) {
                const size = skins.sprites[sprite.sprite];

                target = { sprite: sprite.sprite, overlay: sprite.overlay, width: size?.width ?? sprite.width, height: size?.height ?? sprite.height, slice: sprite.slice, skins: [] };
                targets.set(sprite.overlay, target);
            }

            if (!target.skins.includes(id)) target.skins.push(id);

            add(sprite.sprite.toLowerCase(), target);
            add(sprite.sprite.toLowerCase().replace(/^theme-/, ''), target);
            add(part(id, sprite.part), target);

            const last = sprite.part.split('.').pop()!;

            if (lastWords.get(last) === 1) add(part(id, last), target);
            if (sprites.size === 1) add(part(id), target);
        }
    }

    return names;
};

/** The files dropped or picked, a zip's images among them, each read for its size. */
const readFiles = async (files: readonly File[]): Promise<{ name: string; file: File }[]> => {
    const found: { name: string; file: File }[] = [];

    for (const file of files) {
        if (/\.zip$/i.test(file.name)) {
            const zip = openZip(await file.arrayBuffer());

            for (const name of zip.names.filter(entry => IMAGE_FILE.test(entry) && !entry.split('/').some(segment => segment.startsWith('.') || segment === '__MACOSX'))) {
                const bytes = await zip.read(name);
                const type = MIME[name.split('.').pop()!.toLowerCase()];

                if (bytes) found.push({ name, file: new File([ bytes as BlobPart ], name.split('/').pop()!, { type }) });
            }
        } else if (IMAGE_FILE.test(file.name)) {
            found.push({ name: file.webkitRelativePath || file.name, file });
        }
    }

    return found;
};

const sizeOf = async (file: File) => {
    const bitmap = await createImageBitmap(file);
    const size = { width: bitmap.width, height: bitmap.height };

    bitmap.close();

    return size;
};

/** Whether a file is not the size of the sprite it replaces: a nine-slice of another size cuts its corners wrongly. */
const mismatch = (file: SetFile) => !!file.target?.width && ((file.width !== file.target.width) || (file.height !== file.target.height));

/** A file's directory entries, a dropped folder read whole. */
const entryFiles = async (entry: FileSystemEntry): Promise<File[]> => {
    if (entry.isFile) return [ await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject)) ];

    const reader = (entry as FileSystemDirectoryEntry).createReader();
    const all: File[] = [];

    for (;;) {
        const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));

        if (!batch.length) return all;

        for (const child of batch) all.push(...await entryFiles(child));
    }
};

/**
 * Upload a skin set: many sprites' replacements at once - files, a folder or a zip - each matched to
 * a sprite by its name (`spriteNames`), reviewed in a table (matched, unmatched, a size that is not the
 * sprite's) and drawn in the window's own preview before anything is saved. Apply uploads the matched
 * files into the target plugin's images and writes every overlay in one change.
 */
export const SkinSetUpload = ({ skins, target, canManage }: { skins: SkinMap; target: string; canManage: boolean }) => {
    const names = useMemo(() => spriteNames(skins), [ skins ]);
    const [ files, setFiles ] = useState<SetFile[]>([]);
    const [ reading, setReading ] = useState(false);
    const [ applying, setApplying ] = useState<string | null>(null);
    const [ dropping, setDropping ] = useState(false);
    const [ shownWindow, setShownWindow ] = useState<string | null>(null);
    const overlays = useOverlaysChange(target);
    const saved = useSaved();

    // The last file for a sprite wins: an earlier one for it is said to be left out.
    const used = useMemo(() => {
        const bySprite = new Map<string, SetFile>();

        for (const file of files) if (file.target) bySprite.set(file.target.overlay, file);

        return bySprite;
    }, [ files ]);
    const matched = useMemo(() => [ ...used.values() ], [ used ]);
    const windows = useMemo(() => {
        const count = new Map<string, number>();

        for (const file of matched) for (const skin of file.target!.skins) for (const win of Object.keys(skins.skins[skin]?.windows ?? {})) count.set(win, (count.get(win) ?? 0) + 1);

        return [ ...count ].sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0])).map(([ win ]) => win);
    }, [ matched, skins ]);
    const previewed = (shownWindow && windows.includes(shownWindow)) ? shownWindow : windows[0] ?? null;
    const draft = useMemo(() => ({ variables: matched.map(file => ({ path: [ 'asset.overlays', file.target!.overlay ], value: file.url })) }), [ matched ]);

    const take = async (picked: readonly File[]) => {
        setReading(true);

        try {
            const read = await Promise.all((await readFiles(picked)).map(async ({ name, file }): Promise<SetFile> => {
                const target = names.get(stem(name));
                const [ size, url ] = await Promise.all([ sizeOf(file).catch(() => ({ width: 0, height: 0 })), dataUrlOf(file) ]);

                return {
                    name,
                    file,
                    url,
                    ...size,
                    ...(target ? { target } : { problem: target === null ? 'names more than one sprite: use the sprite\'s own name' : 'matches no sprite' }),
                };
            }));

            setFiles(read.sort((a, b) => a.name.localeCompare(b.name)));
        } catch (error) {
            toastError(error);
        } finally {
            setReading(false);
        }
    };

    const onDrop = async (event: DragEvent) => {
        event.preventDefault();
        setDropping(false);

        const entries = [ ...event.dataTransfer.items ].map(item => item.webkitGetAsEntry()).filter((entry): entry is FileSystemEntry => !!entry);

        void take(entries.length ? (await Promise.all(entries.map(entryFiles))).flat() : [ ...event.dataTransfer.files ]);
    };

    const apply = async () => {
        const set: Record<string, string> = {};
        const queue = [ ...matched ];
        let done = 0;

        try {
            setApplying(`Uploading 0 of ${queue.length}...`);

            await Promise.all(Array.from({ length: UPLOADS_AT_ONCE }, async () => {
                for (let file = queue.shift(); file; file = queue.shift()) {
                    const extension = /\.[a-z0-9]+$/i.exec(file.file.name)?.[0].toLowerCase() ?? '.png';
                    const image = await uploadPluginImage(target, file.file, `${file.target!.overlay.split('/').pop()}${extension}`);

                    set[file.target!.overlay] = image.url ?? `/gamedata/plugins/${target}/${image.path}`;
                    setApplying(`Uploading ${++done} of ${matched.length}...`);
                }
            }));

            setApplying('Saving...');
            await overlays.mutateAsync(set);
            saved(`${matched.length} sprite(s) replaced in one change (${target})`);
            setFiles([]);
        } catch (error) {
            toastError(error);
        } finally {
            setApplying(null);
        }
    };

    const unmatched = files.filter(file => !file.target);
    const left = files.filter(file => file.target && used.get(file.target.overlay) !== file);
    const wrongSize = matched.filter(mismatch);

    return (
        <Panel
            title="Upload a skin set"
            description="Many sprites at once: files, a folder or a zip. Each file is matched to a sprite by its name - the sprite's own (theme-habbo-frame-3-frame-3-default.png), or the skin and part (frame-3-plain.png, button-0-hovering.png, border-9.png) - and shown in the window before anything is saved."
        >
            <div className="flex flex-col gap-3 p-4">
                {canManage && (
                    <div
                        className={`flex flex-wrap items-center gap-3 rounded-lg border border-dashed p-4 text-sm ${dropping ? 'border-accent bg-subtle' : 'border-line'}`}
                        onDragOver={(event) => {
                            event.preventDefault();
                            setDropping(true);
                        }}
                        onDragLeave={() => setDropping(false)}
                        onDrop={event => void onDrop(event)}
                    >
                        <span className="text-muted">{reading ? 'Reading the files...' : 'Drop the files, a folder or a zip here, or'}</span>
                        <label className="inline-flex cursor-pointer items-center gap-1 text-accent hover:underline">
                            <Upload className="size-4" />
                            choose files
                            <input
                                type="file"
                                multiple
                                accept="image/png,image/gif,image/jpeg,image/webp,.zip,application/zip"
                                aria-label="Choose the skin set's files"
                                className="sr-only"
                                onChange={(event) => {
                                    const picked = [ ...(event.target.files ?? []) ];

                                    event.target.value = '';
                                    void take(picked);
                                }}
                            />
                        </label>
                        <label className="inline-flex cursor-pointer items-center gap-1 text-accent hover:underline">
                            <FolderOpen className="size-4" />
                            choose a folder
                            <input
                                type="file"
                                multiple
                                aria-label="Choose the skin set's folder"
                                className="sr-only"
                                // A folder's files, sub-folders too (every browser has it, React has no prop for it).
                                ref={input => input?.setAttribute('webkitdirectory', '')}
                                onChange={(event) => {
                                    const picked = [ ...(event.target.files ?? []) ];

                                    event.target.value = '';
                                    void take(picked);
                                }}
                            />
                        </label>
                        {target !== 'hotel' && <span className="text-xs text-muted">{`Into ${target}'s images.`}</span>}
                    </div>
                )}
                {files.length > 0 && (
                    <>
                        <p className="flex flex-wrap items-center gap-2 text-sm" aria-label="Skin set review">
                            <Badge tone="green">{`${matched.length} matched`}</Badge>
                            {unmatched.length > 0 && <Badge tone="red">{`${unmatched.length} unmatched`}</Badge>}
                            {wrongSize.length > 0 && <Badge tone="amber">{`${wrongSize.length} not the sprite's size`}</Badge>}
                            {left.length > 0 && <Badge>{`${left.length} left out (another file for the same sprite)`}</Badge>}
                            <span className="ml-auto flex gap-2">
                                <Button variant="ghost" icon={<X />} disabled={!!applying} onClick={() => setFiles([])}>Clear</Button>
                                <Button icon={<Check />} disabled={!canManage || !!applying || matched.length === 0} onClick={() => void apply()}>
                                    {applying ?? `Apply ${matched.length} sprite(s)`}
                                </Button>
                            </span>
                        </p>
                        <div className="max-h-[40vh] overflow-auto rounded-lg border border-line">
                            <table className="w-full text-left text-[13px]">
                                <thead className="sticky top-0 bg-surface text-xs text-muted">
                                    <tr><th className="p-2">File</th><th className="p-2">Sprite</th><th className="p-2">Size</th><th className="p-2">Skins</th></tr>
                                </thead>
                                <tbody className="divide-y divide-line">
                                    {files.map(file => (
                                        <tr key={file.name} data-match={file.target ? (used.get(file.target.overlay) === file ? 'matched' : 'left') : 'unmatched'}>
                                            <td className="p-2">
                                                <span className="flex items-center gap-2">
                                                    <img src={file.url} alt="" className="max-h-8 max-w-16 border border-line bg-subtle object-contain [image-rendering:pixelated]" />
                                                    <span className="font-mono text-xs">{file.name}</span>
                                                </span>
                                            </td>
                                            <td className="p-2">
                                                {file.target
                                                    ? <span className="font-mono text-xs">{file.target.sprite}{used.get(file.target.overlay) !== file && <span className="ml-2 text-muted">(left out)</span>}</span>
                                                    : <span className="text-xs text-bad">{file.problem}</span>}
                                            </td>
                                            <td className="p-2 text-xs">
                                                {`${file.width}x${file.height}`}
                                                {mismatch(file) && <span className="ml-2 text-warn">{`sprite ${file.target!.width}x${file.target!.height}${file.target!.slice ? `, nine-slice ${file.target!.slice.left} ${file.target!.slice.top} ${file.target!.slice.right} ${file.target!.slice.bottom}` : ''}`}</span>}
                                            </td>
                                            <td className="p-2 font-mono text-xs text-muted">{file.target?.skins.slice(0, 4).join(' ') ?? ''}{(file.target?.skins.length ?? 0) > 4 ? ` +${file.target!.skins.length - 4}` : ''}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {previewed && (
                            <div className="flex flex-col gap-2">
                                <label className="flex items-center gap-2 text-xs text-muted">
                                    Shown in
                                    <Select aria-label="Window the skin set is shown in" value={previewed} onChange={event => setShownWindow(event.target.value)} className="w-auto">
                                        {windows.slice(0, 100).map(win => <option key={win} value={win}>{win}</option>)}
                                    </Select>
                                </label>
                                <DesignPreview template={previewed} draft={draft} />
                            </div>
                        )}
                    </>
                )}
            </div>
        </Panel>
    );
};

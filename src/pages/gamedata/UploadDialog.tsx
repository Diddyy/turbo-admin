import { AlertTriangle, CheckCircle2, FileUp, Loader2 } from 'lucide-react';
import { type DragEvent, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import { type AssetUpload, BUNDLE_KINDS, type BundleKind, GAMEDATA_FILE_NAMES, type GamedataFileKind, useUploadFile } from '#/api/bundles';
import { Modal } from '#/components/Modal';
import { Button, ErrorNotice } from '#/components/ui';
import { cx } from '#/lib/cx';
import { BundleDetail } from '#/pages/assets/BundleDetail';
import { formatBytes } from '#/pages/assets/format';

import { configJson, useConfigHandoff } from './configHandoff';

interface Entry {
    id: number;
    file: File;
    state: 'waiting' | 'uploading' | 'done' | 'failed';
    result?: AssetUpload;
    error?: unknown;
}

/** Why a gamedata file is not taken from an upload, and where its content comes from instead. */
const NOT_TAKEN: Record<GamedataFileKind, string> = {
    furnidata: 'The hotel builds its furniture data from its definitions: Habbo\'s comes in from Habbo updates, and a definition is changed in the library.',
    productdata: 'The hotel builds its product data from the database: Habbo\'s comes in from Habbo updates, and a product is changed under Texts & variables.',
    figuredata: 'The hotel builds its figure data from the database: Habbo\'s comes in from Habbo updates, and clothing is changed in the library.',
    texts: 'The hotel builds its texts from the database: Habbo\'s come in from Habbo updates, and a text is changed under Texts & variables.',
    figuremap: 'The hotel reads Habbo\'s figure map when it syncs the clothing bundles; upload the clothing libraries themselves.',
    effectmap: 'The hotel reads Habbo\'s effect map when it syncs the effect bundles; upload the effect libraries themselves.',
    variables: 'A client config is looked at before anything changes: review it in the variables\' import.',
};

const kindName = (kind: BundleKind) => BUNDLE_KINDS.find(x => x.value === kind)!.one;

const Outcome = ({ entry, onOpen, onReview }: { entry: Entry; onOpen: (bundle: { kind: BundleKind; name: string }) => void; onReview: (file: File) => void }) => {
    const result = entry.result;

    if (entry.state === 'waiting')
        return <span className="text-xs text-muted">Waiting</span>;

    if (entry.state === 'uploading')
        return <span className="inline-flex items-center gap-1.5 text-xs text-muted"><Loader2 className="size-3.5 animate-spin" /> Reading what it is</span>;

    if (entry.state === 'failed')
        return <div className="text-xs"><ErrorNotice error={entry.error} /></div>;

    if (result?.type === 'bundle')
        return (
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                <span className="inline-flex items-center gap-1.5 text-good"><CheckCircle2 className="size-3.5" /> {`Kept as the ${kindName(result.bundle.kind)} bundle`}</span>
                <span className="font-mono">{result.bundle.name}</span>
                {!result.bundle.used && <span className="text-warn">nothing in the hotel uses it yet</span>}
                <button type="button" onClick={() => onOpen(result.bundle)} className="font-medium text-accent hover:underline">Open</button>
            </span>
        );

    if (result?.type === 'gamedata')
        return (
            <span className="flex flex-col gap-1 text-xs">
                <span className="inline-flex items-center gap-1.5 text-warn"><AlertTriangle className="size-3.5" /> {`This is ${GAMEDATA_FILE_NAMES[result.gamedata]}: recognised, not taken.`}</span>
                <span className="text-muted">{NOT_TAKEN[result.gamedata]}</span>
                {result.gamedata === 'variables' && (
                    <button type="button" onClick={() => onReview(entry.file)} className="self-start font-medium text-accent hover:underline">Review the import</button>
                )}
            </span>
        );

    return (
        <span className="flex flex-col gap-1 text-xs">
            <span className="inline-flex items-center gap-1.5 text-warn"><AlertTriangle className="size-3.5" /> Unknown: it can't be told what this is.</span>
            {result?.type === 'unknown' && <span className="text-muted">{result.message}</span>}
        </span>
    );
};

/**
 * The one upload for gamedata and assets: drop any files, and each is read for what it is. A
 * Flash library (.swf, .hab) or a .nitro is kept as the bundle its content says - furniture, a
 * pet, an effect or clothing - and a gamedata file is recognised and pointed to where its content
 * is changed. A file that says what it is no way is a warning, not a guess. `name` keeps the one
 * file under that bundle name instead of its file's, to replace a definition's bundle.
 */
export const UploadDialog = ({ open, onClose, name }: { open: boolean; onClose: () => void; name?: string }) => {
    const [ entries, setEntries ] = useState<Entry[]>([]);
    const [ over, setOver ] = useState(false);
    const [ opened, setOpened ] = useState<{ kind: BundleKind; name: string } | null>(null);
    const upload = useUploadFile();
    const next = useRef(1);
    const queue = useRef<Promise<void>>(Promise.resolve());
    const navigate = useNavigate();
    const giveConfig = useConfigHandoff(state => state.give);

    const set = (id: number, change: Partial<Entry>) => setEntries(current => current.map(x => (x.id === id ? { ...x, ...change } : x)));

    const run = async (entry: Entry) => {
        set(entry.id, { state: 'uploading' });

        try {
            set(entry.id, { state: 'done', result: await upload.mutateAsync({ file: entry.file, name }) });
        } catch (error) {
            set(entry.id, { state: 'failed', error });
        }
    };

    // One at a time, in the order they were dropped: a large library converts on the server.
    const add = (files: FileList | null) => {
        if (!files?.length)
            return;

        const fresh = (name ? [ files[0]! ] : Array.from(files)).map(file => ({ id: next.current++, file, state: 'waiting' as const }));

        setEntries(current => [ ...current, ...fresh ]);

        for (const entry of fresh)
            queue.current = queue.current.then(() => run(entry));
    };

    const close = () => {
        if (entries.some(x => x.state === 'uploading'))
            return;

        setEntries([]);
        onClose();
    };

    const review = (file: File) => {
        void file.text().then((text) => {
            giveConfig(configJson(text));
            setEntries([]);
            onClose();
            void navigate('/gamedata/texts?tab=variables');
        });
    };

    const drop = (event: DragEvent) => {
        event.preventDefault();
        setOver(false);
        add(event.dataTransfer.files);
    };

    const running = entries.some(x => x.state === 'waiting' || x.state === 'uploading');

    return (
        <>
            <Modal open={open} onClose={close} title={name ? `Replace the bundle ${name}` : 'Upload'} className="sm:h-fit! sm:max-w-2xl">
                <div className="flex flex-col gap-4 p-4 sm:p-5">
                    <label
                        onDragOver={(event) => {
                            event.preventDefault();
                            setOver(true);
                        }}
                        onDragLeave={() => setOver(false)}
                        onDrop={drop}
                        className={cx(
                            'flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors focus-within:border-accent',
                            over ? 'border-accent bg-accent-soft' : 'border-line bg-canvas hover:border-accent',
                        )}
                    >
                        <FileUp className="size-7 text-muted" aria-hidden />
                        <span className="text-sm font-medium">{name ? 'Drop the new library here, or choose it' : 'Drop files here, or choose them'}</span>
                        <span className="max-w-md text-xs text-muted">
                            {name
                                ? 'A .swf, .hab or .nitro. Its kind is read from what it holds; it is kept under this name.'
                                : 'Bundles (.swf, .hab, .nitro) are kept as the furniture, pet, effect or clothing they turn out to be. Gamedata files are recognised and shown where they belong.'}
                        </span>
                        <input
                            type="file"
                            multiple={!name}
                            className="sr-only"
                            onChange={(event) => {
                                add(event.target.files);
                                event.target.value = '';
                            }}
                        />
                    </label>

                    {entries.length > 0 && (
                        <ul className="divide-y divide-line rounded-xl border border-line">
                            {entries.map(entry => (
                                <li key={entry.id} className="flex flex-col gap-1.5 px-3 py-2.5">
                                    <div className="flex items-baseline justify-between gap-3">
                                        <span className="min-w-0 truncate font-mono text-[13px]" title={entry.file.name}>{entry.file.name}</span>
                                        <span className="shrink-0 font-mono text-[11px] text-muted tabular-nums">{formatBytes(entry.file.size)}</span>
                                    </div>
                                    <Outcome entry={entry} onOpen={setOpened} onReview={review} />
                                </li>
                            ))}
                        </ul>
                    )}

                    <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-muted">
                            {entries.length > 0 && `${entries.filter(x => x.state === 'done' && x.result?.type === 'bundle').length} of ${entries.length} kept`}
                            {entries.some(x => x.result?.type === 'unknown') && <span className="ml-2 inline-flex items-center gap-1 text-warn"><AlertTriangle className="size-3.5" /> some unknown</span>}
                        </span>
                        <Button variant={running ? 'ghost' : 'primary'} disabled={running} onClick={close}>{running ? 'Uploading' : 'Done'}</Button>
                    </div>
                </div>
            </Modal>
            <BundleDetail bundle={opened} canManage onClose={() => setOpened(null)} />
        </>
    );
};

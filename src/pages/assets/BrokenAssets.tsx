import { CheckCircle2, CloudDownload, ExternalLink, EyeOff, RotateCcw, Send, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link } from 'react-router';

import { type BrokenAsset, type BrokenAssetSource, useBrokenAssets, useIgnoreBrokenAsset, useUploadBadgePicture } from '#/api/brokenAssets';
import { useStartSync } from '#/api/bundles';
import { useFetchCatalogPictures, useUploadCatalogImage } from '#/api/catalogImages';
import { Modal } from '#/components/Modal';
import { toast, toastError } from '#/components/toast';
import { Badge, Button, EmptyState, ErrorNotice, Loading, Panel, Segmented, Textarea } from '#/components/ui';
import { cx } from '#/lib/cx';
import { fromNow } from '#/lib/time';
import { UploadDialog } from '#/pages/gamedata/UploadDialog';

const SHOWS = [ { value: 'open', label: 'To fix' }, { value: 'ignored', label: 'Ignored' } ];

/** What a picture is uploaded as here: a badge's and a catalog picture have their own uploads, a library goes through the one for any file. */
const pictureKinds = new Set([ 'badge', 'catalog-image' ]);

const IgnoreDialog = ({ asset, onClose }: { asset: BrokenAsset; onClose: () => void }) => {
    const [ note, setNote ] = useState('');
    const ignore = useIgnoreBrokenAsset();

    return (
        <Modal open onClose={onClose} title={`Ignore ${asset.title}?`} className="sm:h-fit! sm:max-w-lg">
            <form
                className="flex flex-col gap-4 p-4 sm:p-5"
                onSubmit={(event) => {
                    event.preventDefault();
                    ignore.mutate({ asset, note }, {
                        onSuccess: () => {
                            toast('Ignored.');
                            onClose();
                        },
                    });
                }}
            >
                <p className="text-sm text-muted">It stays listed under Ignored, with why, until it is brought back.</p>
                <Textarea name="ignore-note" rows={3} maxLength={512} value={note} onChange={event => setNote(event.target.value)} placeholder="Why: retired badge, page not shown, ..." autoFocus />
                {ignore.error && <ErrorNotice error={ignore.error} />}
                <div className="flex justify-end gap-2 border-t border-line pt-4">
                    <Button variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button type="submit" icon={<EyeOff />} disabled={ignore.isPending}>Ignore</Button>
                </div>
            </form>
        </Modal>
    );
};

/** One broken asset: what it is, why, and the fixes that apply. */
const Row = ({ asset, canManage, busy, onIgnore, onUploadLibrary }: { asset: BrokenAsset; canManage: boolean; busy: boolean; onIgnore: () => void; onUploadLibrary: () => void }) => {
    const file = useRef<HTMLInputElement>(null);
    const sync = useStartSync();
    const fetchPictures = useFetchCatalogPictures();
    const uploadPicture = useUploadCatalogImage();
    const uploadBadge = useUploadBadgePicture();
    const bringBack = useIgnoreBrokenAsset();
    const uploading = uploadPicture.isPending || uploadBadge.isPending;

    const takeFromHabbo = () => asset.kind === 'catalog-image' && asset.name
        ? fetchPictures.mutate([ asset.name ], { onSuccess: () => toast(`Taking ${asset.name} from Habbo.`), onError: toastError })
        : sync.mutate(undefined, { onSuccess: () => toast('A sync from Habbo started.'), onError: toastError });

    const upload = () => (asset.kind && pictureKinds.has(asset.kind) ? file.current?.click() : onUploadLibrary());

    const uploaded = (picked: File | undefined) => {
        if (!picked || !asset.name)
            return;

        const done = { onSuccess: () => toast(`Uploaded ${asset.name}. Players see it once the assets are published.`), onError: toastError };

        if (asset.kind === 'badge')
            uploadBadge.mutate({ code: asset.name.replace(/\.gif$/i, ''), file: picked }, done);
        else
            uploadPicture.mutate({ name: asset.name, file: picked }, done);
    };

    return (
        <li className={cx('flex flex-col gap-1.5 px-4 py-3 sm:flex-row sm:items-start sm:gap-4', asset.ignored && 'opacity-75')}>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="min-w-0 truncate font-mono text-[13px] font-medium" title={asset.title}>{asset.title}</span>
                    {asset.kind && <Badge>{asset.kind}</Badge>}
                    {asset.count > 1 && <Badge tone="amber">{`x${asset.count.toLocaleString()}`}</Badge>}
                    {asset.link && (
                        <a href={asset.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-accent hover:underline">
                            Client error <ExternalLink className="size-3" />
                        </a>
                    )}
                </div>
                <p className="text-[13px] text-muted">{asset.detail}</p>
                {asset.ignored && (
                    <p className="text-xs text-muted">
                        {`Ignored ${fromNow(asset.ignored.ignoredAt)}${asset.ignored.playerName ? ` by ${asset.ignored.playerName}` : ''}`}
                        {asset.ignored.note && <>: <span className="text-fg">{asset.ignored.note}</span></>}
                    </p>
                )}
            </div>
            {canManage && (
                <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                    {!asset.ignored && asset.actions.includes('habbo') && (
                        <Button variant="secondary" icon={<CloudDownload />} className="h-8 px-2.5 text-xs" disabled={busy || sync.isPending || fetchPictures.isPending} onClick={takeFromHabbo}>
                            Take from Habbo
                        </Button>
                    )}
                    {!asset.ignored && asset.actions.includes('upload') && (
                        <>
                            <Button variant="secondary" icon={<Upload />} className="h-8 px-2.5 text-xs" disabled={uploading} onClick={upload}>Upload</Button>
                            <input
                                ref={file}
                                type="file"
                                accept="image/gif,image/png"
                                className="hidden"
                                onChange={(event) => {
                                    uploaded(event.target.files?.[0]);
                                    event.target.value = '';
                                }}
                            />
                        </>
                    )}
                    {!asset.ignored && asset.actions.includes('publish') && (
                        <Link to="/gamedata/publish/targets" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-2.5 text-xs font-medium hover:bg-canvas [&>svg]:size-3.5">
                            <Send /> Publish
                        </Link>
                    )}
                    {asset.ignored
                        ? (
                                <Button
                                    variant="ghost"
                                    icon={<RotateCcw />}
                                    className="h-8 px-2.5 text-xs"
                                    disabled={bringBack.isPending}
                                    onClick={() => bringBack.mutate({ asset, note: null }, { onSuccess: () => toast('Brought back.'), onError: toastError })}
                                >
                                    Bring back
                                </Button>
                            )
                        : <Button variant="ghost" icon={<EyeOff />} className="h-8 px-2.5 text-xs" onClick={onIgnore}>Ignore</Button>}
                </div>
            )}
        </li>
    );
};

/** Rows shown at first, and added by each "Show more": a hotel without bundles yet has thousands. */
const PAGE = 100;

/** A source, how many it found, and a filter to its own: pressed again, every source shows. */
const SourceChip = ({ source, active, onPick }: { source: BrokenAssetSource; active: boolean; onPick: () => void }) => (
    <li>
        <button
            type="button"
            aria-pressed={active}
            disabled={!source.read}
            onClick={onPick}
            className={cx(
                'flex size-full flex-col gap-0.5 rounded-lg border px-3 py-2 text-left disabled:cursor-default',
                !source.read ? 'border-line bg-canvas' : source.count > 0 ? 'border-warn-line bg-warn-soft/60' : 'border-line',
                active && 'ring-2 ring-accent',
            )}
        >
            <span className="flex items-center gap-2 text-[13px] font-medium">
                {source.title}
                {source.read && <span className="font-mono text-xs">{source.count.toLocaleString()}</span>}
            </span>
            {source.note && <span className="text-xs text-muted">{source.note}</span>}
        </button>
    </li>
);

/**
 * Everything players can't load, in one list: the addresses their clients were refused (while the
 * client errors plugin is loaded), what the checks found, the catalog pictures pages show that the
 * hotel lacks and the badges players hold with no picture. Each with the fixes that apply, or
 * ignored with a note.
 */
export const BrokenAssets = ({ canManage, busy }: { canManage: boolean; busy: boolean }) => {
    const { data, error } = useBrokenAssets();
    const [ show, setShow ] = useState('open');
    const [ ignoring, setIgnoring ] = useState<BrokenAsset | null>(null);
    const [ uploading, setUploading ] = useState<string | null>(null);
    const [ only, setOnly ] = useState<string | null>(null);
    const [ limit, setLimit ] = useState(PAGE);
    const items = (data?.items ?? []).filter(x => (show === 'ignored') === !!x.ignored && (!only || x.source === only));

    return (
        <>
            <Panel
                title="Broken assets"
                description="What players can't load, wherever it was found, and how to fix it."
                actions={(
                    <Segmented
                        label="Show"
                        value={show}
                        onChange={(value) => {
                            setShow(value);
                            setLimit(PAGE);
                        }}
                        options={SHOWS}
                    />
                )}
            >
                {error && <div className="p-4"><ErrorNotice error={error} /></div>}
                {!data && !error && <Loading />}
                {data && (
                    <ul className="grid grid-cols-[repeat(auto-fit,minmax(12rem,1fr))] gap-2 border-b border-line p-3 sm:p-4">
                        {data.sources.map(source => (
                            <SourceChip
                                key={source.id}
                                source={source}
                                active={only === source.id}
                                onPick={() => {
                                    setOnly(current => (current === source.id ? null : source.id));
                                    setLimit(PAGE);
                                }}
                            />
                        ))}
                    </ul>
                )}
                {data && items.length === 0 && (
                    show === 'open'
                        ? <p className="flex items-center gap-2 px-4 py-6 text-sm text-good"><CheckCircle2 className="size-4" /> Nothing is broken.</p>
                        : <EmptyState>Nothing is ignored.</EmptyState>
                )}
                {items.length > 0 && (
                    <ul className="divide-y divide-line">
                        {items.slice(0, limit).map(asset => (
                            <Row
                                key={`${asset.source}:${asset.key}`}
                                asset={asset}
                                canManage={canManage}
                                busy={busy}
                                onIgnore={() => setIgnoring(asset)}
                                onUploadLibrary={() => setUploading(asset.name)}
                            />
                        ))}
                    </ul>
                )}
                {items.length > limit && (
                    <div className="flex items-center justify-center gap-3 border-t border-line px-4 py-3 text-[13px] text-muted">
                        {`${limit.toLocaleString()} of ${items.length.toLocaleString()} shown`}
                        <Button variant="secondary" className="h-8 px-2.5 text-xs" onClick={() => setLimit(current => current + PAGE)}>Show more</Button>
                    </div>
                )}
            </Panel>

            {ignoring && <IgnoreDialog asset={ignoring} onClose={() => setIgnoring(null)} />}
            <UploadDialog open={uploading !== null} name={uploading ?? undefined} onClose={() => setUploading(null)} />
        </>
    );
};

import { CheckCircle2, CloudDownload, ExternalLink, EyeOff, RotateCcw, Send, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link } from 'react-router';

import { type BrokenAsset, type BrokenAssetSource, useBrokenAssets, useIgnoreBrokenAssets, useUploadBadgePicture } from '#/api/brokenAssets';
import { useStartSync } from '#/api/bundles';
import { useFetchCatalogPictures, useUploadCatalogImage } from '#/api/catalogImages';
import { Modal } from '#/components/Modal';
import { toast, toastError } from '#/components/toast';
import { Badge, Button, Checkbox, EmptyState, ErrorNotice, Loading, Panel, Segmented, Textarea } from '#/components/ui';
import { cx } from '#/lib/cx';
import { fromNow } from '#/lib/time';
import { UploadDialog } from '#/pages/gamedata/UploadDialog';

const SHOWS = [ { value: 'open', label: 'To fix' }, { value: 'ignored', label: 'Ignored' } ];

/** What a picture is uploaded as here: a badge's and a catalog picture have their own uploads, a library goes through the one for any file. */
const pictureKinds = new Set([ 'badge', 'catalog-image' ]);

const idOf = (asset: BrokenAsset) => `${asset.source}:${asset.key}`;

const plural = (count: number, one: string) => `${count.toLocaleString()} ${one}${count === 1 ? '' : 's'}`;

/**
 * Takes broken assets from Habbo: catalog pictures by name, the rest by a sync, which takes all of
 * them at once. Both are asset jobs and one runs at a time, so with pictures among them only the
 * pictures are taken now. `onStarted` is told which were.
 */
const useTakeFromHabbo = () => {
    const sync = useStartSync();
    const fetchPictures = useFetchCatalogPictures();

    const take = (assets: BrokenAsset[], onStarted?: (taken: BrokenAsset[]) => void) => {
        const fromHabbo = assets.filter(x => x.actions.includes('habbo'));
        const pictures = fromHabbo.filter(x => x.kind === 'catalog-image' && x.name);

        if (pictures.length > 0) {
            const rest = fromHabbo.length - pictures.length;

            fetchPictures.mutate(pictures.map(x => x.name!), {
                onSuccess: () => {
                    toast(`Taking ${pictures.length === 1 ? pictures[0]?.name : plural(pictures.length, 'picture')} from Habbo.${rest > 0 ? ` Take the other ${rest.toLocaleString()} once that is done.` : ''}`);
                    onStarted?.(pictures);
                },
                onError: toastError,
            });
        } else if (fromHabbo.length > 0) {
            sync.mutate(undefined, {
                onSuccess: () => {
                    toast('A sync from Habbo started.');
                    onStarted?.(fromHabbo);
                },
                onError: toastError,
            });
        }
    };

    return { take, pending: sync.isPending || fetchPictures.isPending };
};

const IgnoreDialog = ({ assets, onClose, onIgnored }: { assets: BrokenAsset[]; onClose: () => void; onIgnored?: () => void }) => {
    const [ note, setNote ] = useState('');
    const ignore = useIgnoreBrokenAssets();

    return (
        <Modal open onClose={onClose} title={assets.length === 1 ? `Ignore ${assets[0]?.title}?` : `Ignore ${plural(assets.length, 'asset')}?`} className="sm:h-fit! sm:max-w-lg">
            <form
                className="flex flex-col gap-4 p-4 sm:p-5"
                onSubmit={(event) => {
                    event.preventDefault();
                    ignore.mutate({ assets, note }, {
                        onSuccess: () => {
                            toast(assets.length === 1 ? 'Ignored.' : `Ignored ${plural(assets.length, 'asset')}.`);
                            onIgnored?.();
                            onClose();
                        },
                    });
                }}
            >
                <p className="text-sm text-muted">{assets.length === 1 ? 'It stays' : 'They stay'} listed under Ignored, with why, until brought back.</p>
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

/** One broken asset: what it is, why, and the fixes that apply; ticked, it is one of those done at once. */
const Row = ({ asset, canManage, busy, selected, onSelect, onIgnore, onUploadLibrary }: { asset: BrokenAsset; canManage: boolean; busy: boolean; selected: boolean; onSelect: (selected: boolean) => void; onIgnore: () => void; onUploadLibrary: () => void }) => {
    const file = useRef<HTMLInputElement>(null);
    const fromHabbo = useTakeFromHabbo();
    const uploadPicture = useUploadCatalogImage();
    const uploadBadge = useUploadBadgePicture();
    const bringBack = useIgnoreBrokenAssets();
    const uploading = uploadPicture.isPending || uploadBadge.isPending;

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
        <li className={cx('flex flex-col gap-1.5 px-4 py-3 sm:flex-row sm:items-start sm:gap-4', asset.ignored && 'opacity-75', selected && 'bg-accent/5')}>
            <div className="flex min-w-0 flex-1 items-start gap-3">
                {canManage && <Checkbox label={<span className="sr-only">{`Select ${asset.title}`}</span>} checked={selected} onChange={onSelect} />}
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
            </div>
            {canManage && (
                <div className="flex shrink-0 flex-wrap items-center gap-1.5 max-sm:pl-7">
                    {!asset.ignored && asset.actions.includes('habbo') && (
                        <Button variant="secondary" icon={<CloudDownload />} className="h-8 px-2.5 text-xs" disabled={busy || fromHabbo.pending} onClick={() => fromHabbo.take([ asset ])}>
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
                                    onClick={() => bringBack.mutate({ assets: [ asset ], note: null }, { onSuccess: () => toast('Brought back.'), onError: toastError })}
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

/** The ticked ones, done at once: taken from Habbo or ignored with one note, or brought back. */
const Selection = ({ items, selected, show, busy, onSelectAll, onIgnore, onDone }: {
    items: BrokenAsset[];
    selected: BrokenAsset[];
    show: string;
    busy: boolean;
    onSelectAll: (all: boolean) => void;
    onIgnore: () => void;
    onDone: (assets: BrokenAsset[]) => void;
}) => {
    const fromHabbo = useTakeFromHabbo();
    const bringBack = useIgnoreBrokenAssets();
    const takeable = selected.filter(x => x.actions.includes('habbo'));
    const all = selected.length === items.length;

    return (
        <div className="flex min-h-12 flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-4 py-2">
            <Checkbox label={all ? `All ${items.length.toLocaleString()} selected` : selected.length > 0 ? `${selected.length.toLocaleString()} of ${items.length.toLocaleString()} selected` : `Select all ${items.length.toLocaleString()}`} checked={all} onChange={onSelectAll} />
            {selected.length > 0 && (
                <div className="ml-auto flex flex-wrap items-center gap-1.5">
                    {show === 'open'
                        ? (
                                <>
                                    {takeable.length > 0 && (
                                        <Button variant="secondary" icon={<CloudDownload />} className="h-8 px-2.5 text-xs" disabled={busy || fromHabbo.pending} onClick={() => fromHabbo.take(takeable, onDone)}>
                                            {`Take ${takeable.length.toLocaleString()} from Habbo`}
                                        </Button>
                                    )}
                                    <Button variant="secondary" icon={<EyeOff />} className="h-8 px-2.5 text-xs" onClick={onIgnore}>{`Ignore ${selected.length.toLocaleString()}`}</Button>
                                </>
                            )
                        : (
                                <Button
                                    variant="secondary"
                                    icon={<RotateCcw />}
                                    className="h-8 px-2.5 text-xs"
                                    disabled={bringBack.isPending}
                                    onClick={() => bringBack.mutate({ assets: selected, note: null }, {
                                        onSuccess: () => {
                                            toast(`Brought back ${plural(selected.length, 'asset')}.`);
                                            onDone(selected);
                                        },
                                        onError: toastError,
                                    })}
                                >
                                    {`Bring back ${selected.length.toLocaleString()}`}
                                </Button>
                            )}
                    <Button variant="ghost" className="h-8 px-2.5 text-xs" onClick={() => onSelectAll(false)}>Clear</Button>
                </div>
            )}
        </div>
    );
};

/**
 * Everything players can't load, in one list: the addresses their clients were refused (while the
 * client errors plugin is loaded), what the checks found, the catalog pictures pages show that the
 * hotel lacks and the badges players hold with no picture. Each with the fixes that apply, or
 * ignored with a note; ticked, several are fixed, ignored or brought back at once.
 */
export const BrokenAssets = ({ canManage, busy }: { canManage: boolean; busy: boolean }) => {
    const { data, error } = useBrokenAssets();
    const [ show, setShow ] = useState('open');
    const [ ignoring, setIgnoring ] = useState<BrokenAsset[] | null>(null);
    const [ uploading, setUploading ] = useState<string | null>(null);
    const [ only, setOnly ] = useState<string | null>(null);
    const [ limit, setLimit ] = useState(PAGE);
    const [ ticked, setTicked ] = useState<ReadonlySet<string>>(new Set());
    const items = (data?.items ?? []).filter(x => (show === 'ignored') === !!x.ignored && (!only || x.source === only));
    // Only those in view count: a tick left on one filtered out, or gone from the list, does nothing.
    const selected = items.filter(x => ticked.has(idOf(x)));

    const tick = (assets: BrokenAsset[], on: boolean) => setTicked((current) => {
        const next = new Set(current);

        for (const asset of assets) {
            if (on)
                next.add(idOf(asset));
            else
                next.delete(idOf(asset));
        }

        return next;
    });

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
                            setTicked(new Set());
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
                {items.length > 0 && canManage && (
                    <Selection
                        items={items}
                        selected={selected}
                        show={show}
                        busy={busy}
                        onSelectAll={all => (all ? tick(items, true) : setTicked(new Set()))}
                        onIgnore={() => setIgnoring(selected)}
                        onDone={assets => tick(assets, false)}
                    />
                )}
                {items.length > 0 && (
                    <ul className="divide-y divide-line">
                        {items.slice(0, limit).map(asset => (
                            <Row
                                key={idOf(asset)}
                                asset={asset}
                                canManage={canManage}
                                busy={busy}
                                selected={ticked.has(idOf(asset))}
                                onSelect={on => tick([ asset ], on)}
                                onIgnore={() => setIgnoring([ asset ])}
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

            {ignoring && <IgnoreDialog assets={ignoring} onClose={() => setIgnoring(null)} onIgnored={() => tick(ignoring, false)} />}
            <UploadDialog open={uploading !== null} name={uploading ?? undefined} onClose={() => setUploading(null)} />
        </>
    );
};

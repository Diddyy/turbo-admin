import { Box, ChevronRight } from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import { useSearchParams } from 'react-router';

import { furniIconUrl, useClientAssets } from '#/api/assets';
import { FILES, FURNITURE_KINDS, FURNITURE_TAGS, type FurnitureListItem, type FurnitureTag, type GamedataStatus, useFurnitureList, useImport, useImportPreview } from '#/api/gamedata';
import { ListToolbar } from '#/components/ListToolbar';
import { SearchInput } from '#/components/SearchInput';
import { Badge, Button, EmptyState, ErrorNotice, Loading, Panel, Segmented, Select } from '#/components/ui';
import { cx } from '#/lib/cx';
import { BundleList } from '#/pages/assets/BundleList';
import { BundleUpdate } from '#/pages/assets/BundleUpdate';

import { FurnitureEditor } from './FurnitureEditor';
import { HabboValuesPanel } from './HabboValuesPanel';
import { FieldChanges, HabboUpdate, ReviewItem } from './parts';

/** Habbo's newest release: what taking its furniture in would change. */
export const HabboFurniture = ({ status, defaultOpen }: { status: GamedataStatus; defaultOpen?: boolean }) => {
    const release = status.latestRelease;
    const { data: preview, error } = useImportPreview(release !== null);
    const take = useImport();

    return (
        <HabboUpdate
            defaultOpen={defaultOpen}
            title="furniture"
            version={release && { name: release.revision.replace(/^PRODUCTION-/, ''), holds: `${release.furnitureCount.toLocaleString()} items`, foundAt: release.foundAt, importedAt: release.importedAt }}
            preview={preview && { ...preview, listed: preview.items.length }}
            error={error}
            extra={preview && preview.filesToRead > 0 && <span>{preview.filesToRead.toLocaleString()} files to read</span>}
            file={FILES.furnitureData}
            canManage={status.canManage}
            canTake={!!preview && (preview.added + preview.updated + preview.kept > 0 || preview.filesToRead > 0)}
            confirm={preview ? { title: `Take in Habbo ${preview.release.revision}?`, body: `${preview.filesToRead} furniture files are read first, then ${preview.added} furniture are added and ${preview.updated} updated. It runs in the background and can be rolled back from the history.` } : { title: '' }}
            onTake={() => preview && take.mutate(preview.release.id)}
            taking={take.isPending}
            takeError={take.error}
        >
            {preview?.items.map(item => (
                <ReviewItem key={`${item.productType}:${item.className}`} action={item.action} name={item.className} kind={FURNITURE_KINDS[item.productType]}>
                    {item.fields.length === 0 ? <span className="text-xs text-muted">new, sprite {item.spriteId}</span> : <FieldChanges fields={item.fields} />}
                </ReviewItem>
            ))}
        </HabboUpdate>
    );
};

const VIEWS = [
    { value: 'definitions', label: 'Definitions' },
    { value: 'bundles', label: 'Bundles' },
];

const FurniIcon = ({ className }: { className: string }) => {
    const assets = useClientAssets();
    const url = furniIconUrl(assets, className);
    const [ failed, setFailed ] = useState<string | null>(null);

    return (
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-subtle">
            {url && failed !== url
                ? <img key={url} src={url} alt="" loading="lazy" className="max-h-[85%] max-w-[85%] [image-rendering:pixelated]" onError={() => setFailed(url)} />
                : <Box className="size-4 text-muted" aria-hidden />}
        </span>
    );
};

const Tags = ({ tags }: { tags: FurnitureTag[] }) => (
    <span className="flex flex-wrap gap-1">
        {FURNITURE_TAGS.filter(x => tags.includes(x.value)).map(x => (
            <span key={x.value} title={x.meaning}><Badge tone={x.tone}>{x.label}</Badge></span>
        ))}
    </span>
);

const DefinitionRow = ({ item, onOpen }: { item: FurnitureListItem; onOpen: () => void }) => (
    <li>
        <button
            type="button"
            onClick={onOpen}
            className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-subtle/60 focus-visible:bg-subtle focus-visible:outline-none sm:px-4"
        >
            <FurniIcon className={item.className} />
            <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex min-w-0 items-baseline gap-2">
                    <span className="truncate font-mono text-[13px] font-medium">{item.className}</span>
                    <span className="truncate text-sm text-muted max-sm:hidden">{item.name}</span>
                </span>
                <Tags tags={item.tags} />
            </span>
            <span className="hidden w-28 shrink-0 truncate text-xs text-muted lg:block" title={item.furniLine ?? undefined}>{item.furniLine || '-'}</span>
            <span className="hidden w-16 shrink-0 text-right font-mono text-xs text-muted tabular-nums md:block">{item.spriteId}</span>
            <span className="hidden w-12 shrink-0 md:block"><Badge>{FURNITURE_KINDS[item.productType] ?? '?'}</Badge></span>
            <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />
        </button>
    </li>
);

/** A tag to narrow the list by, with how many of those found carry it. */
const TagChip = ({ label, count, tone, active, title, onClick }: { label: string; count: number | undefined; tone?: string; active: boolean; title?: string; onClick: () => void }) => (
    <button
        type="button"
        title={title}
        aria-pressed={active}
        onClick={onClick}
        className={cx(
            'inline-flex min-h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs transition-colors sm:min-h-7',
            active ? 'border-accent bg-accent-soft text-accent' : 'border-line hover:border-accent hover:text-accent',
        )}
    >
        {tone && <span className={cx('size-1.5 rounded-full', tone)} aria-hidden />}
        {label}
        <span className="font-semibold tabular-nums">{(count ?? 0).toLocaleString()}</span>
    </button>
);

const TONE_DOTS: Record<string, string> = { red: 'bg-bad', amber: 'bg-warn', accent: 'bg-accent', green: 'bg-good', neutral: 'bg-muted' };

/** Every definition, found by words, kind and tag; one opens in the editor. */
const Definitions = ({ status }: { status: GamedataStatus }) => {
    const [ params ] = useSearchParams();
    // Opened from the search: what it found, and the piece picked there.
    const [ text, setText ] = useState(() => params.get('q') ?? '');
    const [ type, setType ] = useState<'' | 'floor' | 'wall'>('');
    const [ tag, setTag ] = useState<FurnitureTag | ''>(() => (FURNITURE_TAGS.some(x => x.value === params.get('tag')) ? params.get('tag') as FurnitureTag : ''));
    const [ page, setPage ] = useState(0);
    const [ open, setOpen ] = useState<number | null>(() => Number(params.get('id')) || null);
    const [ bulk, setBulk ] = useState(false);
    const q = useDeferredValue(text.trim());
    const { data, error, isFetching } = useFurnitureList(q, type, tag, page);
    const pageSize = data?.pageSize ?? 60;

    const pick = (next: FurnitureTag | '') => {
        setTag(next);
        setPage(0);
    };

    return (
        <>
            <section className="overflow-clip rounded-xl border border-line bg-surface">
                <ListToolbar
                    watch={[ q, type, tag, page ]}
                    page={{ offset: page * pageSize, limit: pageSize, total: data?.total, onChange: offset => setPage(Math.round(offset / pageSize)) }}
                >
                    <SearchInput
                        value={text}
                        onValueChange={(value) => {
                            setText(value);
                            setPage(0);
                        }}
                        placeholder="Classname, name or id"
                        aria-label="Find furniture"
                        className="w-full sm:w-64"
                    />
                    <Select
                        aria-label="Kind"
                        value={type}
                        onChange={(event) => {
                            setType(event.target.value as '' | 'floor' | 'wall');
                            setPage(0);
                        }}
                        className="w-full sm:w-32"
                    >
                        <option value="">Floor and wall</option>
                        <option value="floor">Floor</option>
                        <option value="wall">Wall</option>
                    </Select>
                </ListToolbar>
                <div className="flex flex-wrap gap-1.5 border-b border-line px-3 py-2.5 sm:px-4">
                    <TagChip label="All" count={data?.searched} active={tag === ''} onClick={() => pick('')} />
                    {FURNITURE_TAGS.map(x => (
                        <TagChip
                            key={x.value}
                            label={x.label}
                            title={x.meaning}
                            tone={TONE_DOTS[x.tone]}
                            count={data?.tagCounts[x.value]}
                            active={tag === x.value}
                            onClick={() => pick(tag === x.value ? '' : x.value)}
                        />
                    ))}
                </div>

                {error && <div className="p-4"><ErrorNotice error={error} /></div>}
                {!data && !error && <Loading />}
                {data && data.items.length === 0 && (
                    <EmptyState>{q || type || tag ? 'No furniture is like that.' : 'No furniture yet: take Habbo\'s in on the Updates tab.'}</EmptyState>
                )}
                {data && data.items.length > 0 && (
                    <>
                        <div className="hidden items-center gap-3 border-b border-line px-4 py-2 font-mono text-[11px] font-medium tracking-[0.08em] text-muted uppercase md:flex">
                            <span className="w-10 shrink-0" />
                            <span className="flex-1">Furniture</span>
                            <span className="hidden w-28 shrink-0 lg:block">Line</span>
                            <span className="w-16 shrink-0 text-right">Sprite</span>
                            <span className="w-12 shrink-0" />
                            <span className="w-4 shrink-0" />
                        </div>
                        <ul className={cx('divide-y divide-line transition-opacity', isFetching && 'opacity-70')}>
                            {data.items.map(item => <DefinitionRow key={item.id} item={item} onOpen={() => setOpen(item.id)} />)}
                        </ul>
                    </>
                )}
            </section>

            {status.canManage && (
                bulk
                    ? <HabboValuesPanel onClose={() => setBulk(false)} />
                    : (
                            <Panel>
                                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                                    <div className="min-w-0">
                                        <h2 className="text-[13px] font-semibold tracking-wide">Use Habbo's values</h2>
                                        <p className="mt-0.5 text-xs text-muted">Put Habbo's values back in chosen fields, for every furniture Habbo has.</p>
                                    </div>
                                    <Button variant="secondary" onClick={() => setBulk(true)}>Choose fields</Button>
                                </div>
                            </Panel>
                        )
            )}

            <FurnitureEditor id={open} canManage={status.canManage} onClose={() => setOpen(null)} />
        </>
    );
};

/**
 * The hotel's furniture: Habbo's newest release and bundles to take in, at the top as every
 * kind's tab has them; then every definition with what it lacks (a bundle, an offer) and what
 * waits for it, to open and change; or the furniture bundles themselves.
 */
export const FurnitureTab = ({ status }: { status: GamedataStatus }) => {
    const [ params ] = useSearchParams();
    const [ view, setView ] = useState(params.get('view') === 'bundles' ? 'bundles' : 'definitions');

    return (
        <>
            <HabboFurniture status={status} />
            <BundleUpdate kind="furniture" canManage={status.canManage} />
            <div className="w-full sm:w-72">
                <Segmented label="Show" value={view} onChange={setView} options={VIEWS} />
            </div>
            {view === 'bundles' ? <BundleList kind="furniture" canManage={status.canManage} /> : <Definitions status={status} />}
        </>
    );
};

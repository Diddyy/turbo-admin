import { Box, ChevronRight, Cpu, RotateCcw, Wand2, Wrench, X } from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import { useSearchParams } from 'react-router';

import { furniIconUrl, useClientAssets } from '#/api/assets';
import { type BundleKind, useBundles } from '#/api/bundles';
import { FILES, FURNITURE_KINDS, FURNITURE_TAGS, type FurnitureListItem, type FurnitureTag, type GamedataStatus, useFurnitureList, useImport, useImportPreview, useLogicTypes, useSetLogic } from '#/api/gamedata';
import { ask } from '#/components/confirm';
import { ListToolbar } from '#/components/ListToolbar';
import { SearchInput } from '#/components/SearchInput';
import { toast, toastError } from '#/components/toast';
import { Badge, Button, EmptyState, ErrorNotice, Loading, Select } from '#/components/ui';
import { cx } from '#/lib/cx';
import { BundleDetail } from '#/pages/assets/BundleDetail';
import { BundleIcon } from '#/pages/assets/BundleIcon';
import { formatBytes } from '#/pages/assets/format';

import { WaitingFromHabbo } from './frame';
import { FurnitureEditor } from './FurnitureEditor';
import { HabboValuesPanel } from './HabboValuesPanel';
import { LogicSelect } from './LogicSelect';
import { FieldChanges, HabboUpdate, ReviewItem } from './parts';
import { VendingRepairPanel } from './VendingRepairPanel';

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

/** The bundle a definition is drawn from, in a few words: where it came from, its revision and size, or that there is none. */
const BundleCell = ({ item }: { item: FurnitureListItem }) => (
    <span className="hidden w-36 shrink-0 flex-col items-end gap-0.5 text-right font-mono text-[11px] md:flex">
        {item.bundleSize === null
            ? <span className={item.tags.includes('bundle-failed') ? 'text-bad' : 'text-bad/80'}>{item.tags.includes('bundle-failed') ? 'failed' : 'no bundle'}</span>
            : (
                    <>
                        <span className="text-ink">{item.bundleSource === 'upload' ? 'upload' : `rev ${item.bundleRevision ?? '-'}`}</span>
                        <span className="text-muted">{formatBytes(item.bundleSize)}</span>
                    </>
                )}
    </span>
);

/** The logic the server runs it with; in red beside the one it has for it when that is not it. */
const LogicCell = ({ item }: { item: FurnitureListItem }) => {
    const wrong = item.tags.includes('logic-mismatch');

    return (
        <span className="hidden w-40 shrink-0 flex-col gap-0.5 font-mono text-[11px] lg:flex" title={wrong ? `Runs ${item.logic}; the server has ${item.matchingLogic ?? ''} for it.` : item.logic}>
            <span className={cx('truncate', wrong ? 'text-bad' : 'text-ink')}>{item.logic}</span>
            {wrong && <span className="truncate text-muted">{`→ ${item.matchingLogic ?? ''}`}</span>}
        </span>
    );
};

const DefinitionRow = ({ item, onOpen, picked, onPick }: { item: FurnitureListItem; onOpen: () => void; picked?: boolean; onPick?: (picked: boolean) => void }) => (
    <li className="flex items-center">
        {onPick && (
            <label className="grid shrink-0 cursor-pointer place-items-center self-stretch pl-3 sm:pl-4" title="Pick it, to give several a logic at once">
                <input type="checkbox" checked={!!picked} onChange={event => onPick(event.target.checked)} aria-label={`Pick ${item.className}`} className="size-4 accent-accent" />
            </label>
        )}
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
            <span className="hidden w-28 shrink-0 truncate text-xs text-muted xl:block" title={item.furniLine ?? undefined}>{item.furniLine || '-'}</span>
            <LogicCell item={item} />
            <BundleCell item={item} />
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

/**
 * Logics for many at once: a logic for the picked definitions, and, with the wrong logic filter
 * on, the matching logic for every definition it lists. One change set each, in the history.
 */
const LogicBar = ({ picked, mismatched, onDone }: { picked: number[]; mismatched: number; onDone: () => void }) => {
    const { data: logics } = useLogicTypes();
    const set = useSetLogic();
    const [ logic, setLogic ] = useState('');
    const done = (count: number | undefined) => {
        toast(count ? `${count} ${count === 1 ? 'logic' : 'logics'} changed. Rooms load them as they reload.` : 'Every one already had that logic.');
        onDone();
    };
    const run = (input: { ids?: number[]; logic?: string }) => set.mutate(input, { onSuccess: result => done(result.changeSet?.changeCount), onError: toastError });

    return (
        <div className="flex flex-wrap items-center gap-2 border-b border-line bg-accent-soft/40 px-3 py-2.5 text-[13px] sm:px-4 [&>svg]:size-4 [&>svg]:shrink-0">
            {picked.length > 0
                ? (
                        <>
                            <Cpu className="text-accent" />
                            <span className="font-medium">{`${picked.length} picked`}</span>
                            <span className="w-full sm:w-60"><LogicSelect value={logic} logics={logics} onChange={setLogic} /></span>
                            <Button
                                disabled={!logic || set.isPending}
                                onClick={() => ask({ title: `Give ${picked.length} furniture the logic ${logic}?`, body: 'Rooms load the new logic as they reload. It can be rolled back from the history.', confirm: 'Change logic' }, () => run({ ids: picked, logic }))}
                            >
                                Set logic
                            </Button>
                            <Button variant="secondary" icon={<Wand2 />} disabled={set.isPending} title="Each its own: the logic the server has under its classname or its asset file's logic" onClick={() => run({ ids: picked })}>Matching logic</Button>
                            <Button variant="ghost" icon={<X />} onClick={onDone}>Clear</Button>
                        </>
                    )
                : (
                        <>
                            <Wand2 className="text-bad" />
                            <span className="min-w-0 flex-1">{`${mismatched} furniture run as plain furniture where the server has their logic.`}</span>
                            <Button
                                icon={<Wand2 />}
                                disabled={set.isPending}
                                onClick={() => ask({ title: `Use the matching logic for all ${mismatched}?`, body: 'Each gets the logic the server has under its classname or its asset file\'s logic. Rooms load it as they reload; it can be rolled back from the history.', confirm: 'Use matching logic' }, () => run({}))}
                            >
                                Use the matching logic for all
                            </Button>
                        </>
                    )}
        </div>
    );
};

/** The filter that lists the furniture bundles no definition is drawn from, instead of definitions. */
const UNUSED = 'unused-bundles';

/**
 * The filter a link opens the list with: a tag (`?tag=no-bundle`), or what the bundles' own list
 * was opened with before it was merged in (`?status=unused`, `?status=failed`).
 */
const startFilter = (params: URLSearchParams): FurnitureTag | '' | typeof UNUSED => {
    const tag = params.get('tag');

    if (FURNITURE_TAGS.some(x => x.value === tag))
        return tag as FurnitureTag;

    if (params.get('status') === 'unused')
        return UNUSED;

    return params.get('status') === 'failed' ? 'bundle-failed' : '';
};

const TONE_DOTS: Record<string, string> = { red: 'bg-bad', amber: 'bg-warn', accent: 'bg-accent', green: 'bg-good', neutral: 'bg-muted' };

/** Every definition, found by words, kind and tag; one opens in the editor. */
const Definitions = ({ status }: { status: GamedataStatus }) => {
    const [ params ] = useSearchParams();
    // Opened from the search: what it found, and the piece picked there.
    const [ text, setText ] = useState(() => params.get('q') ?? '');
    const [ type, setType ] = useState<'' | 'floor' | 'wall'>('');
    const [ tag, setTag ] = useState<FurnitureTag | '' | typeof UNUSED>(() => startFilter(params));
    const [ page, setPage ] = useState(0);
    const [ open, setOpen ] = useState<number | null>(() => Number(params.get('id')) || null);
    const [ bulk, setBulk ] = useState(false);
    const [ vendingRepair, setVendingRepair ] = useState(false);
    const [ picked, setPicked ] = useState<Set<number>>(() => new Set());
    const q = useDeferredValue(text.trim());
    const unused = tag === UNUSED;
    const { data, error, isFetching } = useFurnitureList(q, type, unused ? '' : tag, unused ? 0 : page);
    const { data: unusedBundles } = useBundles('furniture', unused ? q : '', 'unused', unused ? page : 0);
    const pageSize = (unused ? unusedBundles?.pageSize : data?.pageSize) ?? 60;
    const [ bundle, setBundle ] = useState<{ kind: BundleKind; name: string } | null>(null);

    const pick = (next: FurnitureTag | '' | typeof UNUSED) => {
        setTag(next);
        setPage(0);
    };

    return (
        <>
            {bulk && <HabboValuesPanel onClose={() => setBulk(false)} />}
            {status.canManage && vendingRepair && <div className="mb-4"><VendingRepairPanel onClose={() => setVendingRepair(false)} /></div>}
            <section className="overflow-clip rounded-xl border border-line bg-surface">
                <ListToolbar
                    watch={[ q, type, tag, page ]}
                    page={{ offset: page * pageSize, limit: pageSize, total: unused ? unusedBundles?.total : data?.total, onChange: offset => setPage(Math.round(offset / pageSize)) }}
                >
                    <SearchInput
                        value={text}
                        onValueChange={(value) => {
                            setText(value);
                            setPage(0);
                        }}
                        placeholder={unused ? 'Bundle name' : 'Classname, name or id'}
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
                        disabled={unused}
                        className="w-full sm:w-40"
                    >
                        <option value="">Floor and wall</option>
                        <option value="floor">Floor</option>
                        <option value="wall">Wall</option>
                    </Select>
                    {status.canManage && !bulk && (
                        <Button variant="ghost" icon={<RotateCcw />} title="Put Habbo's values back in chosen fields, for every furniture Habbo has" onClick={() => setBulk(true)}>
                            Use Habbo's values
                        </Button>
                    )}
                    {status.canManage && !vendingRepair && (
                        <Button variant="ghost" icon={<Wrench />} title="Preview and repair known vending definitions missing hand items" onClick={() => setVendingRepair(true)}>
                            Repair vending
                        </Button>
                    )}
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
                    <TagChip
                        label="unused bundles"
                        title="Furniture bundles no definition is drawn from. They do no harm; they are only kept and published."
                        tone="bg-warn"
                        count={unusedBundles?.total}
                        active={unused}
                        onClick={() => pick(unused ? '' : UNUSED)}
                    />
                </div>

                {unused && (
                    <>
                        {!unusedBundles && <Loading />}
                        {unusedBundles?.items.length === 0 && <EmptyState>{q ? 'No unused bundle has that name.' : 'Every furniture bundle is drawn from by a definition.'}</EmptyState>}
                        {unusedBundles && unusedBundles.items.length > 0 && (
                            <ul className="divide-y divide-line">
                                {unusedBundles.items.map(item => (
                                    <li key={item.name}>
                                        <button
                                            type="button"
                                            onClick={() => setBundle({ kind: 'furniture', name: item.name })}
                                            className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-subtle/60 focus-visible:bg-subtle focus-visible:outline-none sm:px-4"
                                        >
                                            <BundleIcon kind="furniture" name={item.name} />
                                            <span className="flex min-w-0 flex-1 flex-col gap-1">
                                                <span className="truncate font-mono text-[13px] font-medium text-muted">{item.name}</span>
                                                <span className="flex flex-wrap gap-1">
                                                    <Badge tone="amber">no definition</Badge>
                                                    {item.source === 'upload' && <Badge tone="accent">upload</Badge>}
                                                    {item.error && <Badge tone="red">failed</Badge>}
                                                </span>
                                            </span>
                                            <span className="hidden w-36 shrink-0 flex-col items-end gap-0.5 text-right font-mono text-[11px] md:flex">
                                                <span>{item.source === 'upload' ? 'upload' : `rev ${item.revision ?? '-'}`}</span>
                                                <span className="text-muted">{item.error ? '-' : formatBytes(item.size)}</span>
                                            </span>
                                            <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </>
                )}

                {!unused && status.canManage && (picked.size > 0 || (tag === 'logic-mismatch' && (data?.total ?? 0) > 0)) && (
                    <LogicBar picked={[ ...picked ]} mismatched={tag === 'logic-mismatch' ? data?.total ?? 0 : 0} onDone={() => setPicked(new Set())} />
                )}
                {!unused && error && <div className="p-4"><ErrorNotice error={error} /></div>}
                {!unused && !data && !error && <Loading />}
                {!unused && data && data.items.length === 0 && (
                    <EmptyState>{q || type || tag ? 'No furniture is like that.' : 'No furniture yet: take Habbo\'s in from Habbo updates.'}</EmptyState>
                )}
                {!unused && data && data.items.length > 0 && (
                    <>
                        <div className="hidden items-center gap-3 border-b border-line px-4 py-2 font-mono text-[11px] font-medium tracking-[0.08em] text-muted uppercase md:flex">
                            {status.canManage && <span className="w-4 shrink-0" />}
                            <span className="w-10 shrink-0" />
                            <span className="flex-1">Furniture</span>
                            <span className="hidden w-28 shrink-0 xl:block">Line</span>
                            <span className="hidden w-40 shrink-0 lg:block">Logic</span>
                            <span className="w-36 shrink-0 text-right">Bundle</span>
                            <span className="w-16 shrink-0 text-right">Sprite</span>
                            <span className="w-12 shrink-0" />
                            <span className="w-4 shrink-0" />
                        </div>
                        <ul className={cx('divide-y divide-line transition-opacity', isFetching && 'opacity-70')}>
                            {data.items.map(item => (
                                <DefinitionRow
                                    key={item.id}
                                    item={item}
                                    onOpen={() => setOpen(item.id)}
                                    picked={picked.has(item.id)}
                                    onPick={status.canManage ? on => setPicked(current => (on ? new Set(current).add(item.id) : new Set([ ...current ].filter(x => x !== item.id)))) : undefined}
                                />
                            ))}
                        </ul>
                    </>
                )}
            </section>

            <FurnitureEditor id={open} canManage={status.canManage} onClose={() => setOpen(null)} />
            <BundleDetail bundle={bundle} canManage={status.canManage} onClose={() => setBundle(null)} />
        </>
    );
};

/**
 * The hotel's furniture, definitions and bundles in one: what Habbo has waiting, in a line; then
 * every definition with its bundle and what it lacks (a bundle, an offer), to open and change -
 * and the bundles no definition is drawn from, as one more filter of the same list.
 */
export const FurnitureTab = ({ status }: { status: GamedataStatus }) => (
    <>
        <WaitingFromHabbo status={status} data="furniture" bundles="furniture" />
        <Definitions status={status} />
    </>
);

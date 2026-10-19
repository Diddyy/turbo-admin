import { CheckCircle2, ChevronDown, Hotel, Library, RefreshCw } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { useSearchParams } from 'react-router';

import { type AssetsStatus, type BundleKind, useAssetJob, useRelist, useSyncPreview } from '#/api/bundles';
import { type GamedataStatus, useCheckHabbo, useFigureImportPreview, useImportPreview, useProductImportPreview, useTextImportPreview } from '#/api/gamedata';
import { toast, toastError } from '#/components/toast';
import { Badge, type BadgeTone, Button, ErrorNotice, Label, PageBody, PageHeader, Panel } from '#/components/ui';
import { cx } from '#/lib/cx';
import { usePathTab } from '#/lib/tabs';
import { fromNow } from '#/lib/time';
import { BundleUpdate, SyncButton } from '#/pages/assets/BundleUpdate';
import { JobPanel } from '#/pages/assets/JobPanel';

import { HabboFigures } from './FiguresTab';
import { Loaded } from './frame';
import { HabboFurniture } from './FurnitureTab';
import { HabboClientPanel } from './HabboClientPanel';
import { HistoryPanel } from './HistoryPanel';
import { HabboProducts } from './ProductsTab';
import { useGamedata } from './state';
import { HabboTexts } from './TextsTab';

/** Something Habbo has that the hotel may take in: its count waiting, and its list to review and take in. */
interface Category {
    id: string;
    label: string;
    group: 'Gamedata' | 'Bundles';
    /** What waits to be taken in; null while it is worked out or can't be. */
    count: number | null;
    /** Why there is no count, when it isn't only loading. */
    note?: string;
    content: ReactNode;
}

const Fact = ({ label, children }: { label: string; children: ReactNode }) => (
    <div className="min-w-0">
        <div className="text-xs text-muted">{label}</div>
        <div className="truncate text-sm font-medium">{children}</div>
    </div>
);

/** A place updates come from, with what it serves and when it was looked at. */
const SourceBox = ({ icon, name, tags, facts, actions }: { icon: ReactNode; name: string; tags: { label: string; tone: BadgeTone }[]; facts: ReactNode; actions?: ReactNode }) => (
    <div className="flex min-w-0 items-start gap-3 rounded-lg border border-line p-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent [&>svg]:size-4.5">{icon}</span>
        <div className="flex min-w-0 flex-1 flex-col gap-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-sm font-semibold">{name}</span>
                {tags.map(tag => <Badge key={tag.label} tone={tag.tone}>{tag.label}</Badge>)}
            </div>
            <div className="grid grid-cols-3 gap-3">{facts}</div>
            {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
    </div>
);

/** The categories, worked out from the same previews the library and texts pages show; before the gamedata is read, none. */
const useCategories = (status: GamedataStatus | undefined, canManage: boolean): Category[] => {
    const furniture = useImportPreview(!!status?.latestRelease);
    const figures = useFigureImportPreview(!!status?.latestFigures);
    const products = useProductImportPreview(!!status?.latestProducts);
    const texts = useTextImportPreview(!!status?.latestTexts);
    const bundles = useSyncPreview(!!status);

    if (!status)
        return [];

    const unchecked = 'Habbo hasn\'t been checked yet.';

    const dataCount = (checked: boolean, data: { added: number; updated: number; kept: number } | undefined, extra = 0) =>
        checked && data ? data.added + data.updated + data.kept + extra : null;

    const bundleCategory = (kind: BundleKind, id: string, label: string): Category => {
        const entry = bundles.data?.kinds.find(x => x.kind === kind);

        return {
            id,
            label,
            group: 'Bundles',
            count: entry?.listed ? entry.new + entry.updated : null,
            note: bundles.error ? 'Habbo couldn\'t be read.' : entry && !entry.listed ? 'Habbo\'s list couldn\'t be read.' : undefined,
            content: <BundleUpdate kind={kind} canManage={canManage} defaultOpen />,
        };
    };

    return [
        {
            id: 'furniture',
            label: 'Furniture data',
            group: 'Gamedata',
            count: dataCount(status.latestRelease !== null, furniture.data, furniture.data && furniture.data.filesToRead > 0 && furniture.data.added + furniture.data.updated + furniture.data.kept === 0 ? 1 : 0),
            note: status.latestRelease ? undefined : unchecked,
            content: <HabboFurniture status={status} defaultOpen />,
        },
        {
            id: 'figures',
            label: 'Clothing data',
            group: 'Gamedata',
            count: dataCount(status.latestFigures !== null, figures.data),
            note: status.latestFigures ? undefined : unchecked,
            content: <HabboFigures status={status} defaultOpen />,
        },
        {
            id: 'products',
            label: 'Product data',
            group: 'Gamedata',
            count: dataCount(status.latestProducts !== null, products.data),
            note: status.latestProducts ? undefined : unchecked,
            content: <HabboProducts status={status} defaultOpen />,
        },
        {
            id: 'texts',
            label: 'Texts',
            group: 'Gamedata',
            count: dataCount(status.latestTexts !== null, texts.data),
            note: status.latestTexts ? undefined : unchecked,
            content: <HabboTexts status={status} defaultOpen />,
        },
        bundleCategory('furniture', 'furniture-bundles', 'Furniture'),
        bundleCategory('figure', 'figure-bundles', 'Clothing'),
        bundleCategory('effect', 'effect-bundles', 'Effects'),
        bundleCategory('pet', 'pet-bundles', 'Pets'),
        bundleCategory('room', 'room-bundles', 'Room libraries'),
        bundleCategory('badge', 'badges', 'Badges'),
        bundleCategory('catalog-icon', 'catalog-icons', 'Catalog icons'),
        bundleCategory('catalog-image', 'catalog-pictures', 'Catalog pictures'),
        bundleCategory('sound', 'trax-samples', 'Trax samples'),
    ];
};

const NavButton = ({ category, active, onClick }: { category: Category; active: boolean; onClick: () => void }) => (
    <button
        type="button"
        onClick={onClick}
        aria-current={active}
        title={category.note}
        className={cx(
            'flex min-h-10 w-full items-center justify-between gap-2 rounded-lg px-3 text-left text-sm transition-colors sm:min-h-8',
            active ? 'bg-accent-soft font-medium text-accent' : 'hover:bg-subtle',
        )}
    >
        <span className="truncate">{category.label}</span>
        <span className={cx('shrink-0 text-xs tabular-nums', category.count ? 'rounded-full bg-warn-soft px-1.5 font-semibold text-warn' : 'text-muted')}>
            {category.count === null ? '–' : category.count === 0 ? <CheckCircle2 className="size-3.5 text-good" /> : category.count.toLocaleString()}
        </span>
    </button>
);

/**
 * What Habbo has that the hotel hasn't taken in, as nitro-studio's updater lays it out: every kind
 * of data and bundle with what waits, those up to date folded away; the one picked (or the one a
 * library page's link asked for), to review and take in; and the sync or publish running above.
 */
const WaitingTab = ({ categories, assets, canManage }: { categories: Category[]; assets: AssetsStatus; canManage: boolean }) => {
    const [ params ] = useSearchParams();
    const { data: job } = useAssetJob();
    // A sync or a build, however it ended; a publish only while it runs (its own page keeps the last).
    const lastJob = job ?? assets.job;
    const shownJob = lastJob && (lastJob.status === 'running' || lastJob.kind !== 'publish') ? lastJob : null;
    const waiting = categories.filter(x => x.count);
    const total = waiting.reduce((sum, x) => sum + x.count!, 0);
    const [ picked, setPicked ] = useState<string | null>(() => params.get('pick'));
    const [ showAll, setShowAll ] = useState(false);
    const selected = categories.find(x => x.id === picked) ?? waiting[0] ?? categories[0]!;
    const listed = categories.filter(x => showAll || x.count !== 0 || x.id === selected.id);
    const folded = categories.length - listed.length;

    return (
        <>
            {shownJob && <JobPanel job={shownJob} canManage={canManage} compact={shownJob.status !== 'running'} />}

            <Panel
                title={total > 0 ? `${total.toLocaleString()} ${total === 1 ? 'update' : 'updates'} to take in` : 'Nothing to take in'}
                description={total > 0 ? 'Pick one to look over; each is taken in on its own, and the data can be rolled back from the history.' : 'The hotel has everything Habbo serves that it was checked for.'}
            >
                <div className="grid items-start lg:grid-cols-[14rem_minmax(0,1fr)]">
                    <nav aria-label="What to update" className="flex flex-col gap-3 border-b border-line p-2 lg:border-r lg:border-b-0">
                        {([ 'Gamedata', 'Bundles' ] as const).map(group => listed.some(x => x.group === group) && (
                            <div key={group} className="flex flex-col gap-0.5">
                                <Label className="px-3 pt-1 pb-1">{group}</Label>
                                {listed.filter(x => x.group === group).map(category => (
                                    <NavButton key={category.id} category={category} active={category.id === selected.id} onClick={() => setPicked(category.id)} />
                                ))}
                            </div>
                        ))}
                        {(folded > 0 || showAll) && (
                            <button type="button" onClick={() => setShowAll(!showAll)} className="flex min-h-9 items-center gap-1.5 border-t border-line px-3 pt-2 text-xs text-muted hover:text-ink">
                                <ChevronDown className={cx('size-3.5 transition-transform', showAll && 'rotate-180')} />
                                {showAll ? 'Hide the ones up to date' : `${folded} up to date`}
                            </button>
                        )}
                    </nav>
                    {/* The picked one's own card, flush in the pane rather than a box in a box. */}
                    <div key={selected.id} className="min-w-0 [&>section]:rounded-none [&>section]:border-0">
                        {selected.note && selected.count === null && <p className="px-4 pt-3 text-sm text-muted">{selected.note}</p>}
                        {selected.content}
                    </div>
                </div>
            </Panel>
        </>
    );
};

/** Where updates come from: Habbo's gamedata, its libraries, and its HTML client, with when each was looked at. */
const SourcesTab = ({ status, assets, canManage, waitingData }: { status: GamedataStatus; assets: AssetsStatus; canManage: boolean; waitingData: number }) => {
    const relist = useRelist();
    const { data: bundles, error: bundlesError } = useSyncPreview();
    const release = status.latestRelease;
    const bundlesPending = bundles?.kinds.reduce((sum, x) => sum + x.new + x.updated, 0) ?? 0;

    return (
        <>
            <Panel title="Habbo" description="Habbo is checked on a schedule; Check Habbo asks it at once, and a sync may follow.">
                <div className="grid gap-3 p-3 sm:p-4 lg:grid-cols-2">
                    <SourceBox
                        icon={<Hotel />}
                        name={release ? `habbo.${release.domain}` : 'Habbo'}
                        tags={[
                            ...(release ? [] : [ { label: 'not checked', tone: 'neutral' as const } ]),
                            ...(waitingData > 0 ? [ { label: `${waitingData} with changes`, tone: 'amber' as const } ] : release ? [ { label: 'up to date', tone: 'green' as const } ] : []),
                        ]}
                        facts={(
                            <>
                                <Fact label="Release"><span className="font-mono">{release ? release.revision.replace(/^PRODUCTION-/, '') : '-'}</span></Fact>
                                <Fact label="Checked">{release ? fromNow(release.checkedAt) : 'never'}</Fact>
                                <Fact label="Furniture">{release ? release.furnitureCount.toLocaleString() : '-'}</Fact>
                            </>
                        )}
                    />
                    <SourceBox
                        icon={<Library />}
                        name="Habbo's libraries"
                        tags={[
                            ...(bundlesError ? [ { label: 'can\'t read Habbo', tone: 'red' as const } ] : []),
                            ...(bundles ? [ bundlesPending > 0 ? { label: `${bundlesPending.toLocaleString()} to download`, tone: 'amber' as const } : { label: 'up to date', tone: 'green' as const } ] : []),
                        ]}
                        facts={(
                            <>
                                <Fact label="Client"><span className="font-mono">{bundles ? bundles.revision.replace(/^PRODUCTION-/, '') : '-'}</span></Fact>
                                <Fact label="Listed">{bundles ? fromNow(bundles.listedAt) : '-'}</Fact>
                                <Fact label="Bundles">{assets.kinds.reduce((sum, x) => sum + x.bundles, 0).toLocaleString()}</Fact>
                            </>
                        )}
                        actions={(
                            <>
                                <Button variant="secondary" icon={<RefreshCw />} disabled={relist.isPending} onClick={() => relist.mutate()}>
                                    {relist.isPending ? 'Reading' : 'Read again'}
                                </Button>
                                {canManage && <SyncButton pending={bundlesPending} variant="secondary" />}
                            </>
                        )}
                    />
                </div>
                {relist.error && <div className="border-t border-line p-4"><ErrorNotice error={relist.error} /></div>}
            </Panel>

            <HabboClientPanel canManage={canManage} />
        </>
    );
};

/** Asks Habbo now, saying what it found. */
const CheckButton = () => {
    const check = useCheckHabbo();

    return (
        <Button
            variant="secondary"
            icon={<RefreshCw className={cx(check.isPending && 'animate-spin')} />}
            disabled={check.isPending}
            onClick={() => check.mutate(undefined, {
                onError: toastError,
                onSuccess: data => toast([
                    data.isNew ? `New release: ${data.release.revision}.` : null,
                    data.productsAreNew ? 'New product data.' : null,
                    data.textsAreNew ? 'New texts.' : null,
                    data.figuresAreNew ? 'New figure data.' : null,
                ].filter(Boolean).join(' ') || 'Nothing new: Habbo serves what was already found.'),
            })}
        >
            {check.isPending ? 'Checking' : 'Check Habbo'}
        </Button>
    );
};

const TABS = [ 'waiting', 'sources', 'history' ] as const;

/**
 * Habbo updates: what Habbo has that the hotel hasn't taken in (each to review and take in, the
 * data rolled back from the history if need be), where it comes from, and the history of the
 * gamedata Habbo serves (the variables keep theirs on their own tab).
 */
export const UpdatesPage = () => {
    const state = useGamedata();
    const [ tab, toTab ] = usePathTab(TABS);
    const categories = useCategories(state.status, state.canManage);

    if (toTab)
        return toTab;

    const total = categories.reduce((sum, x) => sum + (x.count ?? 0), 0);
    const release = state.status?.latestRelease;

    return (
        <>
            <PageHeader
                title="Habbo updates"
                description={release ? `Habbo ${release.revision.replace(/^PRODUCTION-/, '')}, checked ${fromNow(release.checkedAt)}` : 'What Habbo has that the hotel hasn\'t taken in'}
                tabs={{
                    items: [
                        { value: 'waiting', label: 'Waiting', to: '/gamedata/updates/waiting', ...(total > 0 ? { count: total } : {}) },
                        { value: 'sources', label: 'Sources', to: '/gamedata/updates/sources' },
                        { value: 'history', label: 'History', to: '/gamedata/updates/history' },
                    ],
                    value: tab,
                }}
            >
                {state.canManage && <CheckButton />}
            </PageHeader>
            <PageBody className="flex flex-col gap-4 lg:gap-5">
                <Loaded state={state}>
                    {(status, assets) => (
                        <>
                            {tab === 'waiting' && <WaitingTab categories={categories} assets={assets} canManage={state.canManage} />}
                            {tab === 'sources' && <SourcesTab status={status} assets={assets} canManage={state.canManage} waitingData={categories.filter(x => x.group === 'Gamedata' && x.count).length} />}
                            {tab === 'history' && <HistoryPanel scope="habbo" canManage={status.canManage} />}
                        </>
                    )}
                </Loaded>
            </PageBody>
        </>
    );
};

import { CheckCircle2, ChevronDown, Hotel, Library, RefreshCw } from 'lucide-react';
import { type ReactNode, useState } from 'react';

import { type AssetsStatus, type BundleKind, useAssetJob, useRelist, useSyncPreview } from '#/api/bundles';
import { type GamedataStatus, useCheckHabbo, useFigureImportPreview, useImportPreview, useProductImportPreview, useTextImportPreview } from '#/api/gamedata';
import { Badge, type BadgeTone, Button, ErrorNotice, Panel, SuccessNotice } from '#/components/ui';
import { cx } from '#/lib/cx';
import { fromNow } from '#/lib/time';
import { BundleUpdate, SyncButton } from '#/pages/assets/BundleUpdate';
import { Checks } from '#/pages/assets/Checks';
import { JobPanel } from '#/pages/assets/JobPanel';

import { HabboFigures } from './FiguresTab';
import { HabboFurniture } from './FurnitureTab';
import { HabboClientPanel } from './HabboClientPanel';
import { HabboProducts } from './ProductsTab';
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

/** The categories, worked out from the same previews their tabs show. */
const useCategories = (status: GamedataStatus, canManage: boolean): Category[] => {
    const furniture = useImportPreview(status.latestRelease !== null);
    const figures = useFigureImportPreview(status.latestFigures !== null);
    const products = useProductImportPreview(status.latestProducts !== null);
    const texts = useTextImportPreview(status.latestTexts !== null);
    const bundles = useSyncPreview();
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
        bundleCategory('furniture', 'furniture-bundles', 'Furniture bundles'),
        {
            id: 'figures',
            label: 'Clothing data',
            group: 'Gamedata',
            count: dataCount(status.latestFigures !== null, figures.data),
            note: status.latestFigures ? undefined : unchecked,
            content: <HabboFigures status={status} defaultOpen />,
        },
        bundleCategory('figure', 'figure-bundles', 'Clothing bundles'),
        bundleCategory('effect', 'effect-bundles', 'Effect bundles'),
        bundleCategory('pet', 'pet-bundles', 'Pet bundles'),
        bundleCategory('room', 'room-bundles', 'Room libraries'),
        bundleCategory('badge', 'badges', 'Badges'),
        bundleCategory('catalog-icon', 'catalog-icons', 'Catalog icons'),
        bundleCategory('catalog-image', 'catalog-pictures', 'Catalog pictures'),
        bundleCategory('sound', 'trax-samples', 'Trax samples'),
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
    ];
};

const NavButton = ({ category, active, onClick }: { category: Category; active: boolean; onClick: () => void }) => (
    <button
        type="button"
        onClick={onClick}
        aria-current={active}
        title={category.note}
        className={cx(
            'flex min-h-10 w-full items-center justify-between gap-2 px-3 text-left text-sm sm:min-h-8',
            active ? 'bg-accent-soft font-medium text-accent' : 'hover:bg-subtle',
        )}
    >
        <span className="truncate">{category.label}</span>
        <span className={cx('shrink-0 text-xs tabular-nums', category.count ? 'font-semibold text-warn' : 'text-muted')}>
            {category.count === null ? '–' : category.count === 0 ? <CheckCircle2 className="size-3.5 text-good" /> : category.count.toLocaleString()}
        </span>
    </button>
);

/**
 * What Habbo has that the hotel hasn't taken in, all in one place, as nitro-studio's updater lays
 * it out: where updates come from and when they were looked at; every kind of data and bundle with
 * what waits, those up to date folded away; the one picked, to review and take in; then the sync or
 * publish running and what the checks found.
 */
export const UpdatesTab = ({ status, assets }: { status: GamedataStatus; assets: AssetsStatus }) => {
    const canManage = status.canManage && assets.canManage;
    const categories = useCategories(status, canManage);
    const check = useCheckHabbo();
    const relist = useRelist();
    const { data: bundles, error: bundlesError } = useSyncPreview();
    const { data: job } = useAssetJob();
    const shownJob = job ?? assets.job;
    const waiting = categories.filter(x => x.count);
    const total = waiting.reduce((sum, x) => sum + x.count!, 0);
    const [ picked, setPicked ] = useState<string | null>(null);
    const [ showAll, setShowAll ] = useState(false);
    const selected = categories.find(x => x.id === picked) ?? waiting[0] ?? categories[0]!;
    const release = status.latestRelease;
    const bundlesPending = bundles?.kinds.reduce((sum, x) => sum + x.new + x.updated, 0) ?? 0;
    const listed = categories.filter(x => showAll || x.count !== 0 || x.id === selected.id);
    const folded = categories.length - listed.length;
    const dataWaiting = categories.filter(x => x.group === 'Gamedata' && x.count).length;

    return (
        <>
            <Panel title="Where updates come from" description="Habbo is checked on a schedule; checking now asks it at once, and a sync may follow.">
                <div className="grid gap-3 p-3 sm:p-4 lg:grid-cols-2">
                    <SourceBox
                        icon={<Hotel />}
                        name={release ? `habbo.${release.domain}` : 'Habbo'}
                        tags={[
                            ...(release ? [] : [ { label: 'not checked', tone: 'neutral' as const } ]),
                            ...(dataWaiting > 0 ? [ { label: `${dataWaiting} with changes`, tone: 'amber' as const } ] : release ? [ { label: 'up to date', tone: 'green' as const } ] : []),
                        ]}
                        facts={(
                            <>
                                <Fact label="Release"><span className="font-mono">{release ? release.revision.replace(/^PRODUCTION-/, '') : '-'}</span></Fact>
                                <Fact label="Checked">{release ? fromNow(release.checkedAt) : 'never'}</Fact>
                                <Fact label="Furniture">{release ? release.furnitureCount.toLocaleString() : '-'}</Fact>
                            </>
                        )}
                        actions={canManage && (
                            <Button variant="secondary" icon={<RefreshCw />} disabled={check.isPending} onClick={() => check.mutate()}>
                                {check.isPending ? 'Checking' : 'Check now'}
                            </Button>
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
                {(check.error || check.data || relist.error) && (
                    <div className="border-t border-line p-4">
                        {check.error && <ErrorNotice error={check.error} />}
                        {relist.error && <ErrorNotice error={relist.error} />}
                        {check.data && (
                            <SuccessNotice>
                                {[
                                    check.data.isNew ? `New release: ${check.data.release.revision}.` : null,
                                    check.data.productsAreNew ? 'New product data.' : null,
                                    check.data.textsAreNew ? 'New texts.' : null,
                                    check.data.figuresAreNew ? 'New figure data.' : null,
                                ].filter(Boolean).join(' ') || 'Nothing new: Habbo serves what was already found.'}
                            </SuccessNotice>
                        )}
                    </div>
                )}
            </Panel>

            <HabboClientPanel canManage={canManage} />

            {shownJob && <JobPanel job={shownJob} canManage={canManage} />}

            <Panel title={total > 0 ? `${total.toLocaleString()} updates to take in` : 'Nothing to take in'} description={total > 0 ? 'Pick what to look over; each is taken in on its own, and the data can be rolled back from the history.' : 'The hotel has everything Habbo serves that it was checked for.'}>
                <div className="grid items-start gap-0 lg:grid-cols-[15rem_minmax(0,1fr)]">
                    <nav aria-label="What to update" className="flex flex-col border-b border-line py-1.5 lg:border-r lg:border-b-0">
                        {([ 'Gamedata', 'Bundles' ] as const).map(group => listed.some(x => x.group === group) && (
                            <div key={group} className="flex flex-col">
                                <span className="px-3 pt-2 pb-1 font-mono text-[11px] font-medium tracking-[0.08em] text-muted uppercase">{group}</span>
                                {listed.filter(x => x.group === group).map(category => (
                                    <NavButton key={category.id} category={category} active={category.id === selected.id} onClick={() => setPicked(category.id)} />
                                ))}
                            </div>
                        ))}
                        {(folded > 0 || showAll) && (
                            <button type="button" onClick={() => setShowAll(!showAll)} className="mt-1.5 flex min-h-9 items-center gap-1.5 border-t border-line px-3 pt-1.5 text-xs text-muted hover:text-ink">
                                <ChevronDown className={cx('size-3.5 transition-transform', showAll && 'rotate-180')} />
                                {showAll ? 'Hide the ones up to date' : `${folded} up to date`}
                            </button>
                        )}
                    </nav>
                    <div key={selected.id} className="min-w-0 p-3 sm:p-4">
                        {selected.note && selected.count === null && <p className="mb-3 text-sm text-muted">{selected.note}</p>}
                        {selected.content}
                    </div>
                </div>
            </Panel>

            <Checks />
        </>
    );
};

import { ArrowRight, ChevronRight, Copy, EyeOff, PackageSearch, Star, Wand2 } from 'lucide-react';
import type { ReactNode } from 'react';

import { type CatalogTree, FRONT_PAGE_LAYOUT, useDuplicates, useUnoffered } from '#/api/catalog';
import { Button, Label } from '#/components/ui';
import { cx } from '#/lib/cx';
import { plural } from '#/lib/plural';

import { PageIcon } from './PageTree';

/** The tint behind a card's icon: good news, something to see to, or neither. */
const TONES = {
    warn: 'bg-warn-soft text-warn',
    good: 'bg-good-soft text-good',
    none: 'bg-accent-soft text-accent',
};

const Card = ({ icon, title, value, blurb, action, tone }: { icon: ReactNode; title: string; value?: ReactNode; blurb: string; action: ReactNode; tone?: 'warn' | 'good' }) => (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
        <div className="flex items-start gap-3">
            <span className={cx('grid size-10 shrink-0 place-items-center rounded-xl [&>svg]:size-5', TONES[tone ?? 'none'])}>{icon}</span>
            <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">{title}</div>
                {value !== undefined && <div className="font-mono text-2xl font-semibold tabular-nums">{value}</div>}
            </div>
        </div>
        <p className="text-xs leading-relaxed text-muted">{blurb}</p>
        <div className="mt-auto">{action}</div>
    </div>
);

/** One line of the phone's summary: what it is, its count, and where tapping it goes. */
const Shortcut = ({ icon, label, value, tone, disabled, onClick }: { icon: ReactNode; label: string; value?: ReactNode; tone?: 'warn' | 'good'; disabled?: boolean; onClick: () => void }) => (
    <li className="border-t border-line first:border-t-0">
        <button type="button" disabled={disabled} onClick={onClick} className="flex min-h-12 w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-subtle disabled:opacity-50">
            <span className={cx('grid size-8 shrink-0 place-items-center rounded-lg [&>svg]:size-4', TONES[tone ?? 'none'])}>{icon}</span>
            <span className="min-w-0 flex-1 truncate">{label}</span>
            {value !== undefined && <span className="font-mono text-sm text-muted tabular-nums">{value}</span>}
            <ChevronRight className="size-4 shrink-0 text-muted" />
        </button>
    </li>
);

interface CatalogHomeProps {
    tree: CatalogTree;
    busy: boolean;
    /** The phone's version: the numbers in one row and the home's cards as a short list of links. */
    compact?: boolean;
    onOpenPage: (id: number) => void;
    onView: (view: 'missing' | 'duplicates' | 'generate') => void;
    onCreateFrontPage: () => void;
}

/**
 * The editor before a page is picked: the catalog at a glance - its tabs to jump into, the front
 * page (or making one), the furni it doesn't sell and the furni it sells twice - and generating a
 * whole new catalog. On a phone it is a short summary above the page tree, which lists the tabs.
 */
export const CatalogHome = ({ tree, busy, compact, onOpenPage, onView, onCreateFrontPage }: CatalogHomeProps) => {
    const missing = useUnoffered({ scope: 'missing', q: '', line: '', category: '', page: 0, size: 1 });
    const duplicates = useDuplicates();
    const front = tree.pages.find(x => x.layout === FRONT_PAGE_LAYOUT);
    const tabs = tree.pages.filter(x => x.parentId === tree.rootId).sort((a, b) => a.sortOrder - b.sortOrder);
    const offers = tree.pages.reduce((sum, x) => sum + x.offerCount, 0);
    const hidden = tree.pages.filter(x => x.display === 'invisible').length;
    const shownDuplicates = duplicates.data?.items.filter(x => x.offers.filter(o => o.shown).length > 1).length;
    const stats = [
        { label: 'Tabs', value: tabs.length },
        { label: 'Pages', value: tree.pages.length - 1 },
        { label: 'Offers', value: offers },
        { label: 'Hidden pages', short: 'Hidden', value: hidden, icon: <EyeOff className="size-3" /> },
    ];

    if (compact) {
        return (
            <section aria-label="The catalog at a glance" className="overflow-hidden rounded-xl border border-line bg-surface">
                <dl className="grid grid-cols-4 border-b border-line">
                    {stats.map(x => (
                        <div key={x.label} className="border-l border-line px-2 py-2 text-center first:border-l-0">
                            <dt className="truncate font-mono text-[10px] tracking-[0.08em] text-muted uppercase">{x.short ?? x.label}</dt>
                            <dd className="font-mono text-base font-semibold tabular-nums">{x.value.toLocaleString()}</dd>
                        </div>
                    ))}
                </dl>
                <ul>
                    {front
                        ? <Shortcut icon={<Star />} label={`Front page: ${front.localization}`} tone="good" onClick={() => onOpenPage(front.id)} />
                        : tree.canManage && <Shortcut icon={<Star />} label="Make a front page" tone="warn" disabled={busy} onClick={onCreateFrontPage} />}
                    <Shortcut
                        icon={<PackageSearch />}
                        label="Furni not in the catalog"
                        value={missing.data?.total.toLocaleString() ?? '…'}
                        tone={missing.data && missing.data.total > 0 ? 'warn' : undefined}
                        onClick={() => onView('missing')}
                    />
                    <Shortcut
                        icon={<Copy />}
                        label="Sold more than once"
                        value={duplicates.data ? duplicates.data.total.toLocaleString() : '…'}
                        tone={shownDuplicates ? 'warn' : undefined}
                        onClick={() => onView('duplicates')}
                    />
                    <Shortcut icon={<Wand2 />} label="Generate a catalog" onClick={() => onView('generate')} />
                </ul>
            </section>
        );
    }

    return (
        <div className="flex min-w-0 flex-col gap-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {stats.map(x => (
                    <div key={x.label} className="rounded-xl border border-line bg-surface px-3 py-2.5">
                        <div className="flex items-center gap-1 font-mono text-[10px] tracking-[0.08em] text-muted uppercase">{x.icon}{x.label}</div>
                        <div className="font-mono text-xl font-semibold tabular-nums">{x.value.toLocaleString()}</div>
                    </div>
                ))}
            </div>

            <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
                <Card
                    icon={<Star />}
                    title="Front page"
                    tone={front ? 'good' : 'warn'}
                    blurb={front ? `${front.localization} is where the catalogue opens, with the featured items and the voucher box.` : 'There is no front page: the catalogue opens on its first tab. Make one, then pick its featured items.'}
                    action={front
                        ? <Button variant="secondary" icon={<ArrowRight />} onClick={() => onOpenPage(front.id)}>Open it</Button>
                        : tree.canManage && <Button icon={<Star />} disabled={busy} onClick={onCreateFrontPage}>Make a front page</Button>}
                />
                <Card
                    icon={<PackageSearch />}
                    title="Furni not in the catalog"
                    value={missing.data?.total.toLocaleString() ?? '…'}
                    tone={missing.data && missing.data.total > 0 ? 'warn' : undefined}
                    blurb="Floor and wall items no offer sells. Find them by line or category, and put them on a page in one go."
                    action={<Button variant="secondary" icon={<ArrowRight />} onClick={() => onView('missing')}>Find them</Button>}
                />
                <Card
                    icon={<Copy />}
                    title="Sold more than once"
                    value={duplicates.data ? duplicates.data.total.toLocaleString() : '…'}
                    tone={shownDuplicates ? 'warn' : undefined}
                    blurb={shownDuplicates ? `${shownDuplicates} of them players can see on more than one page.` : 'Furni sold alone by more than one offer, with where each is.'}
                    action={<Button variant="secondary" icon={<ArrowRight />} onClick={() => onView('duplicates')}>Look at them</Button>}
                />
                <Card
                    icon={<Wand2 />}
                    title="Generate a catalog"
                    blurb="A whole catalog from the hotel's furni, pets, effects and songs, with tabs that make sense and the right layout and icon on every page."
                    action={<Button variant="secondary" icon={<ArrowRight />} onClick={() => onView('generate')}>Plan one</Button>}
                />
            </div>

            {tabs.length > 0 && (
                <section className="rounded-xl border border-line bg-surface p-3">
                    <Label as="h3" className="mb-2 px-1">Tabs</Label>
                    <ul className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-2">
                        {tabs.map(tab => (
                            <li key={tab.id}>
                                <button type="button" onClick={() => onOpenPage(tab.id)} className="flex w-full items-center gap-2.5 rounded-lg border border-line bg-canvas px-3 py-2.5 text-left transition hover:-translate-y-0.5 hover:border-accent hover:shadow-md">
                                    <PageIcon icon={tab.icon} className="size-6" />
                                    <span className="min-w-0 flex-1">
                                        <span className={cx('block truncate text-sm font-medium', tab.display === 'invisible' && 'text-muted')}>{tab.localization}</span>
                                        <span className="block text-[11px] text-muted">{plural(tree.pages.filter(x => x.parentId === tab.id).length, 'page')}</span>
                                    </span>
                                    {tab.display === 'invisible' && <EyeOff className="size-3.5 text-muted" />}
                                </button>
                            </li>
                        ))}
                    </ul>
                </section>
            )}
        </div>
    );
};

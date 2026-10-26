import { useMutation } from '@tanstack/react-query';
import { ArrowRightLeft, ChevronRight, EyeOff, Hammer, Layers, Replace, Sparkles, TriangleAlert, Wand2 } from 'lucide-react';
import { type ReactNode, useState } from 'react';

import { catalogCalls, type CatalogTree, type GeneratedPage, type GenerateMode, type GeneratePageEdit, type GeneratePlan, type GenerateRequest, type GenerateSection, useCatalogEdit } from '#/api/catalog';
import { ask } from '#/components/confirm';
import { ImagePicker } from '#/components/ImagePicker';
import { celebrate, toast, toastError } from '#/components/toast';
import { Button, EmptyState, ErrorNotice, Input, Label, Labeled, Stat, Switch, TextButton } from '#/components/ui';
import { cx } from '#/lib/cx';

import { type Price, PriceFields } from './fields';
import { CATALOG_ICON } from './images';
import { layoutOf } from './layouts';
import { PageIcon } from './PageTree';

const SECTIONS: { key: GenerateSection; title: string; blurb: string }[] = [
    { key: 'front', title: 'Front Page', blurb: 'Where the catalogue opens: the featured items and the voucher box.' },
    { key: 'club', title: 'Habbo Club', blurb: 'The club shop the client\'s club buttons open, and the club gifts.' },
    { key: 'furni', title: 'Furni', blurb: 'A page per furni line, a family of lines (every Christmas) in one folder; spaces, posters, trophies and badge displays built as they should be.' },
    { key: 'wired', title: 'Wired', blurb: 'Triggers, effects, conditions, add-ons, selectors and variables.' },
    { key: 'pets', title: 'Pets', blurb: 'A page per pet to buy, the accessories, and pet care furni.' },
    { key: 'extras', title: 'Extras', blurb: 'Avatar effects, trax songs and bots.' },
    { key: 'rares', title: 'Rares', blurb: 'Rare lines (hidden until you price them), limited and sold-out limited items.' },
    { key: 'groups', title: 'Groups', blurb: 'Starting a group, and the furni in a group\'s colours.' },
    { key: 'builders', title: 'Builders Club', blurb: 'The Builders Club\'s lines, shown only in its catalog.' },
];

const ModeCard = ({ active, icon, title, blurb, onClick }: { active: boolean; icon: ReactNode; title: string; blurb: string; onClick: () => void }) => (
    <button
        type="button"
        role="radio"
        aria-checked={active}
        onClick={onClick}
        className={cx('flex flex-1 items-start gap-3 rounded-xl border p-3 text-left transition', active ? 'border-accent bg-accent-soft' : 'border-line bg-canvas hover:border-muted/50')}
    >
        <span className={cx('mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg [&>svg]:size-4', active ? 'bg-accent text-on-accent' : 'bg-subtle text-muted')}>{icon}</span>
        <span className="min-w-0">
            <span className="block text-sm font-semibold">{title}</span>
            <span className="block text-xs leading-snug text-muted">{blurb}</span>
        </span>
    </button>
);

interface NodeProps {
    page: GeneratedPage;
    depth: number;
    edits: Map<string, GeneratePageEdit>;
    open: Set<string>;
    onToggle: (key: string) => void;
    onEdit: (key: string, change: Partial<GeneratePageEdit>) => void;
    onPickIcon: (key: string) => void;
    skippedAbove: boolean;
}

const totals = (page: GeneratedPage): { added: number; moved: number } =>
    page.children.reduce((sum, child) => {
        const inner = totals(child);

        return { added: sum.added + inner.added, moved: sum.moved + inner.moved };
    }, { added: page.newOffers, moved: page.movedOffers });

/** A planned page: its icon and title to change, its layout, what it sells, and leaving it out. */
const PlanNode = ({ page, depth, edits, open, onToggle, onEdit, onPickIcon, skippedAbove }: NodeProps) => {
    const edit = edits.get(page.key);
    const skipped = skippedAbove || !!edit?.skip;
    const title = edit?.title ?? page.title;
    const icon = edit?.icon ?? page.icon;
    const isOpen = open.has(page.key);
    const sum = totals(page);
    const [ editing, setEditing ] = useState(false);

    return (
        <li>
            <div className={cx('group flex min-h-10 items-center gap-1.5 rounded-lg pr-2 text-[13px] hover:bg-subtle', skipped && 'opacity-40', depth === 0 && 'bg-subtle/60 font-semibold')} style={{ paddingLeft: `${4 + depth * 18}px` }}>
                <button type="button" onClick={() => onToggle(page.key)} aria-label={isOpen ? 'Close' : 'Open'} className={cx('grid size-6 shrink-0 place-items-center rounded text-muted hover:text-ink', page.children.length === 0 && 'invisible')}>
                    <ChevronRight className={cx('size-3.5 transition-transform', isOpen && 'rotate-90')} />
                </button>
                <button type="button" onClick={() => onPickIcon(page.key)} title="Pick another icon" className="grid size-7 shrink-0 place-items-center rounded-md border border-transparent hover:border-accent hover:bg-surface">
                    <PageIcon icon={icon} />
                </button>
                {editing
                    ? (
                            <Input
                                autoFocus
                                defaultValue={title}
                                maxLength={50}
                                onBlur={(event) => {
                                    setEditing(false);
                                    onEdit(page.key, { title: event.target.value.trim() && event.target.value.trim() !== page.title ? event.target.value.trim() : null });
                                }}
                                onKeyDown={event => (event.key === 'Enter' || event.key === 'Escape') && event.currentTarget.blur()}
                                className="h-8 min-w-0 flex-1 text-[13px] sm:h-7"
                            />
                        )
                    : (
                            <button type="button" onClick={() => setEditing(true)} title="Rename it" className="min-w-0 flex-1 truncate text-left hover:underline">
                                {title}
                                {edit?.title && <span className="ml-1.5 text-[11px] font-normal text-accent">renamed</span>}
                            </button>
                        )}
                {page.display === 'invisible' && <span title="Starts hidden"><EyeOff className="size-3.5 shrink-0 text-muted" /></span>}
                {page.display === 'bc_only' && <span title="Builders Club only"><Hammer className="size-3.5 shrink-0 text-muted" /></span>}
                {page.name && <span className="hidden shrink-0 font-mono text-[10px] text-muted sm:inline" title="The name the client opens it by">{page.name}</span>}
                <span className="hidden w-32 shrink-0 truncate text-right text-[11px] font-normal text-muted md:inline" title={page.layout}>{layoutOf(page.layout).title}</span>
                <span className="shrink-0 text-right font-mono sm:w-24 text-[11px] font-normal text-muted tabular-nums">
                    {sum.added > 0 && <span className="text-ink">{sum.added.toLocaleString()} new</span>}
                    {sum.added > 0 && sum.moved > 0 && ' · '}
                    {sum.moved > 0 && <span className="text-accent">{sum.moved.toLocaleString()} moved</span>}
                </span>
                <input
                    type="checkbox"
                    checked={!skipped}
                    disabled={skippedAbove}
                    onChange={event => onEdit(page.key, { skip: !event.target.checked })}
                    title={skipped ? 'Left out' : 'Leave it out, with everything under it'}
                    aria-label={`Make ${title}`}
                    className="size-5 shrink-0 accent-accent sm:size-4"
                />
            </div>
            {isOpen && page.children.length > 0 && (
                <ul>
                    {page.children.map(child => (
                        <PlanNode key={child.key} page={child} depth={depth + 1} edits={edits} open={open} onToggle={onToggle} onEdit={onEdit} onPickIcon={onPickIcon} skippedAbove={skipped} />
                    ))}
                </ul>
            )}
        </li>
    );
};

const allKeys = (pages: GeneratedPage[]): string[] => pages.flatMap(x => [ x.key, ...allKeys(x.children) ]);

const find = (pages: GeneratedPage[], key: string): GeneratedPage | undefined => {
    for (const page of pages) {
        if (page.key === key)
            return page;

        const inner = find(page.children, key);

        if (inner)
            return inner;
    }

    return undefined;
};

/**
 * Generating a whole catalog from the hotel's own furniture, pets, effects and songs: tabs that
 * make sense, each page with the layout and icon it should have. Planned first and shown as the
 * tree it would be - every page renamed, re-iconed or left out as wanted - then made in one go,
 * one step to undo. Replacing puts the tabs there now, with everything under them, into one hidden
 * tab, and moves the offers the new pages sell onto them, prices and all.
 */
export const GenerateCatalog = ({ tree, onDone }: { tree: CatalogTree; onDone: () => void }) => {
    const [ mode, setMode ] = useState<GenerateMode>('replace');
    const [ sections, setSections ] = useState<Set<GenerateSection>>(() => new Set(SECTIONS.map(x => x.key)));
    const [ reuseOffers, setReuseOffers ] = useState(true);
    const [ maxPerPage, setMaxPerPage ] = useState(100);
    const [ price, setPrice ] = useState<Price>({ costCredits: 3, costCurrency: 0, currencyTypeId: null });
    const [ edits, setEdits ] = useState<Map<string, GeneratePageEdit>>(() => new Map());
    const [ open, setOpen ] = useState<Set<string>>(() => new Set());
    const [ picking, setPicking ] = useState<string | null>(null);
    const plan = useMutation({ mutationFn: (request: GenerateRequest) => catalogCalls.previewGenerate(request) });
    const generate = useCatalogEdit(catalogCalls.generate);
    const data: GeneratePlan | undefined = plan.data;

    const request = (): GenerateRequest => ({
        mode,
        sections: SECTIONS.map(x => x.key).filter(x => sections.has(x)),
        reuseOffers: mode === 'replace' && reuseOffers,
        maxPerPage,
        ...price,
        edits: [ ...edits.values() ],
    });

    // A change to the settings plans again from scratch; edits to the plan carry over by key.
    const settingsChanged = () => plan.reset();

    function changed<T>(set: (value: T) => void) {
        return (value: T) => {
            set(value);
            settingsChanged();
        };
    }

    const runPlan = () => plan.mutate({ ...request(), edits: [] }, {
        onSuccess: result => setOpen(new Set(result.tabs.map(x => x.key))),
    });

    const editPage = (key: string, change: Partial<GeneratePageEdit>) => setEdits((current) => {
        const next = new Map(current);
        const merged = { key, title: null, icon: null, skip: false, ...current.get(key), ...change };

        if (!merged.title && merged.icon === null && !merged.skip)
            next.delete(key);
        else
            next.set(key, merged);

        return next;
    });

    const apply = (button: HTMLElement) => {
        const question = mode === 'replace'
            ? { title: 'Generate a fresh catalog?', body: `The ${data?.archivedTabs ?? 0} tabs there now go, with everything under them, into a hidden tab. Nothing goes live until you publish, and it's one step to undo.` }
            : { title: 'Generate a catalog beside this one?', body: 'Its tabs start hidden. Nothing goes live until you publish, and it\'s one step to undo.' };

        ask({ ...question, confirm: 'Generate' }, () => {
            generate.mutate([ request() ], {
                onSuccess: (result) => {
                    celebrate(button);
                    toast(`Generated ${result.pages.toLocaleString()} pages: ${result.offersCreated.toLocaleString()} offers made, ${result.offersMoved.toLocaleString()} moved. Look it over, then publish.`);
                    plan.reset();
                    setEdits(new Map());
                    onDone();
                },
                onError: toastError,
            });
        });
    };

    const pickedPage = picking && data ? find(data.tabs, picking) : undefined;

    return (
        <div className="grid items-start gap-4 xl:grid-cols-[24rem_minmax(0,1fr)]">
            <div className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-4 xl:sticky xl:top-4">
                <div className="flex items-start gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent"><Wand2 className="size-5" /></span>
                    <div>
                        <h2 className="text-sm font-semibold">Generate a catalog</h2>
                        <p className="text-xs leading-relaxed text-muted">From the hotel's own furniture, pets, effects and songs: tabs that make sense, each page with the layout and icon it should have. You look over the plan before anything is made.</p>
                    </div>
                </div>

                <div role="radiogroup" aria-label="Mode" className="flex flex-col gap-2">
                    <ModeCard active={mode === 'replace'} icon={<Replace />} title="Replace this catalog" blurb="The tabs there now move into one hidden tab; nothing is deleted." onClick={() => changed(setMode)('replace')} />
                    <ModeCard active={mode === 'alongside'} icon={<ArrowRightLeft />} title="Build beside it" blurb="New tabs start hidden after the old; switch when they're ready." onClick={() => changed(setMode)('alongside')} />
                </div>

                <section className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                        <Label as="h3">Tabs</Label>
                        <TextButton onClick={() => changed(setSections)(new Set(sections.size === SECTIONS.length ? [] : SECTIONS.map(x => x.key)))}>
                            {sections.size === SECTIONS.length ? 'none' : 'all'}
                        </TextButton>
                    </div>
                    {SECTIONS.map(x => (
                        <label key={x.key} className="flex cursor-pointer items-start gap-2.5 rounded-lg px-1.5 py-1.5 hover:bg-subtle">
                            <input
                                type="checkbox"
                                checked={sections.has(x.key)}
                                onChange={(event) => {
                                    const next = new Set(sections);

                                    if (event.target.checked)
                                        next.add(x.key);
                                    else
                                        next.delete(x.key);

                                    setSections(next);
                                    settingsChanged();
                                }}
                                className="mt-0.5 size-4 shrink-0 accent-accent"
                            />
                            <span className="min-w-0">
                                <span className="block text-sm">{x.title}</span>
                                <span className="block text-xs leading-snug text-muted">{x.blurb}</span>
                            </span>
                        </label>
                    ))}
                </section>

                {mode === 'replace' && (
                    <Switch label="Move the offers there now" hint="Furni already on sale keeps its price and moves to its new page, instead of being sold twice." checked={reuseOffers} onChange={changed(setReuseOffers)} />
                )}
                <Labeled label="Offers per page, at most" hint="A furni line with more is spread over numbered pages.">
                    <Input type="number" min={20} max={500} value={maxPerPage} onChange={event => changed(setMaxPerPage)(Math.min(500, Math.max(20, Math.floor(Number(event.target.value) || 100))))} className="w-28 font-mono" />
                </Labeled>
                <Labeled label="New offers cost">
                    <PriceFields tree={tree} value={price} onChange={changed(setPrice)} />
                </Labeled>

                {plan.error && <ErrorNotice error={plan.error} />}
                <Button icon={<Sparkles />} disabled={sections.size === 0 || plan.isPending} onClick={runPlan}>
                    {plan.isPending ? 'Planning…' : data ? 'Plan again' : 'Plan it'}
                </Button>
            </div>

            <div className="flex min-w-0 flex-col gap-3">
                {!data && (
                    <EmptyState framed icon={<Layers className="text-accent" />}>
                        Pick what to generate and plan it. The whole tree shows here - rename a page, give it another icon, or leave it out - before anything is made.
                    </EmptyState>
                )}
                {data && (
                    <>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                            {[
                                { label: 'Tabs', value: data.tabs.length },
                                { label: 'Pages', value: data.pages },
                                { label: 'Offers made', value: data.newOffers },
                                { label: 'Offers moved', value: data.movedOffers },
                            ].map(x => <Stat key={x.label} label={x.label} value={x.value.toLocaleString()} compact />)}
                        </div>
                        {data.warnings.length > 0 && (
                            <ul className="flex flex-col gap-1.5">
                                {data.warnings.map(x => (
                                    <li key={x} className="flex items-start gap-2 rounded-lg bg-warn-soft px-3 py-2 text-xs">
                                        <TriangleAlert className="mt-px size-3.5 shrink-0 text-warn" />
                                        {x}
                                    </li>
                                ))}
                            </ul>
                        )}
                        <div className="rounded-xl border border-line bg-surface">
                            <div className="flex items-center gap-2 border-b border-line px-3 py-2 text-xs text-muted">
                                <span className="flex-1">Click a title to rename it, an icon to change it; untick a page to leave it out.</span>
                                <TextButton onClick={() => setOpen(new Set(allKeys(data.tabs)))}>open all</TextButton>
                                <TextButton onClick={() => setOpen(new Set())}>close all</TextButton>
                            </div>
                            <ul className="p-1.5">
                                {data.tabs.map(tab => (
                                    <PlanNode
                                        key={tab.key}
                                        page={tab}
                                        depth={0}
                                        edits={edits}
                                        open={open}
                                        onToggle={key => setOpen((current) => {
                                            const next = new Set(current);

                                            if (!next.delete(key))
                                                next.add(key);

                                            return next;
                                        })}
                                        onEdit={editPage}
                                        onPickIcon={setPicking}
                                        skippedAbove={false}
                                    />
                                ))}
                            </ul>
                        </div>
                        {tree.canManage && (
                            <div className="sticky bottom-3 z-20 flex flex-wrap items-center gap-3 rounded-xl border border-accent/50 bg-surface/95 p-3 shadow-xl backdrop-blur">
                                <span className="mr-auto text-xs text-muted">
                                    {edits.size > 0 && `${edits.size} ${edits.size === 1 ? 'change' : 'changes'} to the plan. `}
                                    Nothing goes live until you publish.
                                </span>
                                <Button icon={<Wand2 />} disabled={generate.isPending} onClick={event => apply(event.currentTarget)}>
                                    {generate.isPending ? 'Generating…' : mode === 'replace' ? 'Generate and replace' : 'Generate beside it'}
                                </Button>
                            </div>
                        )}
                    </>
                )}
            </div>
            <ImagePicker
                open={!!pickedPage}
                title="Pick an icon"
                accept={CATALOG_ICON}
                value={String(pickedPage ? edits.get(pickedPage.key)?.icon ?? pickedPage.icon : 0)}
                onPick={(picked) => {
                    const icon = Number(picked) || 0;

                    if (picking) editPage(picking, { icon: pickedPage && icon === pickedPage.icon ? null : icon });
                }}
                onClose={() => setPicking(null)}
                none="No icon"
            />
        </div>
    );
};

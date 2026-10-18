import { CheckSquare, EyeOff, PackagePlus, PackageSearch, Square, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { type AuditFacet, type AuditFurni, catalogCalls, type CatalogTree, type UnofferedScope, useCatalogEdit, useUnoffered } from '#/api/catalog';
import { Pagination } from '#/components/Pagination';
import { SearchInput } from '#/components/SearchInput';
import { toast, toastError } from '#/components/toast';
import { Button, EmptyState, ErrorNotice, IconButton, Input, Label, Loading, Segmented, TextButton } from '#/components/ui';
import { cx } from '#/lib/cx';

import { PageSelect, type Price, PriceFields } from './fields';
import { ProductIcon } from './ProductIcon';

const PAGE_SIZE = 120;

/** A line or category name for a list: the empty one is the furni that have none. */
const facetLabel = (value: string, none: string) => (value ? value.replaceAll('_', ' ') : none);

const FacetList = ({ title, facets, value, none, onChange }: { title: string; facets: AuditFacet[]; value: string; none: string; onChange: (value: string) => void }) => {
    const [ filter, setFilter ] = useState('');
    const shown = facets.filter(x => !filter || x.value.toLowerCase().includes(filter.toLowerCase()));

    return (
        <section className="flex min-h-0 flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
                <Label as="h3">{title}</Label>
                {value !== '' && <TextButton onClick={() => onChange('')}>all</TextButton>}
            </div>
            {facets.length > 8 && <Input value={filter} onChange={event => setFilter(event.target.value)} placeholder={`Find a ${title.toLowerCase().replace(/s$/, '')}`} className="h-9 w-full text-xs sm:h-8" />}
            <ul className="flex max-h-64 flex-col overflow-y-auto">
                {shown.map(x => (
                    <li key={x.value}>
                        <button
                            type="button"
                            onClick={() => onChange(value === x.value ? '' : x.value)}
                            className={cx('flex min-h-9 w-full items-center gap-2 rounded-md px-2 text-left text-[13px] sm:min-h-7', value === x.value ? 'bg-accent-soft text-accent' : 'hover:bg-subtle')}
                        >
                            <span className={cx('min-w-0 flex-1 truncate', !x.value && 'italic text-muted')}>{facetLabel(x.value, none)}</span>
                            <span className="font-mono text-[11px] text-muted tabular-nums">{x.count.toLocaleString()}</span>
                        </button>
                    </li>
                ))}
            </ul>
        </section>
    );
};

const FurniTile = ({ furni, picked, onToggle }: { furni: AuditFurni; picked: boolean; onToggle: () => void }) => (
    <li>
        <button
            type="button"
            onClick={onToggle}
            aria-pressed={picked}
            title={`${furni.publicName ?? furni.name} (${furni.name}, #${furni.id})`}
            className={cx(
                'relative flex h-full w-full flex-col items-center gap-1 rounded-xl border p-2 text-center transition',
                picked ? 'border-accent bg-accent-soft shadow-[0_0_0_2px_var(--color-accent-soft)]' : 'border-line bg-canvas hover:-translate-y-0.5 hover:border-muted/50 hover:shadow-md',
            )}
        >
            <span className="absolute top-1.5 left-1.5 text-accent">{picked ? <CheckSquare className="size-4" /> : <Square className="size-4 text-muted/40" />}</span>
            <ProductIcon type={furni.type} name={furni.name} className="size-12" />
            <span className="line-clamp-2 w-full text-[11px] leading-tight">{furni.publicName ?? furni.name}</span>
            <span className="w-full truncate font-mono text-[10px] text-muted">{furni.name}</span>
        </button>
    </li>
);

interface MissingFurniProps {
    tree: CatalogTree;
    /** The page to add them to, to start with: the page open in the editor. */
    pageId: number | null;
    onOpenPage: (id: number) => void;
    /** Called once furni are added, with how many. */
    onAdded?: (count: number) => void;
}

/**
 * The furni the catalog doesn't sell: in no offer at all, or only where players can't see it.
 * Narrowed by name, furni line and furnidata category; picked by the tile, a page of them at a
 * time; and put on a page in one go, an offer each at one price - one step to undo.
 */
export const MissingFurni = ({ tree, pageId, onOpenPage, onAdded }: MissingFurniProps) => {
    const [ scope, setScope ] = useState<UnofferedScope>('missing');
    const [ text, setText ] = useState('');
    const [ q, setQ ] = useState('');
    const [ line, setLine ] = useState('');
    const [ category, setCategory ] = useState('');
    const [ page, setPage ] = useState(0);
    const [ picked, setPicked ] = useState<Map<number, AuditFurni>>(() => new Map());
    const [ target, setTarget ] = useState<number | null>(pageId);
    const [ price, setPrice ] = useState<Price>({ costCredits: 3, costCurrency: 0, currencyTypeId: null });
    const result = useUnoffered({ scope, q, line, category, page, size: PAGE_SIZE });
    const add = useCatalogEdit(catalogCalls.addFurni);
    const data = result.data;

    // The search waits for a pause in typing.
    useEffect(() => {
        const timer = setTimeout(() => {
            setQ(text.trim());
            setPage(0);
        }, 250);

        return () => clearTimeout(timer);
    }, [ text ]);

    const filterLine = (value: string) => {
        setLine(value);
        setPage(0);
    };

    const filterCategory = (value: string) => {
        setCategory(value);
        setPage(0);
    };

    const clearFilters = () => {
        setLine('');
        setCategory('');
        setPage(0);
    };

    const toggle = (furni: AuditFurni) => setPicked((current) => {
        const next = new Map(current);

        if (!next.delete(furni.id))
            next.set(furni.id, furni);

        return next;
    });

    const items = data?.items ?? [];
    const allPicked = items.length > 0 && items.every(x => picked.has(x.id));
    const targetPage = tree.pages.find(x => x.id === target);

    const submit = () => {
        if (!target || picked.size === 0)
            return;

        add.mutate([ target, { definitionIds: [ ...picked.keys() ], ...price, clubLevel: 0, canGift: true, visible: true } ], {
            onSuccess: (done) => {
                toast(`Added ${done.done} furni to ${targetPage?.localization ?? 'the page'}. Publish to put them live.`);
                setPicked(new Map());
                onAdded?.(done.done);
            },
            onError: toastError,
        });
    };

    return (
        <div className="grid items-start gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
            <aside className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-3 lg:sticky lg:top-4">
                <Segmented
                    label="Which furni"
                    value={scope}
                    onChange={(value) => {
                        setScope(value as UnofferedScope);
                        setLine('');
                        setCategory('');
                        setPage(0);
                    }}
                    options={[ { value: 'missing', label: 'No offer' }, { value: 'hidden', label: 'Only hidden' } ]}
                />
                <p className="text-xs leading-relaxed text-muted">
                    {scope === 'missing'
                        ? 'Floor and wall items no offer sells. Patterns, posters, songs and pets are left out: their builders sell them.'
                        : 'Furni whose every offer is hidden, or on a page players can\'t reach.'}
                </p>
                <SearchInput value={text} onValueChange={setText} placeholder="Name or class name" aria-label="Find furni" />
                {data && (
                    <>
                        <FacetList title="Lines" facets={data.lines} value={line} none="no line" onChange={filterLine} />
                        <FacetList title="Categories" facets={data.categories} value={category} none="no category" onChange={filterCategory} />
                    </>
                )}
            </aside>

            <div className="flex min-w-0 flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="flex items-center gap-2 text-sm font-medium">
                        {scope === 'missing' ? <PackageSearch className="size-4 text-accent" /> : <EyeOff className="size-4 text-accent" />}
                        {data ? `${data.total.toLocaleString()} furni` : '…'}
                        {(line || category) && (
                            <span className="flex items-center gap-1 rounded-full bg-subtle px-2 py-0.5 text-xs text-muted">
                                {[ line && facetLabel(line, 'no line'), category && facetLabel(category, 'no category') ].filter(Boolean).join(' · ')}
                                <button type="button" onClick={clearFilters} aria-label="Clear the filters" className="hover:text-ink"><X className="size-3" /></button>
                            </span>
                        )}
                    </span>
                    {items.length > 0 && tree.canManage && (
                        <TextButton
                            onClick={() => setPicked((current) => {
                                const next = new Map(current);

                                for (const x of items) {
                                    if (allPicked)
                                        next.delete(x.id);
                                    else
                                        next.set(x.id, x);
                                }

                                return next;
                            })}
                        >
                            {allPicked ? 'Unpick these' : `Pick these ${items.length}`}
                        </TextButton>
                    )}
                    <span className="ml-auto">
                        {data && <Pagination offset={page * PAGE_SIZE} limit={PAGE_SIZE} total={data.total} onChange={offset => setPage(Math.floor(offset / PAGE_SIZE))} />}
                    </span>
                </div>

                {result.error && <ErrorNotice error={result.error} />}
                {result.isPending && <Loading />}
                {data && items.length === 0 && (
                    <EmptyState framed icon={<PackageSearch className="text-good" />}>
                        {scope === 'missing' ? 'Every furni that matches is in the catalog.' : 'Nothing that matches is sold only out of sight.'}
                    </EmptyState>
                )}
                <ul className={cx('grid grid-cols-[repeat(auto-fill,minmax(7rem,1fr))] gap-2 transition-opacity', result.isFetching && !result.isPending && 'opacity-60')}>
                    {items.map(x => <FurniTile key={x.id} furni={x} picked={picked.has(x.id)} onToggle={() => tree.canManage && toggle(x)} />)}
                </ul>

                {tree.canManage && picked.size > 0 && (
                    <div className="sticky bottom-3 z-20 flex flex-wrap items-center gap-2 rounded-xl border border-accent/50 bg-surface/95 p-2.5 shadow-xl backdrop-blur">
                        <span className="flex items-center gap-1.5 px-1 text-sm font-medium">
                            {picked.size} picked
                            <IconButton label="Unpick them all" icon={<X />} small onClick={() => setPicked(new Map())} />
                        </span>
                        <span className="text-xs text-muted">add to</span>
                        <PageSelect tree={tree} value={target} onChange={setTarget} className="flex-1 sm:w-56 sm:flex-none" />
                        {target && <TextButton onClick={() => onOpenPage(target)}>open</TextButton>}
                        <span className="text-xs text-muted">at</span>
                        <PriceFields tree={tree} value={price} onChange={setPrice} />
                        <Button icon={<PackagePlus />} disabled={!target || add.isPending || (price.costCurrency > 0 && !price.currencyTypeId)} onClick={submit} className="ml-auto">
                            {add.isPending ? 'Adding…' : `Add ${picked.size}`}
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
};

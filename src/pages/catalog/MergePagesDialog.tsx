import { Merge } from 'lucide-react';
import { useState } from 'react';

import { catalogCalls, type CatalogTree, useCatalogEdit, usePageMergePlan } from '#/api/catalog';
import { Modal } from '#/components/Modal';
import { toast, toastError } from '#/components/toast';
import { Button, ErrorNotice, Label, Loading } from '#/components/ui';
import { cx } from '#/lib/cx';

import { PageSelect } from './fields';
import { priceOf } from './offers';

const SHOWN_IN: Record<string, string> = {
    regular: 'the normal catalogue',
    bc_only: 'the Builders Club catalogue',
    both: 'both catalogues',
    invisible: 'neither catalogue',
};

const plural = (count: number, one: string, many: string) => `${count.toLocaleString()} ${count === 1 ? one : many}`;

/** The titles of a page and those above it, from the tab down; the root left out. */
const pathOf = (tree: CatalogTree, pageId: number) => {
    const titles: string[] = [];
    const seen = new Set<number>();

    for (let page = tree.pages.find(x => x.id === pageId); page && page.parentId !== null && !seen.has(page.id); page = tree.pages.find(x => x.id === page?.parentId)) {
        seen.add(page.id);
        titles.unshift(page.localization);
    }

    return titles.join(' / ');
};

const PageChoice = ({ tree, label, pageIds, value, onChange }: { tree: CatalogTree; label: string; pageIds: number[]; value: number; onChange: (id: number) => void }) => (
    <div className="flex flex-col gap-1.5">
        <Label as="h3">{label}</Label>
        <div role="radiogroup" aria-label={label} className="flex flex-col gap-1.5">
            {pageIds.map(id => (
                <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={value === id}
                    onClick={() => onChange(id)}
                    className={cx(
                        'flex min-h-10 flex-col items-start rounded-lg border px-3 py-1.5 text-left transition',
                        value === id ? 'border-accent bg-accent-soft' : 'border-line hover:border-muted/50',
                    )}
                >
                    <span className={cx('text-[13px] font-medium', value === id && 'text-accent')}>{tree.pages.find(x => x.id === id)?.localization ?? `Page ${id}`}</span>
                    <span className="text-[11px] text-muted">{pathOf(tree, id)} · page {id} · {plural(tree.pages.find(x => x.id === id)?.offerCount ?? 0, 'offer', 'offers')}</span>
                </button>
            ))}
        </div>
    </div>
);

interface MergePagesDialogProps {
    tree: CatalogTree;
    /** The pages to merge; with one, the editor picks the page to merge it with. */
    pageIds: number[];
    /** The page kept, to start with. */
    keepId: number;
    onClose: () => void;
    onMerged?: (keepId: number) => void;
}

/**
 * Pages made one: which of them stays (its place, title and layout), and whose offer stays where
 * two of them sell the same thing - the others' copies are deleted. What it would do is listed
 * before it is done, each thing sold twice with the price that stays and those that go. One step
 * to undo.
 */
export const MergePagesDialog = ({ tree, pageIds, keepId, onClose, onMerged }: MergePagesDialogProps) => {
    const [ other, setOther ] = useState<number | null>(null);
    const [ keep, setKeep ] = useState(keepId);
    const [ priority, setPriority ] = useState(keepId);
    const merge = useCatalogEdit(catalogCalls.mergePages);
    const pages = pageIds.length === 1 ? (other === null ? pageIds : [ pageIds[0]!, other ]) : pageIds;
    const ready = pages.length > 1 && pages.includes(keep) && pages.includes(priority);
    const plan = usePageMergePlan(ready ? keep : null, pages, priority);
    const title = (id: number) => tree.pages.find(x => x.id === id)?.localization ?? `page ${id}`;

    const pickOther = (id: number | null) => {
        setOther(id);

        // A page newly picked can't be the one kept or given priority unless it is picked.
        if (keep !== pageIds[0])
            setKeep(pageIds[0]!);

        if (priority !== pageIds[0])
            setPriority(pageIds[0]!);
    };

    const submit = () => merge.mutate([ keep, pages, priority ], {
        onSuccess: (result) => {
            toast(`Merged into ${title(keep)}: ${plural(result.offersMoved, 'offer', 'offers')} moved, ${plural(result.offersDropped, 'offer', 'offers')} sold twice deleted, ${plural(result.pagesMoved, 'page', 'pages')} moved under it.`);
            onMerged?.(keep);
            onClose();
        },
        onError: toastError,
    });

    const data = ready ? plan.data : undefined;

    return (
        <Modal title={<span className="flex items-center gap-2"><Merge className="size-4 text-accent" />Merge pages</span>} open onClose={onClose} className="sm:h-fit! sm:max-w-2xl">
            <div className="flex flex-col gap-4 p-5">
                {pageIds.length === 1 && (
                    <div className="flex flex-col gap-1.5">
                        <Label as="h3">{`Merge ${title(pageIds[0]!)} with`}</Label>
                        <PageSelect tree={tree} value={other} onChange={id => pickOther(id === pageIds[0] ? null : id)} placeholder="Pick the other page…" />
                    </div>
                )}
                {pages.length > 1 && (
                    <div className="grid gap-4 sm:grid-cols-2">
                        <PageChoice tree={tree} label="Keep the page" pageIds={pages} value={keep} onChange={setKeep} />
                        <PageChoice tree={tree} label="Where two sell the same, keep the offer from" pageIds={pages} value={priority} onChange={setPriority} />
                    </div>
                )}
                {ready && plan.error && <ErrorNotice error={plan.error} />}
                {ready && plan.isPending && <Loading />}
                {data && (
                    <div className={cx('flex flex-col gap-3 transition-opacity', plan.isFetching && 'opacity-60')}>
                        <p className="text-sm">
                            {`${title(keep)} takes ${plural(data.offersMoved, 'offer', 'offers')} and ${plural(data.pagesMoved, 'page', 'pages')} from the others, `}
                            {`${plural(data.offersDropped, 'offer', 'offers')} sold twice ${data.offersDropped === 1 ? 'is' : 'are'} deleted, and ${plural(data.pagesDeleted, 'page', 'pages')} ${data.pagesDeleted === 1 ? 'goes' : 'go'}. `}
                            {`It is shown in ${SHOWN_IN[data.display] ?? data.display}.`}
                        </p>
                        {data.duplicates.length > 0 && (
                            <div className="overflow-hidden rounded-xl border border-line">
                                <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-4 border-b border-line bg-subtle/50 px-3 py-1.5 text-[11px] font-semibold text-muted">
                                    <span>Sold twice</span>
                                    <span className="text-right">Stays</span>
                                    <span className="text-right">Deleted</span>
                                </div>
                                <ul className="max-h-72 divide-y divide-line overflow-y-auto">
                                    {data.duplicates.slice(0, 200).map(x => (
                                        <li key={x.kept.offerId} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-4 px-3 py-1.5 text-xs">
                                            <span className="truncate font-mono">{x.name}</span>
                                            <span className="text-right" title={`Offer ${x.kept.offerId} on ${title(x.kept.pageId)}`}>
                                                <span className="font-mono tabular-nums text-good">{priceOf(x.kept, tree)}</span>
                                                <span className="block text-[10px] text-muted">{title(x.kept.pageId)}</span>
                                            </span>
                                            <span className="text-right">
                                                {x.dropped.map(d => (
                                                    <span key={d.offerId} className="block" title={`Offer ${d.offerId} on ${title(d.pageId)}`}>
                                                        <span className="font-mono tabular-nums text-muted line-through">{priceOf(d, tree)}</span>
                                                        <span className="block text-[10px] text-muted">{title(d.pageId)}</span>
                                                    </span>
                                                ))}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                                {data.duplicates.length > 200 && <p className="border-t border-line px-3 py-1.5 text-center text-xs text-muted">Showing 200 of {data.duplicates.length}.</p>}
                            </div>
                        )}
                        <p className="text-xs text-muted">An offer something keeps (a club gift, a limited series) is moved instead of deleted. You can undo the merge.</p>
                    </div>
                )}
                <div className="flex justify-end gap-2 border-t border-line pt-3">
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button icon={<Merge />} disabled={!data || merge.isPending} onClick={submit}>
                        {merge.isPending ? 'Merging…' : 'Merge'}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

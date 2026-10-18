import { CheckCircle2, Copy, EyeOff, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { catalogCalls, type CatalogTree, type Duplicate, type DuplicateOffer, useCatalogEdit, useDuplicates } from '#/api/catalog';
import { ask } from '#/components/confirm';
import { SearchInput } from '#/components/SearchInput';
import { toast, toastError } from '#/components/toast';
import { Button, EmptyState, ErrorNotice, IconButton, Loading, Switch, TextButton } from '#/components/ui';
import { cx } from '#/lib/cx';

import { priceOf } from './offers';
import { ProductIcon } from './ProductIcon';

/** The offer kept when the rest go: the first players see, else the first. */
const keeperOf = (duplicate: Duplicate) => duplicate.offers.find(x => x.shown) ?? duplicate.offers[0]!;

const OfferRow = ({ tree, offer, busy, onOpen, onDelete, onKeepOnly }: { tree: CatalogTree; offer: DuplicateOffer; busy: boolean; onOpen: () => void; onDelete: () => void; onKeepOnly: () => void }) => (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
        <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left hover:text-accent" title="Open it in the editor">
            <span className="block truncate text-[13px] font-medium">{offer.pageTitle}</span>
            <span className="block truncate text-[11px] text-muted">{offer.pagePath || 'Tab'} · offer {offer.offerId}</span>
        </button>
        {!offer.shown && (
            <span className="flex items-center gap-1 rounded-full bg-subtle px-2 py-0.5 text-[11px] text-muted" title={offer.visible ? 'On a page players can\'t reach' : 'The offer is hidden'}>
                <EyeOff className="size-3" />
                {offer.visible ? 'page hidden' : 'hidden'}
            </span>
        )}
        <span className="font-mono text-xs tabular-nums sm:w-28 sm:text-right">{priceOf(offer, tree)}</span>
        {tree.canManage && (
            <span className="flex items-center gap-1">
                <TextButton disabled={busy} onClick={onKeepOnly} title="Delete the other offers of it" className="min-h-10 px-2 sm:min-h-0">
                    Keep only this
                </TextButton>
                <IconButton label={`Delete offer ${offer.offerId}`} icon={<Trash2 />} tone="bad" small disabled={busy} onClick={onDelete} />
            </span>
        )}
    </li>
);

/**
 * Furni sold alone by more than one offer, as the duplicates audit lists them: each with where its
 * offers are, what they cost and whether players see them; an offer opened in the editor, deleted,
 * or kept while the rest go - and all of them at once, keeping the first players see of each. Club
 * gifts and bundles aren't counted: they're meant to repeat what is sold elsewhere.
 */
export const Duplicates = ({ tree, onOpen }: { tree: CatalogTree; onOpen: (pageId: number, offerId: number) => void }) => {
    const duplicates = useDuplicates();
    const remove = useCatalogEdit(catalogCalls.deleteOffers);
    const [ filter, setFilter ] = useState('');
    const [ shownOnly, setShownOnly ] = useState(false);
    const needle = filter.trim().toLowerCase();
    const all = duplicates.data?.items ?? [];
    const shown = all.filter(x =>
        (!needle || x.furni.name.toLowerCase().includes(needle) || (x.furni.publicName ?? '').toLowerCase().includes(needle))
        && (!shownOnly || x.offers.filter(o => o.shown).length > 1));

    const deleteOffers = (ids: number[], what: string) => remove.mutate([ ids ], {
        onSuccess: (result) => {
            toast(result.failures.length === 0
                ? `Deleted ${result.done} ${result.done === 1 ? 'offer' : 'offers'}${what}.`
                : `Deleted ${result.done}; ${result.failures.length} couldn't be: ${result.failures[0]!.error}`);
        },
        onError: toastError,
    });

    const resolveAll = () => {
        const ids = shown.flatMap(x => x.offers.filter(o => o !== keeperOf(x)).map(o => o.offerId));

        ask({
            title: `Delete ${ids.length} offers, keeping one of each of the ${shown.length} furni (the first players see)?`,
            body: 'You can undo it.',
            confirm: 'Delete',
        }, () => deleteOffers(ids, ', one of each furni kept'));
    };

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface p-3">
                <span className="flex items-center gap-2 text-sm font-medium">
                    <Copy className="size-4 text-accent" />
                    {duplicates.data ? `${all.length.toLocaleString()} furni sold more than once` : '…'}
                </span>
                <SearchInput value={filter} onValueChange={setFilter} placeholder="Find furni" className="w-full sm:w-56" />
                <Switch label="Only where players see two" checked={shownOnly} onChange={setShownOnly} className="min-h-9" />
                {tree.canManage && shown.length > 0 && (
                    <Button variant="secondary" icon={<Trash2 />} disabled={remove.isPending} onClick={resolveAll} className="ml-auto">
                        Keep one of each ({shown.length})
                    </Button>
                )}
            </div>

            {duplicates.error && <ErrorNotice error={duplicates.error} />}
            {duplicates.isPending && <Loading />}
            {duplicates.data && shown.length === 0 && (
                <EmptyState framed icon={<CheckCircle2 className="text-good" />}>
                    {all.length === 0 ? 'No furni is sold by more than one offer.' : 'None of them matches.'}
                </EmptyState>
            )}

            <ul className="grid gap-3 xl:grid-cols-2">
                {shown.slice(0, 200).map(duplicate => (
                    <li key={`${duplicate.furni.id}:${duplicate.extraParam ?? ''}`} className="overflow-hidden rounded-xl border border-line bg-surface">
                        <div className="flex items-center gap-3 border-b border-line bg-subtle/50 px-3 py-2">
                            <ProductIcon type={duplicate.furni.type} name={duplicate.furni.name} className="size-9" />
                            <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-semibold">{duplicate.furni.publicName ?? duplicate.furni.name}</div>
                                <div className="truncate font-mono text-[11px] text-muted">
                                    {duplicate.furni.name}
                                    {duplicate.extraParam && ` · ${duplicate.extraParam}`}
                                </div>
                            </div>
                            <span className={cx('rounded-full px-2 py-0.5 font-mono text-[11px] font-semibold', duplicate.offers.filter(x => x.shown).length > 1 ? 'bg-warn-soft text-warn' : 'bg-subtle text-muted')}>
                                ×{duplicate.offers.length}
                            </span>
                        </div>
                        <ul className="divide-y divide-line">
                            {duplicate.offers.map(offer => (
                                <OfferRow
                                    key={offer.offerId}
                                    tree={tree}
                                    offer={offer}
                                    busy={remove.isPending}
                                    onOpen={() => onOpen(offer.pageId, offer.offerId)}
                                    onDelete={() => deleteOffers([ offer.offerId ], '')}
                                    onKeepOnly={() => deleteOffers(duplicate.offers.filter(x => x !== offer).map(x => x.offerId), `, offer ${offer.offerId} kept`)}
                                />
                            ))}
                        </ul>
                    </li>
                ))}
            </ul>
            {shown.length > 200 && <p className="text-center text-xs text-muted">Showing 200 of {shown.length}; find furni to narrow it down.</p>}
        </div>
    );
};

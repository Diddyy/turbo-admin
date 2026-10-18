import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Crown, EyeOff, Gift, Layers } from 'lucide-react';

import type { CatalogOffer, CatalogTree } from '#/api/catalog';
import { cx } from '#/lib/cx';

import { givesOf, offerDragId, priceOf } from './offers';
import { ProductIcon } from './ProductIcon';

/** A tile's face: the first product's picture, how many things are in it, the price, and its marks. */
export const OfferFace = ({ offer, tree }: { offer: CatalogOffer; tree: CatalogTree }) => {
    const first = offer.products[0];
    const limited = offer.products.find(x => x.limited)?.limited;

    return (
        <>
            <span className="relative grid h-14 w-full place-items-center">
                {first && <ProductIcon type={first.type} name={first.definitionName ?? first.extraParam} className={cx('size-12', !offer.visible && 'opacity-40 grayscale')} />}
                {offer.products.length > 1 && (
                    <span className="absolute right-0 bottom-0 flex items-center gap-0.5 rounded-full bg-accent px-1.5 text-[10px] font-semibold text-on-accent" title={`${offer.products.length} things`}>
                        <Layers className="size-2.5" />
                        {offer.products.length}
                    </span>
                )}
                {(first?.quantity ?? 1) > 1 && offer.products.length === 1 && (
                    <span className="absolute right-0 bottom-0 rounded-full bg-ink/80 px-1.5 text-[10px] font-semibold text-canvas">×{first!.quantity}</span>
                )}
                <span className="absolute top-0 left-0 flex flex-col gap-0.5">
                    {!offer.visible && <EyeOff className="size-3.5 text-muted" aria-label="hidden" />}
                    {offer.clubLevel > 0 && <Crown className={cx('size-3.5', offer.clubLevel === 2 ? 'text-vip' : 'text-coin')} aria-label={offer.clubLevel === 2 ? 'VIP' : 'club'} />}
                    {offer.isClubGift && <Gift className="size-3.5 text-accent" aria-label="club gift" />}
                </span>
                {limited && (
                    <span className="absolute top-0 right-0 rounded bg-coin px-1 font-mono text-[9px] font-bold text-black" title={`${limited.remaining} of ${limited.total} left`}>
                        LTD
                    </span>
                )}
            </span>
            <span className="w-full truncate text-center text-[11px] leading-4 text-muted" title={givesOf(offer)}>{givesOf(offer)}</span>
            <span className={cx('w-full truncate text-center font-mono text-[11px] leading-4', offer.costCredits + offer.costCurrency === 0 ? 'text-good' : 'text-ink')}>
                {offer.isClubGift ? 'gift' : priceOf(offer, tree)}
            </span>
        </>
    );
};

/**
 * An offer on the page, as a tile in the client's grid. Clicking opens it; dragging puts it elsewhere
 * on the page, or onto another page in the tree.
 */
export const OfferTile = ({ offer, tree, selected, flagged, onSelect }: { offer: CatalogOffer; tree: CatalogTree; selected: boolean; flagged?: boolean; onSelect: () => void }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: offerDragId(offer.id),
        data: { kind: 'offer', id: offer.id },
        disabled: !tree.canManage,
    });

    return (
        <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className="list-none">
            <button
                type="button"
                {...attributes}
                {...listeners}
                onClick={onSelect}
                aria-pressed={selected}
                aria-label={`Offer ${offer.id}: ${givesOf(offer)}`}
                className={cx(
                    'flex w-full flex-col items-center gap-1 rounded-xl border p-1.5 transition-[box-shadow,border-color,transform] select-none',
                    tree.canManage && 'cursor-grab active:cursor-grabbing',
                    isDragging
                        ? 'border-dashed border-accent bg-accent-soft/40 opacity-40'
                        : selected
                            ? 'border-accent bg-accent-soft shadow-[0_0_0_3px_var(--color-accent-soft)]'
                            : flagged
                                ? 'border-warn-line bg-warn-soft/50 hover:-translate-y-0.5 hover:shadow-md'
                                : 'border-line bg-canvas hover:-translate-y-0.5 hover:border-muted/50 hover:shadow-md',
                )}
            >
                <OfferFace offer={offer} tree={tree} />
            </button>
        </li>
    );
};

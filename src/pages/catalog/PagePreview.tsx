import { rectSortingStrategy, SortableContext } from '@dnd-kit/sortable';
import { ImagePlus, Info, Plus, Sparkles, TriangleAlert, Type } from 'lucide-react';
import type { ReactNode } from 'react';

import { catalogImageUrl, promoImageUrl, useClientAssets } from '#/api/assets';
import type { CatalogFeaturedItem, CatalogOffer, CatalogPageDetail, CatalogTree, PageDisplay } from '#/api/catalog';
import { EmptyState } from '#/components/ui';
import { cx } from '#/lib/cx';

import { checkLayout } from './layoutCheck';
import { layoutOf, type LayoutSlot, showsOffers } from './layouts';
import { offerDragId } from './offers';
import { OfferTile } from './OfferTile';
import { PageIcon } from './PageTree';
import { RecolorablePalette } from './RecolorablePalette';

/** Which of a page's images or texts. */
export interface SlotRef {
    list: 'image' | 'text';
    index: number;
}

/** A page image in its place; empty, a dashed place to put one. Either opens its field. */
const ImageSlot = ({ name, slot, onEdit, className }: { name: string; slot: LayoutSlot; onEdit: (slot: SlotRef) => void; className?: string }) => {
    const url = catalogImageUrl(useClientAssets(), name);

    return (
        <button
            type="button"
            onClick={() => onEdit({ list: 'image', index: slot.index })}
            title={`${slot.label}${name ? `: ${name}` : ''}`}
            className={cx('group/slot relative grid place-items-center overflow-hidden rounded-lg transition hover:ring-2 hover:ring-accent', !url && 'border border-dashed border-line text-muted hover:text-accent', className)}
        >
            {url
                ? <img src={url} alt={slot.label} className="max-h-full max-w-full object-contain" onError={event => (event.currentTarget.style.opacity = '0.2')} />
                : <span className="flex items-center gap-1.5 p-2 text-xs"><ImagePlus className="size-4" />{slot.label}</span>}
        </button>
    );
};

/** A page text in its place, as the client shows it (line breaks kept, its markup as text). */
const TextSlot = ({ text, slot, onEdit, className }: { text: string; slot: LayoutSlot; onEdit: (slot: SlotRef) => void; className?: string }) => (
    <button
        type="button"
        onClick={() => onEdit({ list: 'text', index: slot.index })}
        title={slot.label}
        className={cx(
            'w-full rounded-md px-1.5 py-1 text-left whitespace-pre-line transition hover:bg-accent-soft/60 hover:ring-1 hover:ring-accent',
            !text && 'flex items-center gap-1.5 border border-dashed border-line text-xs text-muted hover:text-accent',
            className,
        )}
    >
        {text
            ? text.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')
            : <><Type className="size-3.5" />{slot.label}</>}
    </button>
);

/** The layout whose palette picks the colour its furni are placed in. */
const RECOLORABLE_LAYOUT = 'recolorable_furniture';

const slotOf = (slots: LayoutSlot[], index: number) => slots.find(x => x.index === index);

const roleOf = (slots: LayoutSlot[], role: LayoutSlot['role']) => slots.find(x => x.role === role);

/** The add tile at the end of the grid. */
const AddTile = ({ onAdd }: { onAdd: () => void }) => (
    <li className="list-none">
        <button
            type="button"
            onClick={onAdd}
            className="flex h-full min-h-[6.5rem] w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-line text-muted transition hover:border-accent hover:bg-accent-soft/40 hover:text-accent"
        >
            <Plus className="size-5" />
            <span className="text-xs font-medium">New offer</span>
        </button>
    </li>
);

/** The offers, as the client's grid: tiles to pick and to drag about. */
const OfferGrid = ({ tree, offers, selectedOffer, flagged, onSelectOffer, onAddOffer, dim }: { tree: CatalogTree; offers: CatalogOffer[]; selectedOffer: number | 'new' | null; flagged: Set<number>; onSelectOffer: (id: number) => void; onAddOffer: () => void; dim?: boolean }) => (
    <SortableContext items={offers.map(x => offerDragId(x.id))} strategy={rectSortingStrategy}>
        <ul className={cx('grid grid-cols-[repeat(auto-fill,minmax(5.75rem,1fr))] gap-2', dim && 'opacity-70')}>
            {offers.map(offer => <OfferTile key={offer.id} offer={offer} tree={tree} selected={selectedOffer === offer.id} flagged={flagged.has(offer.id)} onSelect={() => onSelectOffer(offer.id)} />)}
            {tree.canManage && <AddTile onAdd={onAddOffer} />}
        </ul>
    </SortableContext>
);

/** The front page's featured items as the client lays them out: the first big, the others listed. */
const FeaturedPreview = ({ items, onEdit }: { items: CatalogFeaturedItem[]; onEdit: () => void }) => {
    const assets = useClientAssets();
    const [ first, ...rest ] = items;

    return (
        <button type="button" onClick={onEdit} className="grid w-full gap-2 rounded-xl text-left transition hover:ring-2 hover:ring-accent sm:grid-cols-[3fr_2fr]">
            <div className="relative grid min-h-40 place-items-center overflow-hidden rounded-xl border border-line bg-subtle">
                {first && promoImageUrl(assets, first.image)
                    ? <img src={promoImageUrl(assets, first.image)!} alt="" className="absolute inset-0 size-full object-cover" />
                    : <Sparkles className="size-8 text-muted" />}
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 text-sm font-semibold text-white">{first?.title ?? 'Featured item 1'}</span>
            </div>
            <div className="flex flex-col gap-2">
                {[ 0, 1, 2 ].map((i) => {
                    const item = rest[i];
                    const url = item ? promoImageUrl(assets, item.image) : null;

                    return (
                        <div key={i} className={cx('flex min-h-12 items-center gap-2 overflow-hidden rounded-lg border border-line bg-subtle', !item && 'border-dashed text-muted')}>
                            {url ? <img src={url} alt="" className="h-12 w-20 shrink-0 object-cover" /> : <span className="grid h-12 w-12 shrink-0 place-items-center"><Sparkles className="size-4" /></span>}
                            <span className="truncate pr-2 text-xs">{item?.title ?? `Featured item ${i + 2}`}</span>
                        </div>
                    );
                })}
            </div>
        </button>
    );
};

interface PagePreviewProps {
    tree: CatalogTree;
    page: CatalogPageDetail;
    /** The page's images and texts as they are being edited, so the preview follows the fields. */
    draft: { localization: string; icon: number; layout: string; imageData: string[]; textData: string[]; display?: PageDisplay };
    featured: CatalogFeaturedItem[];
    selectedOffer: number | 'new' | null;
    onSelectOffer: (id: number) => void;
    onAddOffer: () => void;
    onEditSlot: (slot: SlotRef) => void;
    onEditFeatured: () => void;
}

/**
 * The page drawn roughly as the client draws it, from what is being edited: the header with its
 * banner, title, icon and line; then what the layout shows - the offer grid (its pictures and words
 * are edited beside it), the featured items, or its words and pictures. Every image and text opens its field; every tile
 * opens its offer and drags.
 */
export const PagePreview = ({ tree, page, draft, featured, selectedOffer, onSelectOffer, onAddOffer, onEditSlot, onEditFeatured }: PagePreviewProps) => {
    const spec = layoutOf(draft.layout);
    const assets = useClientAssets();
    const issues = checkLayout(spec, page.offers);
    const flagged = new Set(issues.flatMap(x => (x.tone === 'warn' ? x.offers ?? [] : [])));
    const images = draft.imageData;
    const texts = draft.textData;
    const header = roleOf(spec.images, 'header');
    const headerText = roleOf(spec.texts, 'header');
    const banner = header ? catalogImageUrl(assets, images[0] ?? '') : null;
    const sells = showsOffers(spec);
    const bodyTexts = spec.texts.filter(x => x !== headerText);
    const bodyImages = spec.images.filter(x => x !== header);

    let body: ReactNode;

    if (spec.kind === 'featured')
        body = <FeaturedPreview items={featured} onEdit={onEditFeatured} />;
    else if (sells)
        body = page.offers.length === 0 && !tree.canManage
            ? <EmptyState>No offers on this page.</EmptyState>
            : <OfferGrid tree={tree} offers={page.offers} selectedOffer={selectedOffer} flagged={flagged} onSelectOffer={onSelectOffer} onAddOffer={onAddOffer} />;
    else
        body = (
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                <div className="flex min-w-0 flex-col gap-2 text-sm">
                    {bodyTexts.map(slot => <TextSlot key={slot.index} text={texts[slot.index] ?? ''} slot={slot} onEdit={onEditSlot} />)}
                </div>
                {bodyImages.length > 0 && (
                    <div className="flex flex-col gap-2">
                        {bodyImages.map(slot => <ImageSlot key={slot.index} name={images[slot.index] ?? ''} slot={slot} onEdit={onEditSlot} className="min-h-24 min-w-40" />)}
                    </div>
                )}
            </div>
        );

    return (
        <div className="overflow-hidden rounded-2xl border border-line bg-canvas shadow-sm">
            {/* The header: the banner behind, the icon and the title over it. */}
            <div className="relative min-h-20 border-b border-line bg-gradient-to-r from-[#1e3a5f] to-[#2b5876] text-white">
                {header && (banner
                    ? (
                            <button type="button" onClick={() => onEditSlot({ list: 'image', index: 0 })} title={`${header.label}: ${images[0]}`} className="absolute inset-0 overflow-hidden">
                                <img src={banner} alt="" className="absolute right-0 h-full object-contain object-right" onError={event => (event.currentTarget.style.display = 'none')} />
                            </button>
                        )
                    : (
                            <button type="button" onClick={() => onEditSlot({ list: 'image', index: 0 })} className="absolute top-2 right-2 flex items-center gap-1 rounded-md border border-dashed border-white/40 px-2 py-1 text-[11px] text-white/80 hover:border-white hover:text-white">
                                <ImagePlus className="size-3.5" />
                                Header banner
                            </button>
                        ))}
                <div className="pointer-events-none relative flex items-center gap-2.5 p-3 pr-36">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/15"><PageIcon icon={draft.icon} /></span>
                    <div className="min-w-0">
                        <div className="truncate text-base font-bold drop-shadow">{draft.localization || 'Untitled'}</div>
                        {headerText && (
                            <button type="button" onClick={() => onEditSlot({ list: 'text', index: 0 })} className="pointer-events-auto block max-w-full truncate text-left text-xs text-white/85 hover:underline">
                                {texts[0] || <span className="italic opacity-70">Add a header line</span>}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex flex-col gap-3 p-3">
                {issues.length > 0 && (
                    <ul className="flex flex-col gap-1.5">
                        {issues.map(issue => (
                            <li key={issue.text} className={cx('flex items-start gap-2 rounded-lg px-2.5 py-1.5 text-xs', issue.tone === 'warn' ? 'bg-warn-soft text-ink' : 'bg-subtle text-muted')}>
                                {issue.tone === 'warn' ? <TriangleAlert className="mt-px size-3.5 shrink-0 text-warn" /> : <Info className="mt-px size-3.5 shrink-0" />}
                                <span>{issue.text}</span>
                            </li>
                        ))}
                    </ul>
                )}
                {spec.offersNote && (
                    <p className="flex items-start gap-1.5 text-xs text-muted"><Info className="mt-px size-3.5 shrink-0" />{spec.offersNote}</p>
                )}
                {body}
                {spec.code === RECOLORABLE_LAYOUT && <RecolorablePalette offers={page.offers} selectedOffer={selectedOffer} display={draft.display} />}
                {!sells && spec.kind !== 'featured' && page.offers.length > 0 && (
                    <div className="flex flex-col gap-2 border-t border-line pt-3">
                        <span className="text-xs font-medium text-muted">Offers on this page ({page.offers.length})</span>
                        <OfferGrid tree={tree} offers={page.offers} selectedOffer={selectedOffer} flagged={flagged} onSelectOffer={onSelectOffer} onAddOffer={onAddOffer} dim />
                    </div>
                )}
                {spec.kind === 'featured' && (
                    <div className="flex flex-col gap-2 border-t border-line pt-3">
                        {slotOf(spec.texts, 1) && <TextSlot text={texts[1] ?? ''} slot={slotOf(spec.texts, 1)!} onEdit={onEditSlot} className="text-sm" />}
                        <div className="flex h-9 items-center rounded-lg border border-line bg-surface px-3 text-xs text-muted">Voucher code…</div>
                    </div>
                )}
                {(spec.kind === 'club' || spec.kind === 'gifts') && (
                    <p className="text-xs text-muted">
                        {spec.kind === 'club'
                            ? `The client fills this page with the ${tree.club.memberships} shown membership${tree.club.memberships === 1 ? '' : 's'} in the catalog.`
                            : `The client fills this page with the ${tree.club.gifts} shown club gift${tree.club.gifts === 1 ? '' : 's'}.`}
                    </p>
                )}
            </div>
        </div>
    );
};

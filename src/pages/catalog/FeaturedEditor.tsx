import { closestCenter, DndContext, type DragEndEvent, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, RotateCcw, Save, Sparkles, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { promoImageUrl, useClientAssets } from '#/api/assets';
import { catalogCalls, type CatalogFeaturedInput, type CatalogFeaturedItem, type CatalogOffer, type CatalogTree, FEATURED_MAX, type FeaturedLinkType, useCatalogEdit } from '#/api/catalog';
import { ImageInput } from '#/components/ImageInput';
import { toast } from '#/components/toast';
import { Button, EmptyState, ErrorNotice, IconButton, Input, Labeled, Segmented, Select } from '#/components/ui';
import { cx } from '#/lib/cx';

import { FEATURED_IMAGE } from './images';
import { givesOf } from './offers';

interface ItemDraft extends CatalogFeaturedInput {
    key: number;
}

let nextKey = 1;

const draftsOf = (items: CatalogFeaturedItem[]): ItemDraft[] =>
    items.map(({ title, image, type, value, expiresAtUtc }) => ({ key: nextKey++, title, image, type, value, expiresAtUtc }));

const LINK_TYPES = [
    { value: 'page', label: 'A page' },
    { value: 'offer', label: 'An offer' },
    { value: 'product', label: 'A product' },
];

/** A UTC time as a datetime-local input shows it, in the viewer's own time. */
const toLocal = (utc: string | null) => {
    if (!utc)
        return '';

    const at = new Date(utc);

    return new Date(at.getTime() - at.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

const SLOT_NAMES = [ 'Big, on the left', 'Second', 'Third', 'Fourth' ];

const ItemCard = ({ item, index, tree, offers, onChange, onRemove, disabled }: { item: ItemDraft; index: number; tree: CatalogTree; offers: CatalogOffer[]; onChange: (item: ItemDraft) => void; onRemove: () => void; disabled: boolean }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.key, disabled });
    const url = promoImageUrl(useClientAssets(), item.image);
    const set = <K extends keyof ItemDraft>(key: K, value: ItemDraft[K]) => onChange({ ...item, [key]: value });
    const named = tree.pages.filter(x => x.name).sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));

    return (
        <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cx('rounded-xl border border-line bg-canvas', isDragging && 'z-10 shadow-lg')}>
            <div className="flex items-center gap-2 border-b border-line px-3 py-2">
                {!disabled && (
                    <span {...attributes} {...listeners} aria-label="Move it" className="grid size-10 cursor-grab touch-none place-items-center rounded text-muted hover:bg-subtle hover:text-ink active:cursor-grabbing sm:size-7">
                        <GripVertical className="size-4" />
                    </span>
                )}
                <span className="text-xs font-semibold">{index + 1}. {SLOT_NAMES[index]}</span>
                {!disabled && (
                    <IconButton label="Remove it" icon={<Trash2 />} tone="bad" small onClick={onRemove} className="ml-auto" />
                )}
            </div>
            <div className="flex flex-col gap-3 p-3">
                <div className="flex gap-3">
                    <span className="grid h-16 w-24 shrink-0 place-items-center overflow-hidden rounded-lg border border-line bg-subtle">
                        {url ? <img src={url} alt="" className="size-full object-cover" onError={event => (event.currentTarget.style.opacity = '0.15')} /> : <Sparkles className="size-5 text-muted" />}
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                        <Input value={item.title} onChange={event => set('title', event.target.value)} maxLength={100} placeholder="Title" aria-label="Title" disabled={disabled} />
                        <ImageInput value={item.image} onChange={value => set('image', value)} accept={FEATURED_IMAGE} title="Promo image" preview={false} disabled={disabled} />
                    </div>
                </div>
                <Labeled label="Clicking it opens">
                    <Segmented label="Clicking it opens" value={item.type} onChange={value => onChange({ ...item, type: value as FeaturedLinkType, value: '' })} options={LINK_TYPES} disabled={disabled} />
                </Labeled>
                {item.type === 'page' && (
                    <Select value={item.value} onChange={event => set('value', event.target.value)} disabled={disabled} aria-label="Page">
                        <option value="">Pick a page by its link key…</option>
                        {named.map(x => <option key={x.id} value={x.name!}>{x.name} - {x.localization}</option>)}
                        {item.value && !named.some(x => x.name === item.value) && <option value={item.value}>{item.value}</option>}
                    </Select>
                )}
                {item.type === 'offer' && (
                    <div className="flex gap-2">
                        {offers.length > 0 && (
                            <Select
                                value={offers.some(x => String(x.id) === item.value) ? item.value : ''}
                                onChange={(event) => {
                                    const picked = offers.find(x => String(x.id) === event.target.value);

                                    onChange({ ...item, value: event.target.value, title: item.title || (picked ? givesOf(picked).slice(0, 100) : '') });
                                }}
                                disabled={disabled}
                                aria-label="An offer on this page"
                                className="min-w-0 flex-1"
                            >
                                <option value="">An offer on this page…</option>
                                {offers.map(x => <option key={x.id} value={x.id}>{givesOf(x)} (#{x.id})</option>)}
                            </Select>
                        )}
                        <Input type="number" min={1} value={item.value} onChange={event => set('value', event.target.value)} placeholder="Offer id" aria-label="Offer id" disabled={disabled} className="w-24 shrink-0 font-mono sm:w-28" />
                    </div>
                )}
                {item.type === 'product' && (
                    <>
                        <Input value={item.value} onChange={event => set('value', event.target.value)} maxLength={100} placeholder="Product code" aria-label="Product code" disabled={disabled} className="font-mono" />
                        <p className="text-xs text-muted">A product code is for in-app purchases; on the web, clicking it does nothing.</p>
                    </>
                )}
                <Labeled label="Until" hint={item.expiresAtUtc ? 'It comes off the front page then (no countdown is shown, as in Habbo).' : 'Empty: until it is taken off.'}>
                    <Input type="datetime-local" value={toLocal(item.expiresAtUtc)} onChange={event => set('expiresAtUtc', event.target.value ? new Date(event.target.value).toISOString() : null)} disabled={disabled} aria-label="Until" />
                </Labeled>
            </div>
        </li>
    );
};

/**
 * The front page's featured items: up to four, the first shown big and the rest listed beside it,
 * each a promo image and a title that opens a page, an offer or a product, until a time or for
 * good. Dragged into order; saved together; live on the next publish, on every front page.
 */
export const FeaturedEditor = ({ tree, items, offers = [] }: { tree: CatalogTree; items: CatalogFeaturedItem[]; offers?: CatalogOffer[] }) => {
    const [ drafts, setDrafts ] = useState(() => draftsOf(items));
    const save = useCatalogEdit(catalogCalls.saveFeatured);
    const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
    const disabled = !tree.canManage;
    const strip = (list: ItemDraft[]): CatalogFeaturedInput[] => list.map(x => ({ title: x.title, image: x.image, type: x.type, value: x.value, expiresAtUtc: x.expiresAtUtc }));
    const dirty = JSON.stringify(strip(drafts)) !== JSON.stringify(strip(draftsOf(items)));

    const onDragEnd = ({ active, over }: DragEndEvent) => {
        if (!over || active.id === over.id)
            return;

        const from = drafts.findIndex(x => x.key === active.id);
        const to = drafts.findIndex(x => x.key === over.id);

        setDrafts(arrayMove(drafts, from, to));
    };

    return (
        <div className="flex flex-col">
            <div className="flex flex-col gap-3 p-4">
                <p className="text-xs text-muted">Shown on every front page (frontpage4), in this order. They go live when you publish.</p>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                    <SortableContext items={drafts.map(x => x.key)} strategy={verticalListSortingStrategy}>
                        <ul className="grid gap-3 lg:grid-cols-2">
                            {drafts.map((item, i) => (
                                <ItemCard
                                    key={item.key}
                                    item={item}
                                    index={i}
                                    tree={tree}
                                    offers={offers}
                                    disabled={disabled}
                                    onChange={next => setDrafts(drafts.map(x => (x.key === item.key ? next : x)))}
                                    onRemove={() => setDrafts(drafts.filter(x => x.key !== item.key))}
                                />
                            ))}
                        </ul>
                    </SortableContext>
                </DndContext>
                {!disabled && drafts.length < FEATURED_MAX && (
                    <button
                        type="button"
                        onClick={() => setDrafts([ ...drafts, { key: nextKey++, title: '', image: '', type: 'page', value: '', expiresAtUtc: null } ])}
                        className="flex items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-line py-3 text-sm text-muted transition hover:border-accent hover:text-accent"
                    >
                        <Plus className="size-4" />
                        Add a featured item
                    </button>
                )}
                {drafts.length === 0 && disabled && <EmptyState>No featured items.</EmptyState>}
            </div>
            {save.error && <div className="px-4 pb-3"><ErrorNotice error={save.error} /></div>}
            {!disabled && dirty && (
                <div className="sticky bottom-0 z-10 flex items-center gap-2 border-t border-accent/40 bg-surface/95 px-4 py-3 backdrop-blur">
                    <span className="mr-auto text-xs text-muted">Unsaved changes</span>
                    <Button variant="ghost" icon={<RotateCcw />} onClick={() => setDrafts(draftsOf(items))} title="Put the items back as saved">Reset</Button>
                    <Button icon={<Save />} disabled={save.isPending} onClick={() => save.mutate([ strip(drafts) ], { onSuccess: () => toast('Featured items saved. Publish to put them live.') })}>Save</Button>
                </div>
            )}
        </div>
    );
};

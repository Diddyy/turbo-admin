import { Coins, Copy, Crown, RotateCcw, Save, Star, Trash2 } from 'lucide-react';
import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from 'react';

import { catalogCalls, type CatalogFeaturedItem, type CatalogOffer, type CatalogOfferInput, type CatalogProductInput, type CatalogTree, type EditableKind, FEATURED_MAX, useCatalogEdit } from '#/api/catalog';
import { ask } from '#/components/confirm';
import { toast } from '#/components/toast';
import { Button, ErrorNotice, Input, Label, Labeled, Select, Switch, WarningNotice } from '#/components/ui';
import { cx } from '#/lib/cx';

import { lengthOf, membershipOfName } from './labels';
import { LimitedSection } from './LimitedSection';
import { givesOf } from './offers';
import { ProductDataHint } from './ProductDataHint';
import { ProductIcon } from './ProductIcon';
import { type ProductDraft, productDraft } from './products';
import { ProductsEditor } from './ProductsEditor';
import { ancestorsOf } from './tree';

/** What a new offer on this page starts as: a membership in the club window, a gift with the gifts. */
export type OfferStart = 'item' | 'membership' | 'gift';

const CLUB_LEVELS: { value: number; label: string; icon?: ReactNode }[] = [
    { value: 0, label: 'Anyone' },
    { value: 1, label: 'Club', icon: <Crown className="size-3.5 text-coin" /> },
    { value: 2, label: 'VIP', icon: <Crown className="size-3.5 text-vip" /> },
];

interface OfferDraft extends Omit<CatalogOfferInput, 'product' | 'products'> {
    products: ProductDraft[];
}

const draftOf = (offer: CatalogOffer | null, pageId: number, start: OfferStart): OfferDraft => ({
    pageId,
    localizationId: offer?.localizationId ?? '',
    costCredits: offer?.costCredits ?? 0,
    costCurrency: offer?.costCurrency ?? 0,
    currencyTypeId: offer?.currencyTypeId ?? null,
    canGift: offer?.canGift ?? start === 'item',
    canBundle: offer?.canBundle ?? start === 'item',
    clubLevel: offer?.clubLevel ?? 0,
    visible: offer?.visible ?? true,
    clubGiftDaysRequired: offer ? offer.clubGiftDaysRequired : start === 'gift' ? 0 : null,
    products: offer
        ? offer.products.map(x => productDraft({
                type: x.type,
                definitionId: x.definitionId,
                extraParam: x.extraParam,
                quantity: x.quantity,
                subscription: x.subscriptionType,
                subscriptionDays: x.subscriptionDays,
            }, x.definitionName))
        : start === 'membership'
            ? [ productDraft({ type: 'club', definitionId: null, extraParam: null, quantity: 1, subscription: 'HabboClub', subscriptionDays: 31 }) ]
            : [ productDraft({ type: 'floor', definitionId: null, extraParam: null, quantity: 1, subscription: null, subscriptionDays: 0 }) ],
});

/** The products as the server takes them, without the editor's own bits. */
const productsOf = (draft: OfferDraft): CatalogProductInput[] => draft.products.map(x => ({
    type: x.type,
    definitionId: x.definitionId,
    extraParam: x.extraParam,
    quantity: x.quantity,
    subscription: x.subscription,
    subscriptionDays: x.subscriptionDays,
}));

/** The draft as the server takes it: the products only when they changed, so a fixed offer saves. */
const inputOf = (draft: OfferDraft, original: OfferDraft | null): CatalogOfferInput => {
    const changed = !original || JSON.stringify(productsOf(draft)) !== JSON.stringify(productsOf(original));

    return {
        pageId: draft.pageId,
        localizationId: draft.localizationId,
        costCredits: draft.costCredits,
        costCurrency: draft.costCurrency,
        currencyTypeId: draft.currencyTypeId,
        canGift: draft.canGift,
        canBundle: draft.canBundle,
        clubLevel: draft.clubLevel,
        visible: draft.visible,
        clubGiftDaysRequired: draft.clubGiftDaysRequired,
        product: null,
        ...(changed ? { products: productsOf(draft) } : {}),
    };
};

const Group = ({ title, children }: { title: string; children: ReactNode }) => (
    <section className="flex flex-col gap-3 border-t border-line px-4 py-4">
        <Label as="h3">{title}</Label>
        {children}
    </section>
);

interface OfferInspectorProps {
    tree: CatalogTree;
    pageId: number;
    offer: CatalogOffer | null;
    start: OfferStart;
    /** The front page's featured items, to put this offer among them; null while they load. */
    featured: CatalogFeaturedItem[] | null;
    onDone: () => void;
    onCreated: (id: number) => void;
}

/**
 * One offer, new or saved, as the client sells it: what it gives (one thing or a bundle), its name
 * key and what product data shows for it, its price in credits and in a currency, who may buy it,
 * whether it can be gifted or bought in bulk and whether it shows; on the normal catalog, a club
 * gift members claim or a limited series; and the page it is on. Duplicating makes a copy beside
 * it, to start a similar one from.
 */
export const OfferInspector = ({ tree, pageId, offer, start, featured, onDone, onCreated }: OfferInspectorProps) => {
    const canManage = tree.canManage;
    const original = useMemo(() => (offer ? draftOf(offer, pageId, start) : null), [ offer, pageId, start ]);
    const [ draft, setDraft ] = useState(() => original ?? draftOf(null, pageId, start));
    const save = useCatalogEdit(offer ? (input: CatalogOfferInput) => catalogCalls.updateOffer(offer.id, input) : catalogCalls.createOffer);
    const duplicate = useCatalogEdit(catalogCalls.createOffer);
    const remove = useCatalogEdit(catalogCalls.deleteOffer);
    const feature = useCatalogEdit(catalogCalls.saveFeatured);
    const isFeatured = !!offer && !!featured?.some(x => x.type === 'offer' && x.value === String(offer.id));
    const page = tree.pages.find(x => x.id === draft.pageId);
    // Club gifts, memberships and limited series are sold from the normal catalog, which shows every page but a Builders Club only one.
    const normal = page?.display !== 'bc_only';
    const limited = offer?.products.find(x => x.limited !== null)?.limited ?? null;
    const membership = draft.products.some(x => x.type === 'club');
    const gift = draft.clubGiftDaysRequired !== null;
    // Given once per purchase, so the server sells these one at a time.
    const givenOnce = draft.products.some(x => x.type === 'badge' || x.type === 'pet' || x.type === 'robot');
    const single = draft.products.length === 1 ? draft.products[0]! : null;
    const named = membership && single ? membershipOfName(draft.localizationId) : null;
    const misnamed = named !== null && single !== null && (named.days !== single.subscriptionDays || named.subscription !== (single.subscription ?? 'HabboClub'));
    const canBeLimited = normal && offer !== null && !gift && offer.products.length === 1 && [ 'floor', 'wall' ].includes(offer.products[0]?.type ?? '');
    const dirty = !offer || JSON.stringify({ ...draft, products: productsOf(draft) }) !== JSON.stringify({ ...original, products: original ? productsOf(original) : [] });
    const allowed: EditableKind[] = gift ? [ 'floor', 'wall', 'robot' ] : normal ? [ 'floor', 'wall', 'badge', 'effect', 'pet', 'robot', 'club' ] : [ 'floor', 'wall', 'badge', 'effect', 'pet', 'robot' ];

    const pages = useMemo(() => tree.pages
        .filter(x => x.id !== tree.rootId)
        .map(x => ({ id: x.id, label: [ ...ancestorsOf(tree, x.id).map(a => a.localization).reverse(), x.localization ].join(' / ') }))
        .sort((a, b) => a.label.localeCompare(b.label)), [ tree ]);

    const set = <K extends keyof OfferDraft>(key: K, value: OfferDraft[K]) => setDraft({ ...draft, [key]: value });

    const submit = (event?: FormEvent) => {
        event?.preventDefault();

        if (!canManage || save.isPending)
            return;

        save.mutate([ inputOf(draft, original) ], {
            onSuccess: (saved) => {
                toast(offer ? 'Offer saved. Publish to put it live.' : 'Offer added. Publish to put it live.');

                if (!offer)
                    onCreated(saved.id);
            },
        });
    };

    // Ctrl+S saves the offer while it is open.
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's' && dirty) {
                event.preventDefault();
                event.stopImmediatePropagation();
                submit();
            }
        };

        window.addEventListener('keydown', onKey, true);

        return () => window.removeEventListener('keydown', onKey, true);
    });

    const first = draft.products[0];

    return (
        <form onSubmit={submit} className="flex flex-col">
            <div className="flex items-center gap-3 px-4 pt-4 pb-3">
                <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-[radial-gradient(circle_at_50%_60%,var(--color-accent-soft),transparent_70%)]">
                    {first && <ProductIcon type={first.type} name={first.type === 'badge' ? first.extraParam : first.definitionName} className="size-11" />}
                </span>
                <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{offer ? (draft.localizationId || givesOf({ products: offer.products })) : 'New offer'}</div>
                    <div className="truncate font-mono text-[11px] text-muted">{offer ? `#${offer.id} · ${givesOf({ products: offer.products })}` : `on ${page?.localization ?? 'this page'}`}</div>
                </div>
            </div>

            <Group title="It gives">
                <ProductsEditor products={draft.products} onChange={products => set('products', products)} disabled={!canManage} locked={limited !== null} allowed={allowed} />
            </Group>

            <Group title="Name and price">
                <Labeled label="Name key" hint={membership ? 'Empty: named by its length, e.g. habbo_club_3_months.' : gift ? 'Members claim the gift by it, so no two gifts share one.' : 'What product data names it by. Empty: the first item\'s class name.'}>
                    <Input
                        value={draft.localizationId}
                        onChange={(event) => {
                            const name = event.target.value;
                            const said = membershipOfName(name);

                            // A membership named by its length gives that length, as the server names them.
                            setDraft(single?.type === 'club' && said
                                ? { ...draft, localizationId: name, products: [ { ...single, subscription: said.subscription, subscriptionDays: said.days } ] }
                                : { ...draft, localizationId: name });
                        }}
                        maxLength={512}
                        disabled={!canManage}
                        className="font-mono"
                        aria-label="Name key"
                        list="offer-name-key-products"
                        spellCheck={false}
                    />
                    {!membership && !gift && <ProductDataHint code={draft.localizationId} listId="offer-name-key-products" />}
                </Labeled>
                {misnamed && single && named && (
                    <WarningNotice>
                        <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
                            <span>The name key says {lengthOf(named.days)}, but the membership gives {lengthOf(single.subscriptionDays)}. The client sells it by its days.</span>
                            {canManage && (
                                <Button variant="secondary" onClick={() => set('products', [ { ...single, subscription: named.subscription, subscriptionDays: named.days } ])} className="h-8 sm:h-8">
                                    Make it {lengthOf(named.days)}
                                </Button>
                            )}
                        </span>
                    </WarningNotice>
                )}
                {!gift && (
                    <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-2">
                        <Labeled label="Credits">
                            <div className="relative">
                                <Coins className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-coin" />
                                <Input type="number" min={0} value={draft.costCredits} onChange={event => set('costCredits', Math.max(0, Number(event.target.value) || 0))} disabled={!canManage} className="w-full pl-8 font-mono" aria-label="Credits" />
                            </div>
                        </Labeled>
                        <Labeled label="And a currency">
                            <div className="flex gap-2">
                                <Input type="number" min={0} value={draft.costCurrency} onChange={event => set('costCurrency', Math.max(0, Number(event.target.value) || 0))} disabled={!canManage || tree.currencies.length === 0} className="w-20 font-mono" aria-label="Currency amount" />
                                <Select
                                    value={draft.currencyTypeId ?? ''}
                                    onChange={event => set('currencyTypeId', event.target.value ? Number(event.target.value) : null)}
                                    disabled={!canManage || tree.currencies.length === 0}
                                    aria-label="Currency"
                                    className="min-w-0 flex-1"
                                >
                                    <option value="">None</option>
                                    {tree.currencies.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
                                </Select>
                            </div>
                        </Labeled>
                    </div>
                )}
                {!gift && draft.costCredits === 0 && draft.costCurrency === 0 && <p className="text-xs text-good">Free: the client shows it with no price.</p>}
            </Group>

            <Group title="Who and how">
                {!membership && !gift && (
                    <div role="radiogroup" aria-label="Who may buy it" className="flex gap-1 rounded-lg bg-canvas p-1">
                        {CLUB_LEVELS.map(x => (
                            <button
                                key={x.value}
                                type="button"
                                role="radio"
                                aria-checked={draft.clubLevel === x.value}
                                disabled={!canManage}
                                onClick={() => set('clubLevel', x.value)}
                                className={cx(
                                    'flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md text-[13px] font-medium transition-colors',
                                    draft.clubLevel === x.value ? 'bg-subtle text-ink shadow-[0_0_0_1px_var(--color-line)]' : 'text-muted hover:text-ink',
                                )}
                            >
                                {x.icon}
                                {x.label}
                            </button>
                        ))}
                    </div>
                )}
                <Switch label="Shown" hint="Hidden offers stay known to the client (furnidata links, search) but aren't listed." checked={draft.visible} onChange={value => set('visible', value)} disabled={!canManage} />
                {!membership && !gift && (
                    <>
                        <Switch label="Can be gifted" hint="The gift button, for one at a time." checked={draft.canGift} onChange={value => set('canGift', value)} disabled={!canManage} />
                        {givenOnce
                            ? <p className="text-xs text-muted">Bought one at a time: a badge, a pet or a bot is given once per purchase.</p>
                            : <Switch label="Can be bought in bulk" hint="The amount spinner and bulk discount, where the client has them on." checked={draft.canBundle} onChange={value => set('canBundle', value)} disabled={!canManage} />}
                    </>
                )}
                {normal && !membership && limited === null && (
                    <>
                        <Switch
                            label="Club gift"
                            hint="Claimed for free by members, one gift per month of club used up."
                            checked={gift}
                            onChange={value => set('clubGiftDaysRequired', value ? 0 : null)}
                            disabled={!canManage}
                        />
                        {gift && (
                            <Labeled label="Club days needed" hint={draft.clubGiftDaysRequired ? `${lengthOf(draft.clubGiftDaysRequired)} of club used up.` : 'Any member.'}>
                                <Input type="number" min={0} value={draft.clubGiftDaysRequired ?? 0} onChange={event => set('clubGiftDaysRequired', Math.max(0, Number(event.target.value) || 0))} disabled={!canManage} className="w-28 font-mono" aria-label="Club days needed" />
                            </Labeled>
                        )}
                    </>
                )}
            </Group>

            {offer && canBeLimited && (
                <Group title="Limited series">
                    <LimitedSection offerId={offer.id} limited={limited} canManage={canManage} />
                </Group>
            )}

            {offer && (
                <Group title="Where">
                    <Labeled label="On the page" hint="Or drag its tile onto a page in the tree.">
                        <Select value={draft.pageId} onChange={event => set('pageId', Number(event.target.value))} disabled={!canManage} aria-label="Page">
                            {pages.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}
                        </Select>
                    </Labeled>
                </Group>
            )}

            {(save.error ?? remove.error ?? duplicate.error ?? feature.error) && <div className="px-4 pb-3"><ErrorNotice error={save.error ?? remove.error ?? duplicate.error ?? feature.error} /></div>}

            {canManage && (
                <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-2 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur sm:static">
                    {offer && (
                        <>
                            <Button
                                variant="ghost"
                                icon={<Copy />}
                                disabled={duplicate.isPending}
                                title="Add a copy of it to this page"
                                onClick={() => duplicate.mutate([ { ...inputOf(draftOf(offer, pageId, start), null), localizationId: offer.isClubGift ? `${offer.localizationId}_copy` : offer.localizationId } ], {
                                    onSuccess: (saved) => {
                                        toast('Copied. The copy is open.');
                                        onCreated(saved.id);
                                    },
                                })}
                            >
                                Duplicate
                            </Button>
                            {featured && (
                                <Button
                                    variant="ghost"
                                    icon={<Star />}
                                    disabled={feature.isPending || isFeatured || featured.length >= FEATURED_MAX}
                                    title={isFeatured ? 'It is one of the front page\'s featured items' : featured.length >= FEATURED_MAX ? `The front page shows ${FEATURED_MAX} featured items; take one off first` : 'Put it among the front page\'s featured items'}
                                    onClick={() => feature.mutate([ [
                                        ...featured.map(({ title, image, type, value, expiresAtUtc }) => ({ title, image, type, value, expiresAtUtc })),
                                        { title: (givesOf(offer) || offer.localizationId).slice(0, 100), image: '', type: 'offer' as const, value: String(offer.id), expiresAtUtc: null },
                                    ] ], {
                                        onSuccess: () => toast('Featured on the front page. Give it a promo image there.'),
                                    })}
                                >
                                    {isFeatured ? 'Featured' : 'Feature'}
                                </Button>
                            )}
                            {featured && !isFeatured && featured.length >= FEATURED_MAX && (
                                <span className="order-last w-full text-xs text-muted">The front page shows {FEATURED_MAX} featured items; take one off there to feature this.</span>
                            )}
                            <Button
                                variant="ghost"
                                icon={<Trash2 />}
                                disabled={remove.isPending}
                                className="text-bad hover:text-bad"
                                onClick={() => ask({ title: 'Delete this offer?', body: 'What was bought from it stays bought.', confirm: 'Delete' }, () => remove.mutate([ offer.id ], {
                                    onSuccess: () => {
                                        toast('Offer deleted.');
                                        onDone();
                                    },
                                }))}
                            >
                                Delete
                            </Button>
                        </>
                    )}
                    <span className="ml-auto" />
                    {offer && dirty && <Button variant="ghost" icon={<RotateCcw />} onClick={() => original && setDraft(original)} title="Put the fields back as saved">Reset</Button>}
                    <Button type="submit" icon={<Save />} disabled={save.isPending || !dirty}>{offer ? 'Save offer' : 'Add offer'}</Button>
                </div>
            )}
        </form>
    );
};

import { Award, Bot, Crown, PawPrint, Sofa, Sparkles, SquareStack, Trash2 } from 'lucide-react';
import { type ReactNode, useMemo, useState } from 'react';

import { badgeUrl, useClientAssets } from '#/api/assets';
import { type CatalogFurniture, type CatalogProductInput, type EditableKind, type Membership, useFurnitureSearch } from '#/api/catalog';
import { useProductLookup } from '#/api/gamedata';
import { SearchInput } from '#/components/SearchInput';
import { Chip, IconButton, Input, Labeled, Segmented, Select, Textarea } from '#/components/ui';
import { cx } from '#/lib/cx';

import { lengthOf } from './labels';
import { ProductIcon } from './ProductIcon';
import { type ProductDraft, productDraft } from './products';

/** What the editor offers to add, in the order the row of buttons shows them. */
const KINDS: { type: EditableKind; label: string; icon: ReactNode; blurb: string }[] = [
    { type: 'floor', label: 'Floor item', icon: <Sofa />, blurb: 'Furniture that stands on the floor.' },
    { type: 'wall', label: 'Wall item', icon: <SquareStack />, blurb: 'Posters, wallpapers, floors and landscapes.' },
    { type: 'badge', label: 'Badge', icon: <Award />, blurb: 'A badge, given once.' },
    { type: 'effect', label: 'Effect', icon: <Sparkles />, blurb: 'An avatar effect, by its number.' },
    { type: 'pet', label: 'Pet', icon: <PawPrint />, blurb: 'A pet; the buyer names it and picks its breed.' },
    { type: 'robot', label: 'Bot', icon: <Bot />, blurb: 'A bot wearing a figure.' },
    { type: 'club', label: 'Membership', icon: <Crown />, blurb: 'Days of Habbo Club or Builders Club; sold on its own.' },
];

const MEMBERSHIPS = [
    { value: 'HabboClub', label: 'Habbo Club' },
    { value: 'BuildersClub', label: 'Builders Club' },
];

const blank = (type: EditableKind): CatalogProductInput => ({
    type,
    definitionId: null,
    extraParam: type === 'pet' ? '0' : null,
    quantity: 1,
    subscription: type === 'club' ? 'HabboClub' : null,
    subscriptionDays: type === 'club' ? 31 : 0,
});

/** Picking the item a product gives, by the start of its class name or its id. */
export const ItemPicker = ({ type, value, onPick, disabled }: { type: 'floor' | 'wall'; value: { id: number | null; name: string | null }; onPick: (item: CatalogFurniture) => void; disabled: boolean }) => {
    const [ text, setText ] = useState('');
    const search = useFurnitureSearch(text);
    const items = (search.data ?? []).filter(x => x.type === type);

    return (
        <div className="flex min-w-0 flex-col gap-1.5">
            {!disabled && (
                <SearchInput
                    value={text}
                    onValueChange={setText}
                    placeholder={value.id ? 'Swap for another…' : `Find a ${type} item by class name or id`}
                    aria-label="Find an item"
                    spellCheck={false}
                    autoComplete="off"
                    className="w-full font-mono"
                />
            )}
            {text.trim() && (
                <ul className="max-h-52 overflow-y-auto rounded-lg border border-line bg-surface">
                    {items.length === 0
                        ? <li className="px-3 py-2 text-sm text-muted">{search.isFetching ? 'Looking…' : `No ${type} item matches.`}</li>
                        : items.map(item => (
                                <li key={item.id}>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            onPick(item);
                                            setText('');
                                        }}
                                        className={cx('flex min-h-10 w-full items-center gap-2 px-3 text-left text-sm hover:bg-subtle sm:min-h-8', item.id === value.id && 'text-accent')}
                                    >
                                        <ProductIcon type={item.type} name={item.name} className="size-7" />
                                        <span className="min-w-0 flex-1 truncate font-mono">{item.name}</span>
                                        <span className="font-mono text-[11px] text-muted">#{item.id}</span>
                                    </button>
                                </li>
                            ))}
                </ul>
            )}
        </div>
    );
};

/** The pet types the hotel's product data names (`a0 pet<n>`), to pick from by name. */
const PET_TYPE_COUNT = 50;
const PET_CODES = Array.from({ length: PET_TYPE_COUNT }, (_, i) => `a0 pet${i}`);

export const PetPicker = ({ value, onChange, disabled }: { value: string; onChange: (value: string) => void; disabled: boolean }) => {
    const { data } = useProductLookup(PET_CODES);
    const names = useMemo(() => new Map((data ?? []).map(x => [ Number(x.code.slice('a0 pet'.length)), x.name ])), [ data ]);

    return (
        <Labeled label="Pet type" hint="The buyer picks the breed and colour and names it. Its offer's name key should be a0 pet<type>, which the pet page reads.">
            <div className="flex gap-2">
                <Input type="number" min={0} value={value} onChange={event => onChange(String(Math.max(0, Math.floor(Number(event.target.value) || 0))))} disabled={disabled} className="w-20 font-mono" aria-label="Pet type number" />
                <Select value={value} onChange={event => onChange(event.target.value)} disabled={disabled} aria-label="Pet type" className="min-w-0 flex-1">
                    {!names.has(Number(value)) && <option value={value}>Type {value}</option>}
                    {[ ...names.entries() ].sort((a, b) => a[0] - b[0]).map(([ id, name ]) => <option key={id} value={String(id)}>{id} · {name ?? `pet ${id}`}</option>)}
                </Select>
            </div>
        </Labeled>
    );
};

/** One product's own fields, by what it is. */
const ProductFields = ({ product, onChange, disabled, locked }: { product: ProductDraft; onChange: (product: ProductDraft) => void; disabled: boolean; locked: boolean }) => {
    const assets = useClientAssets();
    const set = <K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) => onChange({ ...product, [key]: value });
    const quantity = (max: number) => (
        <Labeled label="How many" className="w-24 shrink-0">
            <Input type="number" min={1} max={max} value={product.quantity} onChange={event => set('quantity', Math.min(max, Math.max(1, Number(event.target.value) || 1)))} disabled={disabled} className="font-mono" aria-label="How many" />
        </Labeled>
    );

    switch (product.type) {
        case 'floor':
        case 'wall':
            return (
                <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                        <div className="mb-1.5 truncate font-mono text-sm">{product.definitionName ?? (product.definitionId ? `#${product.definitionId}` : <span className="text-muted">Pick an item</span>)}</div>
                        <ItemPicker type={product.type} value={{ id: product.definitionId, name: product.definitionName }} disabled={disabled || locked} onPick={item => onChange({ ...product, definitionId: item.id, definitionName: item.name })} />
                        {product.type === 'wall' && (
                            <Input
                                value={product.extraParam ?? ''}
                                onChange={event => set('extraParam', event.target.value.trim() || null)}
                                placeholder={[ 'wallpaper', 'floor', 'landscape' ].includes(product.definitionName ?? '') ? 'Pattern, e.g. 101 (a landscape: 1.1) - needed' : product.definitionName === 'poster' ? 'Poster number, e.g. 12 - needed' : 'Extra parameter, if any'}
                                disabled={disabled || locked}
                                className="mt-1.5 w-full font-mono text-xs"
                                aria-label="Pattern or poster number"
                            />
                        )}
                        {product.type === 'floor' && product.definitionName === 'song_disk' && (
                            <Input
                                type="number"
                                min={1}
                                value={product.extraParam ?? ''}
                                onChange={event => set('extraParam', event.target.value ? String(Math.max(1, Math.floor(Number(event.target.value)))) : null)}
                                placeholder="Song id - needed"
                                disabled={disabled || locked}
                                className="mt-1.5 w-full font-mono text-xs"
                                aria-label="Song id"
                            />
                        )}
                    </div>
                    {quantity(100)}
                </div>
            );
        case 'badge':
            return (
                <div className="flex items-center gap-3">
                    <span className="grid size-12 shrink-0 place-items-center rounded-lg border border-line bg-canvas">
                        {badgeUrl(assets, product.extraParam) && <img src={badgeUrl(assets, product.extraParam)!} alt="" className="[image-rendering:pixelated]" onError={event => (event.currentTarget.style.display = 'none')} />}
                    </span>
                    <Input value={product.extraParam ?? ''} onChange={event => set('extraParam', event.target.value.trim() || null)} placeholder="Badge code, e.g. ADM" aria-label="Badge code" className="w-full font-mono" disabled={disabled} />
                </div>
            );
        case 'effect':
            return (
                <div className="flex items-end gap-2">
                    <Labeled label="Effect number" className="min-w-0 flex-1">
                        <Input type="number" min={1} value={product.extraParam ?? ''} onChange={event => set('extraParam', event.target.value ? String(Math.max(1, Math.floor(Number(event.target.value)))) : null)} placeholder="e.g. 108" disabled={disabled} className="font-mono" aria-label="Effect number" />
                    </Labeled>
                    {quantity(100)}
                </div>
            );
        case 'pet':
            return <PetPicker value={product.extraParam ?? '0'} onChange={value => set('extraParam', value)} disabled={disabled} />;
        case 'robot':
            return (
                <Labeled label="Figure" hint="The look the bot wears, as a figure string (hr-100-61.hd-180-1…). It is named after its furni, or the hotel's default bot name.">
                    <Textarea value={product.extraParam ?? ''} onChange={event => set('extraParam', event.target.value.trim() || null)} rows={2} placeholder="hd-180-1.ch-210-66.lg-270-82.sh-290-91" disabled={disabled} className="font-mono text-xs" spellCheck={false} />
                </Labeled>
            );
        case 'club':
            return (
                <div className="flex flex-col gap-2">
                    <Segmented label="Membership" value={product.subscription ?? 'HabboClub'} onChange={value => set('subscription', value as Membership)} options={MEMBERSHIPS} disabled={disabled} />
                    <div className="flex items-end gap-2">
                        <Labeled label="Days" className="w-28" hint={lengthOf(product.subscriptionDays)}>
                            <Input type="number" min={1} max={3650} value={product.subscriptionDays} onChange={event => set('subscriptionDays', Math.min(3650, Math.max(1, Number(event.target.value) || 1)))} disabled={disabled} className="font-mono" aria-label="Days" />
                        </Labeled>
                        <div className="flex flex-wrap gap-1 pb-0.5">
                            {[ 31, 93, 186, 372 ].map(days => (
                                <Chip key={days} active={product.subscriptionDays === days} disabled={disabled} onClick={() => set('subscriptionDays', days)}>
                                    {lengthOf(days)}
                                </Chip>
                            ))}
                        </div>
                    </div>
                </div>
            );
    }
};

interface ProductsEditorProps {
    products: ProductDraft[];
    onChange: (products: ProductDraft[]) => void;
    disabled: boolean;
    /** A limited series fixes what the offer gives. */
    locked: boolean;
    /** The kinds this offer may give here: no membership in the Builders Club, only items as a club gift. */
    allowed: EditableKind[];
}

/**
 * What an offer gives: one thing or a bundle of them, each with its own fields - an item and how
 * many, a badge, an effect, a pet type, a bot's figure, or days of a membership. A membership is
 * sold on its own; the rest mix freely. Removing the last one isn't allowed: an offer gives
 * something.
 */
export const ProductsEditor = ({ products, onChange, disabled, locked, allowed }: ProductsEditorProps) => {
    const hasClub = products.some(x => x.type === 'club');
    const hasPet = products.some(x => x.type === 'pet');
    const canEdit = !disabled && !locked;

    // Why a kind can't be added now, or null when it can.
    const blockedBy = (type: EditableKind) => {
        if (products.length >= 20)
            return 'That\'s the most an offer holds.';

        if ((hasClub || type === 'club') && products.length > 0)
            return 'A membership is sold on its own.';

        return type === 'pet' && hasPet ? 'One pet per offer.' : null;
    };

    const whyNot = [ ...new Set(KINDS.filter(x => allowed.includes(x.type)).map(x => blockedBy(x.type)).filter(x => x !== null)) ];

    return (
        <div className="flex flex-col gap-2">
            <ul className="flex flex-col gap-2">
                {products.map((product, i) => {
                    const kind = KINDS.find(x => x.type === product.type);

                    return (
                        <li key={product.key} className="animate-rise rounded-xl border border-line bg-canvas p-3">
                            <div className="mb-2 flex items-center gap-2">
                                <ProductIcon type={product.type} name={product.type === 'badge' ? product.extraParam : product.definitionName} className="size-7" />
                                <span className="text-xs font-semibold">{kind?.label ?? product.type}</span>
                                {products.length > 1 && <span className="font-mono text-[11px] text-muted">{i + 1} of {products.length}</span>}
                                {canEdit && products.length > 1 && (
                                    <IconButton label="Remove it" icon={<Trash2 />} tone="bad" small onClick={() => onChange(products.filter(x => x.key !== product.key))} className="ml-auto" />
                                )}
                            </div>
                            <ProductFields product={product} onChange={next => onChange(products.map(x => (x.key === product.key ? next : x)))} disabled={disabled} locked={locked} />
                        </li>
                    );
                })}
            </ul>
            {canEdit && (
                <div className="flex flex-wrap items-center gap-1.5">
                    <span className="mr-1 text-xs text-muted">{products.length ? 'Add to it:' : 'It gives:'}</span>
                    {KINDS.filter(x => allowed.includes(x.type)).map((kind) => {
                        const blocked = blockedBy(kind.type);

                        return (
                            <button
                                key={kind.type}
                                type="button"
                                disabled={blocked !== null}
                                title={blocked ?? kind.blurb}
                                onClick={() => onChange([ ...products, productDraft(blank(kind.type)) ])}
                                className="flex items-center gap-1 rounded-full border border-line bg-surface px-2.5 py-1 text-xs transition hover:-translate-y-0.5 hover:border-accent hover:text-accent disabled:pointer-events-none disabled:opacity-40 [&>svg]:size-3.5"
                            >
                                {kind.icon}
                                {kind.label}
                            </button>
                        );
                    })}
                </div>
            )}
            {canEdit && whyNot.length > 0 && <p className="text-xs text-muted">{whyNot.join(' ')}</p>}
            {locked && <p className="text-xs text-muted">A limited series fixes what this offer gives.</p>}
        </div>
    );
};

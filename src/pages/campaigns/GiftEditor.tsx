import { Trash2 } from 'lucide-react';
import { useState } from 'react';

import { promoImageUrl, useClientAssets } from '#/api/assets';
import type { CampaignGift } from '#/api/campaigns';
import type { Currency } from '#/api/content';
import { useProductLookup } from '#/api/gamedata';
import { Button, Input, Labeled, Panel, Segmented, Select } from '#/components/ui';
import { cx } from '#/lib/cx';
import { ItemPicker } from '#/pages/catalog/ProductsEditor';

import { shownProduct } from './model';

/** Whole numbers from an input, not below 0. */
const whole = (text: string) => Math.max(0, Math.floor(Number(text) || 0));

/** A field the server refused: its message under it, and the field marked. */
export const FieldError = ({ message }: { message: string | null }) => (message ? <span role="alert" className="text-xs text-bad">{message}</span> : null);

const marked = (error: string | null) => cx(error && 'border-bad focus:border-bad focus:ring-bad/25');

/**
 * What the client shows for a gift: its product by name, which the client's product data must
 * know or the door does not draw opened (AS3 `HabboCampaigns.showProductNotification`).
 */
const ShownAs = ({ gift }: { gift: CampaignGift }) => {
    const code = shownProduct(gift);
    const { data, isError } = useProductLookup(code ? [ code ] : []);
    const entry = data?.find(x => x.code === code);

    if (!code) return <p className="text-xs text-warn">Name a product or pick a furni: the client shows the gift by its product data name.</p>;
    if (isError || !data) return <p className="text-xs text-muted">The client shows it as the product <span className="font-mono">{code}</span>.</p>;

    return entry
        ? <p className="text-xs text-muted">The client shows it as <span className="font-medium text-ink">{entry.name ?? code}</span> (<span className="font-mono">{code}</span>).</p>
        : <p className="text-xs text-warn">The product data has no <span className="font-mono">{code}</span>: the client would not draw this door opened. Add it under Texts &amp; variables, Products.</p>;
};

/** One day's gift: what is given, and how the client shows it. */
export const GiftEditor = ({ gift, currencies, errorOf, onChange, onRemove }: {
    gift: CampaignGift;
    currencies: Currency[];
    /** The server's refusal of a field of this gift, if it was about one. */
    errorOf: (field: string) => string | null;
    onChange: (gift: CampaignGift) => void;
    onRemove: () => void;
}) => {
    const assets = useClientAssets();
    const [ furniType, setFurniType ] = useState<'floor' | 'wall'>('floor');
    const set = <K extends keyof CampaignGift>(key: K, value: CampaignGift[K]) => onChange({ ...gift, [key]: value });
    const image = promoImageUrl(assets, gift.customImage);

    return (
        <Panel
            title={`Day ${gift.dayIndex + 1}`}
            description={`Door ${gift.dayIndex + 1}'s gift (day index ${gift.dayIndex}). Any mix of it is given, once per player.`}
            actions={<Button variant="ghost" icon={<Trash2 />} onClick={onRemove}>No gift</Button>}
        >
            <div className="grid gap-5 p-4 lg:grid-cols-2">
                <div className="flex flex-col gap-4">
                    <Labeled label="Furni" hint="One of it is given; its icon shows on the door when there is no picture.">
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                                <Input value={gift.furnitureClassName} onChange={event => set('furnitureClassName', event.target.value.trim())} placeholder="Class name, or find one below" className={cx('min-w-0 flex-1 font-mono', marked(errorOf('furnitureClassName')))} aria-label="Furni class name" spellCheck={false} />
                                <Segmented label="Furni type" value={furniType} onChange={value => setFurniType(value as 'floor' | 'wall')} options={[ { value: 'floor', label: 'Floor' }, { value: 'wall', label: 'Wall' } ]} />
                            </div>
                            <ItemPicker type={furniType} value={{ id: null, name: gift.furnitureClassName || null }} disabled={false} onPick={item => set('furnitureClassName', item.name)} />
                            <FieldError message={errorOf('furnitureClassName')} />
                        </div>
                    </Labeled>
                    <div className="grid gap-3 sm:grid-cols-[8rem_minmax(0,1fr)_8rem]">
                        <Labeled label="Credits">
                            <Input type="number" min={0} value={gift.credits} onChange={event => set('credits', whole(event.target.value))} className={cx('font-mono', marked(errorOf('credits')))} aria-label="Credits" />
                            <FieldError message={errorOf('credits')} />
                        </Labeled>
                        <Labeled label="Currency">
                            <Select value={gift.currencyTypeId ?? ''} onChange={event => set('currencyTypeId', event.target.value === '' ? null : Number(event.target.value))} className={marked(errorOf('currencyTypeId'))} aria-label="Currency">
                                <option value="">None</option>
                                {currencies.map(x => <option key={x.id} value={x.id}>{x.name} ({x.id})</option>)}
                                {gift.currencyTypeId !== null && !currencies.some(x => x.id === gift.currencyTypeId) && <option value={gift.currencyTypeId}>type {gift.currencyTypeId}</option>}
                            </Select>
                            <FieldError message={errorOf('currencyTypeId')} />
                        </Labeled>
                        <Labeled label="Amount">
                            <Input type="number" min={0} value={gift.currencyAmount} disabled={gift.currencyTypeId === null} onChange={event => set('currencyAmount', whole(event.target.value))} className={cx('font-mono', marked(errorOf('currencyAmount')))} aria-label="Currency amount" />
                            <FieldError message={errorOf('currencyAmount')} />
                        </Labeled>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <Labeled label="Badge" hint="Given when the player has not got it.">
                            <Input value={gift.badgeCode} onChange={event => set('badgeCode', event.target.value.trim())} placeholder="e.g. ADV01" className="font-mono" aria-label="Badge code" spellCheck={false} />
                        </Labeled>
                        <Labeled label="Effect" hint="An avatar effect id, one timed copy.">
                            <Input type="number" min={1} value={gift.effectId ?? ''} onChange={event => set('effectId', event.target.value === '' ? null : whole(event.target.value))} placeholder="None" className="font-mono" aria-label="Effect id" />
                        </Labeled>
                    </div>
                </div>
                <div className="flex flex-col gap-4">
                    <Labeled label="Product code" hint="The product data name the client shows. Empty: the furni's class name.">
                        <Input value={gift.productCode} onChange={event => set('productCode', event.target.value.trim())} placeholder={gift.furnitureClassName || 'e.g. credits_100'} className={cx('font-mono', marked(errorOf('productCode')))} aria-label="Product code" spellCheck={false} />
                        <FieldError message={errorOf('productCode')} />
                    </Labeled>
                    {!errorOf('productCode') && <ShownAs gift={gift} />}
                    <Labeled label="Custom image" hint="A picture under the client's image library (image.library.url), drawn instead of the furni's icon.">
                        <Input value={gift.customImage} onChange={event => set('customImage', event.target.value.trim())} placeholder="e.g. album1584/ADV01.gif" className="font-mono" aria-label="Custom image" spellCheck={false} />
                    </Labeled>
                    {image && (
                        <div className="flex items-center gap-3 rounded-lg border border-line bg-subtle/40 p-2">
                            <img src={image} alt="" className="max-h-16 max-w-24 [image-rendering:pixelated]" />
                            <span className="min-w-0 truncate font-mono text-[11px] text-muted">{image}</span>
                        </div>
                    )}
                    <FieldError message={errorOf('dayIndex')} />
                </div>
            </div>
        </Panel>
    );
};

import { ArrowDown, ArrowDownWideNarrow, ArrowUp, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

import type { RewardTrack, RewardTrackPrize, RewardTrackProductType } from '#/api/rewardTracks';
import { Badge, Button, Checkbox, EmptyState, IconButton, Input, Labeled, Panel, Select, Textarea } from '#/components/ui';
import { cx } from '#/lib/cx';
import { ItemPicker, PetPicker } from '#/pages/catalog/ProductsEditor';

import { blankPrize, CURRENCIES, type FurniNames, moved, nextId, prizeText, PRODUCT_TYPES } from './model';
import { PrizeIcon } from './PrizeIcon';

/** Whole numbers from an input, not below a floor. */
const whole = (text: string, min = 0) => Math.max(min, Math.floor(Number(text) || 0));

/** A prize turned into another kind: what it gives starts empty. */
const asType = (prize: RewardTrackPrize, productType: RewardTrackProductType): RewardTrackPrize => ({
    ...prize,
    productType,
    rewardTypeId: productType === 8 ? '0' : productType === 6 ? 'GENERIC' : '',
    extraParams: productType === 10 ? '0 0 ffffff' : '',
    amount: 1,
    furnitureDefinitionId: null,
    name: '',
});

/** What the prize gives, by its kind. */
const GiveFields = ({ prize, furni, onChange, onPickFurni }: { prize: RewardTrackPrize; furni: FurniNames; onChange: (prize: RewardTrackPrize) => void; onPickFurni: (name: string) => void }) => {
    const set = <K extends keyof RewardTrackPrize>(key: K, value: RewardTrackPrize[K]) => onChange({ ...prize, [key]: value });
    const amount = (label = 'How many') => (
        <Labeled label={label} className="w-32 shrink-0">
            <Input type="number" min={1} value={prize.amount} onChange={event => set('amount', whole(event.target.value, 1))} className="font-mono" aria-label="Amount" />
        </Labeled>
    );
    const id = (label: string, placeholder: string) => (
        <Labeled label={label} className="min-w-0 flex-1">
            <Input value={prize.rewardTypeId} onChange={event => set('rewardTypeId', event.target.value.trim())} placeholder={placeholder} className="font-mono" aria-label={label} spellCheck={false} />
        </Labeled>
    );
    const name = (
        <Labeled label="Name" hint="Empty: the hotel's default name (Turbo:RewardTracks).">
            <Input value={prize.name} onChange={event => set('name', event.target.value)} aria-label="Name" />
        </Labeled>
    );

    switch (prize.productType) {
        case 8: {
            const known = prize.rewardTypeId in CURRENCIES;

            return (
                <div className="flex flex-wrap items-end gap-2">
                    <Labeled label="Currency" className="w-44">
                        <Select value={known ? prize.rewardTypeId : 'other'} onChange={event => set('rewardTypeId', event.target.value === 'other' ? '' : event.target.value)} aria-label="Currency">
                            {Object.entries(CURRENCIES).map(([ type, label ]) => <option key={type} value={type}>{label} ({type})</option>)}
                            <option value="other">another type…</option>
                        </Select>
                    </Labeled>
                    {!known && id('Currency type', 'e.g. 7')}
                    {amount('Amount')}
                </div>
            );
        }
        case 0:
        case 1: {
            const type = prize.productType === 0 ? 'wall' : 'floor';
            const current = furni.get(prize.id) ?? null;

            return (
                <div className="flex flex-col gap-2">
                    <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                            <div className="mb-1.5 truncate font-mono text-sm">
                                {current ?? <span className="text-warn">{prize.rewardTypeId ? `No ${type} furni of sprite ${prize.rewardTypeId} here` : 'Pick an item'}</span>}
                                {prize.furnitureDefinitionId !== null && <span className="ml-2 text-[11px] text-muted">#{prize.furnitureDefinitionId}</span>}
                            </div>
                            <ItemPicker
                                type={type}
                                value={{ id: prize.furnitureDefinitionId, name: current }}
                                disabled={false}
                                onPick={(item) => {
                                    onPickFurni(item.name);
                                    onChange({ ...prize, furnitureDefinitionId: item.id, rewardTypeId: String(item.spriteId) });
                                }}
                            />
                        </div>
                        {amount()}
                    </div>
                    <p className="text-xs text-muted">The client is sent the furni's sprite ({prize.rewardTypeId || 'none'}) for its icon; the player is given {prize.furnitureDefinitionId !== null ? 'this furni' : 'the hotel\'s furni of that sprite'}.</p>
                </div>
            );
        }
        case 4:
            return <div className="flex gap-2">{id('Badge code', 'e.g. DAD18')}</div>;
        case 12:
            return <div className="flex gap-2">{id('Habbicon id', 'e.g. 72')}</div>;
        case 2:
            return <div className="flex items-end gap-2">{id('Effect id', 'e.g. 108')}{amount()}</div>;
        case 9:
            return <div className="flex gap-2">{id('Chat style id', 'e.g. 32')}</div>;
        case 10: {
            const [ petType = '0', palette = '0', colour = 'ffffff' ] = prize.extraParams.split(' ');
            const setFigure = (next: { petType?: string; palette?: string; colour?: string }) =>
                set('extraParams', [ next.petType ?? petType, next.palette ?? palette, next.colour ?? colour ].join(' '));

            return (
                <div className="flex flex-col gap-3">
                    <PetPicker value={petType} onChange={value => setFigure({ petType: value })} disabled={false} />
                    <div className="flex gap-2">
                        <Labeled label="Breed (palette)" className="w-36">
                            <Input type="number" min={0} value={palette} onChange={event => setFigure({ palette: String(whole(event.target.value)) })} className="font-mono" aria-label="Pet palette" />
                        </Labeled>
                        <Labeled label="Colour" className="w-36">
                            <Input value={colour} onChange={event => setFigure({ colour: event.target.value.trim().replace(/^#/, '') })} className="font-mono" aria-label="Pet colour" />
                        </Labeled>
                    </div>
                    {name}
                </div>
            );
        }
        case 6:
            return (
                <div className="flex flex-col gap-3">
                    <Labeled label="Figure" hint="The look the bot wears (hd-180-1.ch-210-66…).">
                        <Textarea value={prize.extraParams} onChange={event => set('extraParams', event.target.value.trim())} rows={2} className="font-mono text-xs" spellCheck={false} aria-label="Bot figure" />
                    </Labeled>
                    {name}
                </div>
            );
    }
};

/** One prize, folded to a line until opened. */
const PrizeRow = ({ prize, index, count, open, onOpen, furni, onChange, onPickFurni, onMove, onRemove }: {
    prize: RewardTrackPrize;
    index: number;
    count: number;
    open: boolean;
    onOpen: () => void;
    furni: FurniNames;
    onChange: (prize: RewardTrackPrize) => void;
    onPickFurni: (name: string) => void;
    onMove: (by: -1 | 1) => void;
    onRemove: () => void;
}) => (
    <li className="border-t border-line first:border-t-0">
        <div className="flex items-center gap-2 px-3 py-1.5">
            <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-2 text-left" aria-expanded={open}>
                <ChevronRight className={cx('size-4 shrink-0 text-muted transition', open && 'rotate-90')} />
                <PrizeIcon prize={prize} furni={furni} />
                <span className="w-16 shrink-0 text-right font-mono text-xs tabular-nums">{prize.requiredPoints.toLocaleString()}</span>
                <span className="w-24 shrink-0 truncate font-mono text-sm">{prize.id}</span>
                <span className="min-w-0 truncate text-sm">{prizeText(prize, furni)}</span>
                {prize.premium && <Badge tone="accent">premium</Badge>}
            </button>
            <IconButton label="Move up" icon={<ArrowUp />} disabled={index === 0} onClick={() => onMove(-1)} />
            <IconButton label="Move down" icon={<ArrowDown />} disabled={index === count - 1} onClick={() => onMove(1)} />
            <IconButton label={`Remove ${prize.id}`} icon={<Trash2 />} tone="bad" onClick={onRemove} />
        </div>
        {open && (
            <div className="grid gap-4 border-t border-line bg-subtle/40 px-4 py-4 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
                <div className="flex flex-col gap-3">
                    <Labeled label="Id">
                        <Input value={prize.id} onChange={event => onChange({ ...prize, id: event.target.value.trim() })} className="font-mono" maxLength={64} aria-label="Prize id" spellCheck={false} />
                    </Labeled>
                    <Labeled label="Points" hint="Claimable once the track's points reach it.">
                        <Input type="number" min={0} value={prize.requiredPoints} onChange={event => onChange({ ...prize, requiredPoints: whole(event.target.value) })} className="font-mono" aria-label="Points needed" />
                    </Labeled>
                    <Checkbox label="Premium" hint="On the premium row: only a player who bought premium can claim it." checked={prize.premium} onChange={value => onChange({ ...prize, premium: value })} />
                </div>
                <div className="flex flex-col gap-3">
                    <Labeled label="Gives">
                        <Select value={prize.productType} onChange={event => onChange(asType(prize, Number(event.target.value) as RewardTrackProductType))} aria-label="Gives">
                            {PRODUCT_TYPES.map(x => <option key={x.value} value={x.value}>{x.label}</option>)}
                        </Select>
                    </Labeled>
                    <GiveFields prize={prize} furni={furni} onChange={onChange} onPickFurni={onPickFurni} />
                </div>
            </div>
        )}
    </li>
);

/** The track's prizes in the order the client is sent them, which its strip spaces them by. */
export const PrizesEditor = ({ track, furni, onPickFurni, onChange }: { track: RewardTrack; furni: FurniNames; onPickFurni: (prize: string, name: string) => void; onChange: (track: RewardTrack) => void }) => {
    const [ open, setOpen ] = useState<number | null>(null);
    const setPrizes = (prizes: RewardTrackPrize[]) => onChange({ ...track, prizes });
    const sorted = track.prizes.every((x, i) => i === 0 || track.prizes[i - 1]!.requiredPoints <= x.requiredPoints);
    const add = (premium: boolean) => {
        const last = track.prizes.reduce((max, x) => Math.max(max, x.requiredPoints), 0);

        setPrizes([ ...track.prizes, blankPrize(nextId(premium ? 'premium' : 'free', track.prizes), last + 50, premium) ]);
        setOpen(track.prizes.length);
    };

    return (
        <Panel
            title="Prizes"
            description={`${track.prizes.filter(x => !x.premium).length} free, ${track.prizes.filter(x => x.premium).length} premium. The strip spaces them by the smallest gap between two of a row.`}
            actions={(
                <>
                    {!sorted && <Button variant="ghost" icon={<ArrowDownWideNarrow />} onClick={() => setPrizes([ ...track.prizes ].sort((a, b) => a.requiredPoints - b.requiredPoints))}>Sort by points</Button>}
                    <Button variant="secondary" icon={<Plus />} onClick={() => add(false)}>Free prize</Button>
                    <Button variant="secondary" icon={<Plus />} disabled={!track.premium} onClick={() => add(true)}>Premium prize</Button>
                </>
            )}
        >
            {track.prizes.length === 0
                ? <EmptyState>No prizes: points earn nothing on this track.</EmptyState>
                : (
                        <ul>
                            {track.prizes.map((prize, index) => (
                                <PrizeRow
                                    key={index}
                                    prize={prize}
                                    index={index}
                                    count={track.prizes.length}
                                    open={open === index}
                                    onOpen={() => setOpen(open === index ? null : index)}
                                    furni={furni}
                                    onChange={next => setPrizes(track.prizes.map((x, i) => (i === index ? next : x)))}
                                    onPickFurni={name => onPickFurni(prize.id, name)}
                                    onMove={(by) => {
                                        setPrizes(moved(track.prizes, index, by));
                                        if (open === index) setOpen(index + by);
                                    }}
                                    onRemove={() => {
                                        setPrizes(track.prizes.filter((_, i) => i !== index));
                                        setOpen(null);
                                    }}
                                />
                            ))}
                        </ul>
                    )}
        </Panel>
    );
};

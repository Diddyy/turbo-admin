import { Coins, Gift, Lock, Sparkles, TriangleAlert } from 'lucide-react';

import { promoImageUrl, useClientAssets } from '#/api/assets';
import type { CampaignCalendar, CampaignGift } from '#/api/campaigns';
import { cx } from '#/lib/cx';
import { ProductIcon } from '#/pages/catalog/ProductIcon';

import { DOOR, type DoorState, doorState } from './model';

/** A gift's picture as the client draws an opened door: the custom image, else the furni's icon; the panel's own symbol for the rest. */
export const GiftPicture = ({ gift, className }: { gift: CampaignGift | undefined; className?: string }) => {
    const assets = useClientAssets();
    const image = gift ? promoImageUrl(assets, gift.customImage) : null;

    if (!gift) return <span className={cx('grid size-8 place-items-center text-muted/50', className)}><Gift className="size-4" aria-hidden /></span>;
    if (image) return <span className={cx('grid size-8 place-items-center', className)}><img src={image} alt="" className="max-h-full max-w-full [image-rendering:pixelated]" /></span>;
    if (gift.furnitureClassName) return <ProductIcon type="floor" name={gift.furnitureClassName} className={className} />;
    if (gift.badgeCode) return <ProductIcon type="badge" name={gift.badgeCode} className={className} />;

    const Glyph = gift.credits > 0 || gift.currencyAmount > 0 ? Coins : Sparkles;

    return <span className={cx('grid size-8 place-items-center', className)}><Glyph className="size-4 text-accent" aria-hidden /></span>;
};

/** Every door of the calendar, to pick one's gift to change. */
export const DayGrid = ({ calendar, selected, faulty, onSelect }: { calendar: CampaignCalendar; selected: number | null; faulty: number | null; onSelect: (day: number) => void }) => {
    const gifts = new Map(calendar.rewards.map(x => [ x.dayIndex, x ]));

    return (
        <ol className="grid grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-2 p-4">
            {Array.from({ length: calendar.days }, (_, day) => {
                const gift = gifts.get(day);

                return (
                    <li key={day}>
                        <button
                            type="button"
                            onClick={() => onSelect(day)}
                            aria-pressed={selected === day}
                            aria-label={`Day ${day + 1}${gift ? '' : ', no gift'}`}
                            className={cx(
                                'relative flex h-20 w-full flex-col items-center justify-between rounded-lg border px-1 py-1.5 text-xs transition-colors',
                                selected === day ? 'border-accent bg-accent-soft' : 'border-line hover:bg-subtle',
                                !gift && 'border-dashed',
                                faulty === day && 'border-bad',
                            )}
                        >
                            <span className="font-mono tabular-nums">{day + 1}</span>
                            <GiftPicture gift={gift} />
                            {faulty === day && <TriangleAlert className="absolute top-1 right-1 size-3.5 text-bad" aria-hidden />}
                        </button>
                    </li>
                );
            })}
        </ol>
    );
};

const STATE_CLASS: Record<DoorState, string> = {
    opened: 'border-good-line bg-good-soft',
    available: 'border-accent bg-accent-soft ring-2 ring-accent/30',
    missed: 'border-line bg-subtle/60 opacity-60',
    future: 'border-line bg-surface',
};

/**
 * The calendar's window as a player who has opened nothing sees it today: the heading's day, and
 * each door drawn by `CalendarItem.resolveDayState` from what the server sends (today's day,
 * the days missed).
 */
export const TodayPreview = ({ calendar, today }: { calendar: CampaignCalendar; today: number }) => {
    const gifts = new Map(calendar.rewards.map(x => [ x.dayIndex, x ]));
    const states = Array.from({ length: calendar.days }, (_, day) => doorState(day, today));
    const counts = (Object.keys(DOOR) as DoorState[]).map(state => [ state, states.filter(x => x === state).length ] as const).filter(([ , n ]) => n > 0);

    return (
        <div className="flex flex-col gap-3 p-4">
            <ol className="grid grid-cols-[repeat(auto-fill,minmax(4rem,1fr))] gap-2">
                {states.map((state, day) => (
                    <li key={day} title={`Day ${day + 1}: ${DOOR[state].label}. ${DOOR[state].meaning}`} className={cx('flex h-16 flex-col items-center justify-between rounded-lg border px-1 py-1 text-[11px]', STATE_CLASS[state])}>
                        <span className="font-mono tabular-nums">{day + 1}</span>
                        {state === 'future' ? <Lock className="size-4 text-muted" aria-hidden /> : <GiftPicture gift={gifts.get(day)} className="size-7" />}
                        <span className={cx('leading-none', state === 'available' ? 'font-medium text-accent' : 'text-muted')}>{DOOR[state].label}</span>
                    </li>
                ))}
            </ol>
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                {counts.map(([ state, n ]) => <li key={state}><span className="font-medium text-ink">{n} {DOOR[state].label.toLowerCase()}</span>: {DOOR[state].meaning}</li>)}
            </ul>
        </div>
    );
};

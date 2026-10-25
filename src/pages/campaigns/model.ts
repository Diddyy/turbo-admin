import type { CampaignCalendar, CampaignGift } from '#/api/campaigns';
import type { BadgeTone } from '#/components/ui';

const DAY_MS = 86_400_000;

/** Today's door: whole days since the start, -1 before it, `days` or more once it is over (the server's `CampaignCalendarRules.CurrentDay`). */
export const currentDay = (calendar: Pick<CampaignCalendar, 'startsAt'>, now = Date.now()) => {
    const starts = Date.parse(calendar.startsAt);

    return now < starts ? -1 : Math.floor((now - starts) / DAY_MS);
};

/** Where a calendar stands: players are sent it at login only while it is live. */
export type CalendarStatus = 'live' | 'upcoming' | 'ended' | 'off';

export const statusOf = (calendar: Pick<CampaignCalendar, 'startsAt' | 'days' | 'enabled'>, now = Date.now()): CalendarStatus => {
    if (!calendar.enabled) return 'off';

    const day = currentDay(calendar, now);

    if (day < 0) return 'upcoming';

    return day < calendar.days ? 'live' : 'ended';
};

export const STATUS: Record<CalendarStatus, { label: string; tone: BadgeTone; meaning: string }> = {
    live: { label: 'Live', tone: 'green', meaning: 'Sent to players at login; today\'s door can be opened.' },
    upcoming: { label: 'Scheduled', tone: 'accent', meaning: 'Sent from its first day, at each player\'s next login.' },
    ended: { label: 'Ended', tone: 'amber', meaning: 'Past its last day: not sent.' },
    off: { label: 'Off', tone: 'neutral', meaning: 'Not sent to anyone.' },
};

/**
 * How the client draws a door (AS3 `CalendarItem.resolveDayState`): opened; else after today is
 * future; else missed when the server lists it; else open to take. The server lists every earlier
 * door not opened as missed, so for a player who has opened none: earlier missed, today open, later future.
 */
export type DoorState = 'opened' | 'available' | 'missed' | 'future';

export const doorState = (day: number, today: number, opened: ReadonlySet<number> = new Set()): DoorState => {
    if (opened.has(day)) return 'opened';
    if (day > today) return 'future';

    return day < today ? 'missed' : 'available';
};

export const DOOR: Record<DoorState, { label: string; meaning: string }> = {
    opened: { label: 'Opened', meaning: 'Shows its gift.' },
    available: { label: 'Today', meaning: 'Open to take: a click on the door opens it and gives the gift.' },
    missed: { label: 'Missed', meaning: 'You\'re late: its day has gone, it can no longer be opened.' },
    future: { label: 'Later', meaning: 'Shut until its day.' },
};

/** What the client is told it got: the product code, else the furni's class name. */
export const shownProduct = (gift: CampaignGift) => gift.productCode.trim() || gift.furnitureClassName.trim();

export const blankGift = (dayIndex: number): CampaignGift => ({
    dayIndex,
    productCode: '',
    customImage: '',
    furnitureClassName: '',
    badgeCode: '',
    credits: 0,
    currencyTypeId: null,
    currencyAmount: 0,
    effectId: null,
});

/** The first day of the next month at midnight UTC: a start that is never in the past. */
const nextMonth = (now = new Date()) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString().replace('.000Z', 'Z');

export const blankCalendar = (): CampaignCalendar => ({ id: 0, name: '', image: '', startsAt: nextMonth(), days: 24, enabled: false, rewards: [] });

/** What a gift gives, in a few words: "Throne, 100 credits". */
export const giftText = (gift: CampaignGift, currencyName: (id: number) => string) => [
    gift.furnitureClassName && gift.furnitureClassName,
    gift.credits > 0 && `${gift.credits.toLocaleString()} credits`,
    gift.currencyAmount > 0 && gift.currencyTypeId !== null && `${gift.currencyAmount.toLocaleString()} ${currencyName(gift.currencyTypeId)}`,
    gift.badgeCode && `badge ${gift.badgeCode}`,
    gift.effectId !== null && `effect ${gift.effectId}`,
].filter(Boolean).join(', ') || 'Nothing given';

/** A UTC time in the viewer's own zone, to read beside the UTC one. */
export const localText = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

/** A UTC time as the server keeps it, short: 2026-12-01 00:00. */
export const utcText = (iso: string) => iso.replace('T', ' ').slice(0, 16);

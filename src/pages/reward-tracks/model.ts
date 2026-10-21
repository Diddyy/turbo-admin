import type { RewardTrack, RewardTrackListItem, RewardTrackPrize, RewardTrackProductType, RewardTrackTask } from '#/api/rewardTracks';
import type { BadgeTone } from '#/components/ui';
import { isoTime } from '#/pages/hotel-view/model';

/**
 * The client's track themes (AS3 `RewardTrackTheme.resolve`): dark, medium, light and active, by
 * theme name; any other name draws as blue.
 */
export const THEMES: Record<string, { dark: number; medium: number; light: number; active: number }> = {
    blue: { dark: 3503801, medium: 13624057, light: 14543865, active: 12441327 },
    orange: { dark: 13203736, medium: 16768946, light: 16773078, active: 16764817 },
    forest_green: { dark: 4164165, medium: 13494987, light: 14808031, active: 12115894 },
    red: { dark: 12077899, medium: 15846604, light: 16309725, active: 15186104 },
    cyan: { dark: 2072243, medium: 13103093, light: 14481403, active: 11921905 },
};

export const THEME_NAMES = Object.keys(THEMES);

export const themeOf = (theme: string) => THEMES[theme] ?? THEMES.blue!;

export const css = (color: number) => `#${color.toString(16).padStart(6, '0')}`;

/** Where a track stands for players now: off, not started, ended, or live. */
export type TrackStatus = 'live' | 'off' | 'upcoming' | 'ended';

export const statusOf = (track: Pick<RewardTrackListItem, 'enabled' | 'startsAt' | 'endsAt'>, now = Date.now()): TrackStatus => {
    if (!track.enabled) return 'off';

    const starts = isoTime(track.startsAt);
    const ends = isoTime(track.endsAt);

    if (starts !== null && now < starts) return 'upcoming';
    if (ends !== null && now >= ends) return 'ended';

    return 'live';
};

export const STATUS: Record<TrackStatus, { label: string; tone: BadgeTone; meaning: string }> = {
    live: { label: 'Live', tone: 'green', meaning: 'Sent to players at login; tasks count and prizes can be claimed.' },
    upcoming: { label: 'Scheduled', tone: 'accent', meaning: 'Sent from its start, at each player\'s next login.' },
    ended: { label: 'Ended', tone: 'amber', meaning: 'Past its end: not sent, nothing counts.' },
    off: { label: 'Off', tone: 'neutral', meaning: 'Not sent to anyone.' },
};

/** The track the Progression menu's own Introduction item opens (AS3 `ProgMenuController`). */
export const INTRODUCTION = 'introduction';

/** The text a track's Progression menu item shows: Introduction's own, else `widget.progmenu.rewardtrack.<id>`. */
export const menuTextKey = (id: string) => ((id === INTRODUCTION) ? 'widget.progmenu.introduction' : `widget.progmenu.rewardtrack.${id}`);

/**
 * The Progression menu's items as a player logging in now gets them (AS3 `ProgMenuController`):
 * the layout's own five, Introduction always among them, then an item per other live track, in the
 * tracks' order.
 */
export const MENU_ITEMS = [ 'Daily tasks', 'Quests', 'Achievements', 'Leaderboards' ];

export const menuTracks = (tracks: RewardTrackListItem[], now = Date.now()) => tracks.filter(x => x.id !== INTRODUCTION && statusOf(x, now) === 'live');

/** What a prize can give, by the client's product item type. */
export const PRODUCT_TYPES: { value: RewardTrackProductType; label: string; idLabel: string | null }[] = [
    { value: 8, label: 'Currency', idLabel: 'Currency type' },
    { value: 1, label: 'Floor item', idLabel: null },
    { value: 0, label: 'Wall item', idLabel: null },
    { value: 4, label: 'Badge', idLabel: 'Badge code' },
    { value: 12, label: 'Habbicon', idLabel: 'Habbicon id' },
    { value: 2, label: 'Effect', idLabel: 'Effect id' },
    { value: 10, label: 'Pet', idLabel: null },
    { value: 6, label: 'Bot', idLabel: null },
    { value: 9, label: 'Chat style', idLabel: 'Chat style id' },
];

export const productLabel = (type: number) => PRODUCT_TYPES.find(x => x.value === type)?.label ?? `Type ${type}`;

/** The hotel's currency types by number, as the client names them (`seasonalcurrency.id.<n>`); others by number. */
export const CURRENCIES: Record<string, string> = { 0: 'duckets', 5: 'diamonds', 104: 'letters' };

export const currencyName = (type: string) => CURRENCIES[type] ?? `type ${type}`;

/** A task's points, every level added up. */
export const taskPoints = (task: RewardTrackTask) => task.levels.reduce((sum, level) => sum + level.points, 0);

/** The points every task can give, premium levels included. */
export const trackPoints = (track: RewardTrack) => track.tasks.reduce((sum, task) => sum + taskPoints(task), 0);

export const blankTrack = (id: string): RewardTrack => ({ id, enabled: false, startsAt: null, endsAt: null, theme: 'blue', premium: null, tasks: [], prizes: [] });

export const blankTask = (id: string, actionType: string): RewardTrackTask => ({ id, actionType, parameter: '', premium: false, levels: [ { requiredCount: 1, points: 50, premium: false } ] });

export const blankPrize = (id: string, requiredPoints: number, premium: boolean): RewardTrackPrize => ({
    id, requiredPoints, productType: 8, rewardTypeId: '0', extraParams: '', amount: 100, premium, furnitureDefinitionId: null, name: '',
});

/** The first of `<stem>1`, `<stem>2`, ... that no item has. */
export const nextId = (stem: string, taken: { id: string }[]) => {
    const ids = new Set(taken.map(x => x.id));

    for (let i = 1; ; i++)
        if (!ids.has(`${stem}${i}`)) return `${stem}${i}`;
};

/** `RewardTrackRules.ID_MAX_LENGTH`. */
const ID_MAX_LENGTH = 64;

/** What stops a track saving: the server refuses the same, this says it before the round trip. */
export const problemsOf = (track: RewardTrack): string[] => {
    const problems: string[] = [];
    const twice = (ids: string[]) => ids.filter((id, index) => ids.indexOf(id) !== index);

    if (!track.id.trim() || track.id.length > ID_MAX_LENGTH) problems.push(`The track needs an id of at most ${ID_MAX_LENGTH} characters.`);
    for (const id of new Set(twice(track.tasks.map(x => x.id)))) problems.push(`Two tasks are called ${id}.`);
    for (const id of new Set(twice(track.prizes.map(x => x.id)))) problems.push(`Two prizes are called ${id}.`);
    for (const task of track.tasks) {
        if (!task.id.trim() || !task.actionType.trim()) problems.push('A task has no id or action type.');
        if (task.levels.length === 0) problems.push(`Task ${task.id} has no level.`);
        if (task.levels.some((level, index) => level.requiredCount < 1 || level.points < 0 || (index > 0 && level.requiredCount <= task.levels[index - 1]!.requiredCount)))
            problems.push(`Task ${task.id}: levels count up from 1, each higher than the one before, and give no negative points.`);
    }
    for (const prize of track.prizes)
        if (!prize.id.trim() || prize.requiredPoints < 0 || prize.amount < 1) problems.push(`Prize ${prize.id || '(no id)'} needs an id, points not below 0 and an amount of at least 1.`);

    const starts = isoTime(track.startsAt);
    const ends = isoTime(track.endsAt);

    if (starts !== null && ends !== null && ends <= starts) problems.push('The track ends before it starts.');
    if (track.premium && (track.premium.taskPointsBoost < 1 || track.premium.instantPoints < 0 || track.premium.costCredits < 0 || track.premium.costDiamonds < 0))
        problems.push('Premium needs a boost of at least 1, and points and costs not below 0.');

    return problems;
};

/** A list item moved one place up or down. */
export const moved = <T>(items: T[], index: number, by: -1 | 1) => {
    const next = [ ...items ];
    const target = index + by;

    if (target < 0 || target >= next.length) return items;

    [ next[index], next[target] ] = [ next[target]!, next[index]! ];

    return next;
};

/** A UTC time from the server as the panel writes it: `2026-11-02 00:00`. */
export const utcText = (iso: string | null) => (iso ? `${iso.replace('T', ' ').replace(/Z$/, '').slice(0, 16)}` : null);

/** A prize's furni here, by prize id, from the track's `furni`. */
export type FurniNames = ReadonlyMap<string, string>;

/** What a prize gives, in words: "250 duckets", "Badge DAD18", "hween_c26_chair". */
export const prizeText = (prize: RewardTrackPrize, furni: FurniNames) => {
    const amount = prize.amount > 1 ? `${prize.amount.toLocaleString()} ` : '';

    switch (prize.productType) {
        case 8: return `${amount}${currencyName(prize.rewardTypeId)}`;
        case 0:
        case 1: return `${amount}${furni.get(prize.id) ?? `sprite ${prize.rewardTypeId}`}`;
        case 10: return `Pet ${prize.extraParams}`;
        case 6: return 'Bot';
        default: return `${productLabel(prize.productType)} ${prize.rewardTypeId}`;
    }
};

/**
 * The draft as the `RewardTracks` message the server sends a player with `points` points, nothing
 * claimed and no task done (`PlayerRewardTrackGrain.Snapshot`), as the client's preview host takes it.
 */
export const rewardTracksMessage = (track: RewardTrack, points: number, premiumBought: boolean) => {
    const premium = premiumBought && !!track.premium;

    return {
        disabled: false,
        reload: false,
        tracks: [ {
            id: track.id,
            theme: track.theme,
            points,
            hasPremiumConfig: !!track.premium,
            taskPointsBoost: track.premium?.taskPointsBoost ?? 0,
            instantPoints: track.premium?.instantPoints ?? 0,
            costDiamonds: track.premium?.costDiamonds ?? 0,
            costCredits: track.premium?.costCredits ?? 0,
            premium,
            complete: !track.prizes.some(prize => !prize.premium),
            premiumComplete: !track.premium || track.prizes.length === 0,
            tasks: track.tasks.map(task => ({
                id: task.id,
                actionType: task.actionType,
                parameter: task.parameter,
                progressCount: 0,
                premium: task.premium,
                levels: task.levels.map(level => ({ requiredCount: level.requiredCount, pointsReward: level.points, premium: level.premium })),
            })),
            prizes: track.prizes.map(prize => ({
                id: prize.id,
                requiredPoints: prize.requiredPoints,
                productItemTypeId: prize.productType,
                rewardTypeId: prize.rewardTypeId,
                extraParams: prize.extraParams,
                rewardAmount: prize.amount,
                premium: prize.premium,
                available: (!prize.premium || premium) && points >= prize.requiredPoints,
                claimed: false,
            })),
        } ],
    };
};

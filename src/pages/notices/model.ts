/**
 * The client's new feature notices (Habbo's `SingularNotificationController` and
 * `NewFeatureNotification`), as the hotel's variables and texts hold them:
 *
 * - `notifications.new_feature.active`: the keys shown, a comma list. The column docks them in that
 *   order, except that one with an expiry or a countdown docks once the server has answered its
 *   times, so after the ones that wait for nothing.
 * - `notifications.new_feature.<field>.<key>`: each notice's `type` (`normal`, `promo`,
 *   `countdown`), `color`, `image` (one of the client's own images by name, or an address),
 *   `internal_link` (a client link) or else `external_link`, `expiry` and `count_down_to`
 *   (`yyyy-mm-dd hh:mm`, the server's time), `condition` (`reward_track_incomplete:<track>`) and
 *   `auto_open_condition` (`not_claimed:<product>`).
 * - the text `notifications.new_feature.<key>.desc`: its words.
 *
 * `notifications.new_feature.enabled` and `.key` are Habbo's too, but its client reads neither.
 *
 * The hotel's own (`EXTRA_FIELDS`, `EXTRA_TEXTS`), which Habbo's client has nothing for and this
 * hotel's client reads, each one empty keeping Habbo's behaviour: `show_from` (the server's time it
 * starts showing), `close` (`forever`: closed once, never again; `never`: no close), `audience`
 * (`hc`, `non_hc`, `new`), and the texts `<key>.open_button` / `<key>.cancel_link` (a normal
 * notice's Open and Close, over the shared `notifications.button.view` / `.cancel`).
 */
import { NOTICE_PREFIX, type NoticeData, type NoticeSave } from '#/api/notices';

export const ACTIVE_KEY = `${NOTICE_PREFIX}active`;

/** The fields Habbo's client reads. */
export const FIELDS = [ 'type', 'color', 'image', 'internal_link', 'external_link', 'expiry', 'count_down_to', 'condition', 'auto_open_condition' ] as const;

/** The fields only this hotel's client reads. */
export const EXTRA_FIELDS = [ 'show_from', 'close', 'audience' ] as const;

export const ALL_FIELDS = [ ...FIELDS, ...EXTRA_FIELDS ] as const;

export type NoticeField = typeof ALL_FIELDS[number];

/** A notice's texts: Habbo's words, then this hotel's button labels. */
export const TEXTS = [ 'desc', 'open_button', 'cancel_link' ] as const;

export type NoticeText = typeof TEXTS[number];

export const NOTICE_TYPES = [
    { value: 'normal', label: 'Normal' },
    { value: 'promo', label: 'Promo' },
    { value: 'countdown', label: 'Countdown' },
];

export const CLOSE_OPTIONS = [
    { value: '', label: 'Until next login' },
    { value: 'forever', label: 'For good' },
    { value: 'never', label: 'Can\'t close' },
];

export const AUDIENCE_OPTIONS = [
    { value: '', label: 'Everyone' },
    { value: 'hc', label: 'Habbo Club members' },
    { value: 'non_hc', label: 'Players without Habbo Club' },
    { value: 'new', label: 'New players' },
];

/** `BG_COLOR_NORMAL`: a notice's colour when it names none. */
export const DEFAULT_COLOR = '#686661';

export const CONDITION_REWARD_TRACK = 'reward_track_incomplete';
export const AUTO_OPEN_NOT_CLAIMED = 'not_claimed';

export interface Notice {
    key: string;
    fields: Record<NoticeField, string>;
    texts: Record<NoticeText, string>;
}

/** The notices and the order of the ones shown. */
export interface NoticeSet {
    notices: Notice[];
    active: string[];
}

export const fieldKey = (field: NoticeField, key: string) => `${NOTICE_PREFIX}${field}.${key}`;

export const textKey = (text: NoticeText, key: string) => `${NOTICE_PREFIX}${key}.${text}`;

export const descKey = (key: string) => textKey('desc', key);

/** A variable's JSON as the client reads it: text as it is, a number or a flag as text. */
export const readValue = (json: string | undefined) => {
    if (json === undefined) return '';

    try {
        const value = JSON.parse(json) as unknown;

        return (typeof value === 'string') ? value : String(value);
    } catch {
        return json;
    }
};

const emptyFields = () => Object.fromEntries(ALL_FIELDS.map(field => [ field, '' ])) as Record<NoticeField, string>;

const emptyTexts = () => Object.fromEntries(TEXTS.map(text => [ text, '' ])) as Record<NoticeText, string>;

export const newNotice = (key: string): Notice => ({ key, fields: { ...emptyFields(), type: 'promo', color: DEFAULT_COLOR }, texts: emptyTexts() });

/** A copy of a notice under another key. */
export const copyNotice = (notice: Notice, key: string): Notice => ({ key, fields: { ...notice.fields }, texts: { ...notice.texts } });

/** A key the client can look notices up by: letters, digits, `_` and `-`. */
export const validKey = (key: string) => /^[A-Za-z0-9_-]+$/.test(key);

/** A key no notice has yet: the name with `_copy`, then `_copy2`, ... after it. */
export const freeKey = (base: string, taken: (key: string) => boolean) => {
    for (let n = 1; ; n++) {
        const key = `${base}_copy${n === 1 ? '' : n}`;

        if (!taken(key)) return key;
    }
};

export const splitActive = (value: string) => value.split(',').map(x => x.trim()).filter(Boolean);

export const activeOf = (variables: Record<string, string>) => [ ...new Set(splitActive(readValue(variables[ACTIVE_KEY]))) ];

/** The notices variables and texts name, the shown ones first in their order, then the rest by key. */
export const parseNotices = (variables: Record<string, string>, texts: Record<string, string>): NoticeSet => {
    const active = activeOf(variables);
    const keys = new Set(active);

    for (const key of Object.keys(variables)) {
        const field = ALL_FIELDS.find(x => key.startsWith(`${NOTICE_PREFIX}${x}.`));

        if (field) keys.add(key.slice(`${NOTICE_PREFIX}${field}.`.length));
    }

    for (const key of Object.keys(texts)) {
        const text = TEXTS.find(x => key.endsWith(`.${x}`));

        if (key.startsWith(NOTICE_PREFIX) && text) keys.add(key.slice(NOTICE_PREFIX.length, -`.${text}`.length));
    }

    const ordered = [ ...active, ...[ ...keys ].filter(x => !active.includes(x)).sort() ].filter(key => key.length && !key.includes('.'));

    return {
        active,
        notices: ordered.map(key => ({
            key,
            fields: Object.fromEntries(ALL_FIELDS.map(field => [ field, readValue(variables[fieldKey(field, key)]) ])) as Record<NoticeField, string>,
            texts: Object.fromEntries(TEXTS.map(text => [ text, texts[textKey(text, key)] ?? '' ])) as Record<NoticeText, string>,
        })),
    };
};

export const parseNoticeData = (data: NoticeData) => parseNotices(data.variables, data.texts);

export const sameNotice = (a: Notice | undefined, b: Notice | undefined) =>
    !!a && !!b && a.key === b.key && ALL_FIELDS.every(x => a.fields[x].trim() === b.fields[x].trim()) && TEXTS.every(x => a.texts[x] === b.texts[x]);

const want = (variables: Record<string, string | null>, server: NoticeData, key: string, value: string) => {
    const json = value.trim() ? JSON.stringify(value.trim()) : null;

    if (json === null ? (key in server.variables) : (readValue(server.variables[key]) !== value.trim() || !(key in server.variables)))
        variables[key] = json;
};

/**
 * What saving one notice changes against the hotel's: each field as a JSON text (empty removes
 * it) and each text; a removed notice (null) takes its variables and texts with it.
 */
export const diffNotice = (key: string, notice: Notice | null, server: NoticeData): NoticeSave => {
    const variables: Record<string, string | null> = {};
    const texts: Record<string, string | null> = {};

    for (const field of ALL_FIELDS) {
        if (notice) want(variables, server, fieldKey(field, key), notice.fields[field]);
        else if (fieldKey(field, key) in server.variables) variables[fieldKey(field, key)] = null;
    }

    for (const text of TEXTS) {
        const at = textKey(text, key);
        const value = notice?.texts[text] ?? '';

        if (value !== (server.texts[at] ?? '')) {
            if (value) texts[at] = value;
            else if (at in server.texts) texts[at] = null;
        }
    }

    return { variables, texts };
};

/** What saving the shown keys, in their order, changes. */
export const diffActive = (active: string[], server: NoticeData): NoticeSave => {
    const variables: Record<string, string | null> = {};

    want(variables, server, ACTIVE_KEY, active.join(','));

    return { variables, texts: {} };
};

export const mergeSaves = (...saves: NoticeSave[]): NoticeSave => ({
    variables: Object.assign({}, ...saves.map(x => x.variables)) as Record<string, string | null>,
    texts: Object.assign({}, ...saves.map(x => x.texts)) as Record<string, string | null>,
});

/** What saving the whole set changes against the hotel's; a notice no longer in it goes. */
export const diffNotices = (set: NoticeSet, server: NoticeData): NoticeSave => {
    const kept = new Set(set.notices.map(x => x.key));

    return mergeSaves(
        diffActive(set.active, server),
        ...set.notices.map(x => diffNotice(x.key, x, server)),
        ...parseNoticeData(server).notices.filter(x => !kept.has(x.key)).map(x => diffNotice(x.key, null, server)),
    );
};

export const countChanges = (save: NoticeSave) => Object.keys(save.variables).length + Object.keys(save.texts).length;

/** How a notice stands against Habbo's of the same key, on what Habbo's client reads. */
export type HabboStatus = 'same' | 'differs' | 'ours';

/** The fields and words where a notice differs from Habbo's; Habbo's words are left out while unknown. */
export const habboDifferences = (notice: Notice, habbo: Notice, habboWordsKnown: boolean) => [
    ...FIELDS.filter(x => notice.fields[x].trim() !== habbo.fields[x].trim()),
    ...(habboWordsKnown && notice.texts.desc !== habbo.texts.desc ? [ 'desc' as const ] : []),
];

export const habboStatus = (notice: Notice, habbo: Notice | undefined, habboWordsKnown: boolean): HabboStatus =>
    !habbo ? 'ours' : habboDifferences(notice, habbo, habboWordsKnown).length ? 'differs' : 'same';

/**
 * A notice made Habbo's again: Habbo's fields and (when known) words; this hotel's own fields and
 * button labels stay, Habbo having none of them.
 */
export const takeHabbos = (notice: Notice | undefined, habbo: Notice, habboWordsKnown: boolean): Notice => ({
    key: habbo.key,
    fields: { ...(notice?.fields ?? emptyFields()), ...Object.fromEntries(FIELDS.map(x => [ x, habbo.fields[x] ])) } as Record<NoticeField, string>,
    texts: { ...(notice?.texts ?? emptyTexts()), desc: habboWordsKnown ? habbo.texts.desc : (notice?.texts.desc ?? '') },
});

/** `ColorConverter.hexToUint`: `#rrggbb` (or without the `#`), black when it is none. */
export const parseColor = (value: string) => {
    const hex = value.trim().replace(/^(#|0x)/i, '');

    return /^[0-9a-f]{6}$/i.test(hex) ? `#${hex.toLowerCase()}` : null;
};

/**
 * `initLayout`'s open button: the colour with its HSL lightness halfway to white
 * (`255 - (255 - l) / 2`).
 */
export const lighterHalfway = (color: string) => {
    const value = parseInt(color.slice(1), 16);
    const [ r, g, b ] = [ (value >> 16) & 255, (value >> 8) & 255, value & 255 ].map(x => x / 255) as [ number, number, number ];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    const d = max - min;
    const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    const h = d === 0 ? 0 : max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    const lighter = 1 - (1 - l) / 2;

    return `hsl(${Math.round(h * 60 + 360) % 360} ${Math.round(s * 100)}% ${Math.round(lighter * 100)}%)`;
};

/** A condition's two parts (`reward_track_incomplete:introduction`); empty ones for none. */
export const splitCondition = (value: string) => {
    const at = value.indexOf(':');

    return at < 0 ? { kind: value, arg: '' } : { kind: value.slice(0, at), arg: value.slice(at + 1) };
};

/** `yyyy-mm-dd hh:mm` (the variables' form) to and from a `datetime-local` input's. */
export const toLocalInput = (value: string) => (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(value.trim()) ? value.trim().replace(' ', 'T') : '');

export const fromLocalInput = (value: string) => (value ? value.slice(0, 16).replace('T', ' ') : '');

/** A time in the variables' form as a moment, read in the panel's own time zone; null for none. */
export const timeOf = (value: string) => {
    const local = toLocalInput(value);

    return local ? new Date(local).getTime() : null;
};

/** Whether a time in the variables' form has passed, read in the panel's own time zone. */
export const hasPassed = (value: string, now = Date.now()) => {
    const at = timeOf(value);

    return at !== null && at <= now;
};

/** `CountdownWidget`'s `dd:hh:mm:ss` for the seconds left. */
export const countdownText = (seconds: number) => {
    const left = Math.max(0, Math.floor(seconds));
    const parts = [ Math.floor(left / 86400), Math.floor(left / 3600) % 24, Math.floor(left / 60) % 60, left % 60 ];

    return parts.map(x => String(x).padStart(2, '0')).join(':');
};

/** Why players don't see a shown notice now, by the panel's clock; null when they do. */
export const hiddenReason = (notice: Notice, now = Date.now()) => {
    if (hasPassed(notice.fields.expiry, now)) return 'expired';

    if (notice.fields.show_from && !hasPassed(notice.fields.show_from, now)) return 'not yet';

    return null;
};

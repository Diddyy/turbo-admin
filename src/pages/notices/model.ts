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
 */
import { NOTICE_PREFIX, type NoticeData, type NoticeSave } from '#/api/notices';

export const ACTIVE_KEY = `${NOTICE_PREFIX}active`;

export const FIELDS = [ 'type', 'color', 'image', 'internal_link', 'external_link', 'expiry', 'count_down_to', 'condition', 'auto_open_condition' ] as const;

export type NoticeField = typeof FIELDS[number];

export const NOTICE_TYPES = [
    { value: 'normal', label: 'Normal' },
    { value: 'promo', label: 'Promo' },
    { value: 'countdown', label: 'Countdown' },
];

/** `BG_COLOR_NORMAL`: a notice's colour when it names none. */
export const DEFAULT_COLOR = '#686661';

export const CONDITION_REWARD_TRACK = 'reward_track_incomplete';
export const AUTO_OPEN_NOT_CLAIMED = 'not_claimed';

export interface Notice {
    key: string;
    fields: Record<NoticeField, string>;
    desc: string;
}

/** The notices and the order of the ones shown. */
export interface NoticeSet {
    notices: Notice[];
    active: string[];
}

export const fieldKey = (field: NoticeField, key: string) => `${NOTICE_PREFIX}${field}.${key}`;

export const descKey = (key: string) => `${NOTICE_PREFIX}${key}.desc`;

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

const emptyFields = () => Object.fromEntries(FIELDS.map(field => [ field, '' ])) as Record<NoticeField, string>;

export const newNotice = (key: string): Notice => ({ key, fields: { ...emptyFields(), type: 'promo', color: DEFAULT_COLOR }, desc: '' });

/** A key the client can look notices up by: letters, digits, `_` and `-`. */
export const validKey = (key: string) => /^[A-Za-z0-9_-]+$/.test(key);

export const splitActive = (value: string) => value.split(',').map(x => x.trim()).filter(Boolean);

/** The notices variables and texts name, the shown ones first in their order, then the rest by key. */
export const parseNotices = (variables: Record<string, string>, texts: Record<string, string>): NoticeSet => {
    const active = [ ...new Set(splitActive(readValue(variables[ACTIVE_KEY]))) ];
    const keys = new Set(active);

    for (const key of Object.keys(variables)) {
        const field = FIELDS.find(x => key.startsWith(`${NOTICE_PREFIX}${x}.`));

        if (field) keys.add(key.slice(`${NOTICE_PREFIX}${field}.`.length));
    }

    for (const key of Object.keys(texts))
        if (key.startsWith(NOTICE_PREFIX) && key.endsWith('.desc')) keys.add(key.slice(NOTICE_PREFIX.length, -'.desc'.length));

    const ordered = [ ...active, ...[ ...keys ].filter(x => !active.includes(x)).sort() ].filter(key => key.length && !key.includes('.'));

    return {
        active,
        notices: ordered.map(key => ({
            key,
            fields: Object.fromEntries(FIELDS.map(field => [ field, readValue(variables[fieldKey(field, key)]) ])) as Record<NoticeField, string>,
            desc: texts[descKey(key)] ?? '',
        })),
    };
};

export const parseNoticeData = (data: NoticeData) => parseNotices(data.variables, data.texts);

/**
 * What saving the set changes against the hotel's: each field as a JSON text (empty removes it),
 * the shown keys, and the words. A notice no longer in the set takes its variables and text with it.
 */
export const diffNotices = (set: NoticeSet, server: NoticeData): NoticeSave => {
    const variables: Record<string, string | null> = {};
    const texts: Record<string, string | null> = {};
    const want = (key: string, value: string) => {
        const json = value.trim() ? JSON.stringify(value.trim()) : null;

        if (json === null ? (key in server.variables) : (readValue(server.variables[key]) !== value.trim() || !(key in server.variables)))
            variables[key] = json;
    };

    want(ACTIVE_KEY, set.active.join(','));

    const kept = new Set(set.notices.map(x => x.key));

    for (const notice of set.notices) {
        for (const field of FIELDS) want(fieldKey(field, notice.key), notice.fields[field]);

        const desc = descKey(notice.key);

        if (notice.desc !== (server.texts[desc] ?? '')) {
            if (notice.desc) texts[desc] = notice.desc;
            else if (desc in server.texts) texts[desc] = null;
        }
    }

    for (const notice of parseNoticeData(server).notices) {
        if (kept.has(notice.key)) continue;

        for (const field of FIELDS) if (fieldKey(field, notice.key) in server.variables) variables[fieldKey(field, notice.key)] = null;

        if (descKey(notice.key) in server.texts) texts[descKey(notice.key)] = null;
    }

    return { variables, texts };
};

export const countChanges = (save: NoticeSave) => Object.keys(save.variables).length + Object.keys(save.texts).length;

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

/** Whether a time in the variables' form has passed, read in the panel's own time zone. */
export const hasPassed = (value: string, now = Date.now()) => {
    const local = toLocalInput(value);

    return !!local && new Date(local).getTime() <= now;
};

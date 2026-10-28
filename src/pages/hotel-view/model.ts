/**
 * The hotel view as the client reads it from its `landing.view.*` variables (nitro-react's
 * `HotelViewWidgets.ts` / `HotelViewSlice.ts`, after Flash's `WidgetContainerLayout`), so the
 * panel writes exactly what the client parses. Pure functions of the values.
 */
import type { ImageAccept } from '#/api/media';

export const PREFIX = 'landing.view.';

/** The reception's background layers, back to front, as `landing_view_default_dynamic_layout` names them. */
export const BACKGROUND_LAYERS = [
    { name: 'background_gradient_top', label: 'Sky, above the gradient', hint: 'Stretched across the top. Seen only on a window taller than 821 pixels.' },
    { name: 'background_gradient', label: 'Gradient', hint: 'Repeated across the whole width, 1150 pixels tall, its foot on the toolbar.' },
    { name: 'background_right', label: 'Right', hint: 'At its own size, in the bottom right corner.' },
    { name: 'background_horizon', label: 'Horizon', hint: 'At its own size, in the bottom left corner, behind the widgets.' },
    { name: 'background_hotel_top', label: 'Hotel top', hint: '123 pixels wide, above the hotel on a tall window.' },
    { name: 'background_left', label: 'Left (the hotel)', hint: 'At its own size, in the bottom left corner, in front of the widgets.' },
] as const;

export type BackgroundLayer = (typeof BACKGROUND_LAYERS)[number]['name'];

/** The widget slots: 1 across the top, 2 and 4 the left column, 3 and 5 the right. */
export const SLOTS = [ 1, 2, 3, 4, 5 ] as const;

/** `LandingViewWidgetType`: what a slot or a promo can be. `drawn` is whether Nitro draws it yet. */
export const WIDGET_TYPES = [
    { value: 'generic', label: 'Promo (generic)', drawn: true },
    { value: 'widgetcontainer', label: 'Scheduled promos (container)', drawn: true },
    { value: 'bonusrare', label: 'Bonus rare', drawn: true },
    { value: 'promoarticle', label: 'Promo articles', drawn: true },
    { value: 'communitygoal', label: 'Community goal', drawn: true },
    { value: 'communitygoalvsmode', label: 'Community goal, versus', drawn: true },
    { value: 'communitygoalvsmodevote', label: 'Community goal, versus vote', drawn: true },
    { value: 'catalogpromo', label: 'Catalogue promo', drawn: false },
    { value: 'catalogpromosmall', label: 'Catalogue promo, small', drawn: false },
    { value: 'expiringcatalogpage', label: 'Expiring catalogue page', drawn: true },
    { value: 'expiringcatalogpagesmall', label: 'Expiring catalogue page, small', drawn: true },
    { value: 'dailyquest', label: 'Daily quest', drawn: false },
    { value: 'nextlimitedrarecountdown', label: 'Next limited rare countdown', drawn: true },
    { value: 'achievementcompetition_hall_of_fame', label: 'Competition hall of fame', drawn: false },
    { value: 'achievementcompetition_prizes', label: 'Competition prizes', drawn: false },
    { value: 'habbomoderationpromo', label: 'Moderation promo', drawn: false },
    { value: 'habbotalentspromo', label: 'Talents promo', drawn: false },
    { value: 'habbowaypromo', label: 'Habbo Way promo', drawn: false },
    { value: 'roomhoppernetwork', label: 'Room hopper', drawn: false },
    { value: 'safetyquizpromo', label: 'Safety quiz promo', drawn: false },
    { value: 'avatarimage', label: 'Avatar image', drawn: false },
] as const;

export const widgetLabel = (type: string) => WIDGET_TYPES.find(x => x.value === type)?.label ?? type;

export const isDrawn = (type: string) => WIDGET_TYPES.some(x => x.value === type && x.drawn);

/**
 * The bottom slot (`landing.view.dynamic.slot.6.widget`): the default layout's placeholder near the
 * foot of the window, which takes only the layout's fixed widgets. Of those, Nitro draws these.
 */
export const BOTTOM_SLOT = 6;
export const BOTTOM_SLOT_WIDGETS = [ 'expiringcatalogpage', 'expiringcatalogpagesmall', 'communitygoal', 'nextlimitedrarecountdown' ] as const;

/** Every slot, the bottom one last. */
export const ALL_SLOTS = [ ...SLOTS, BOTTOM_SLOT ] as const;

/** Where each slot is on the reception. */
export const SLOT_PLACES: Record<number, string> = {
    1: 'across the top',
    2: 'left column, top',
    3: 'right column, top',
    4: 'left column, bottom',
    5: 'right column, bottom',
    [BOTTOM_SLOT]: 'at the bottom, beside the avatar',
};

/** What the reception view has open to edit: its backgrounds, its look, or a slot by its number. */
export type ReceptionPart = 'backgrounds' | 'look' | number;

/** The part a `?edit=` names; null for none, or one not known. */
export const parsePart = (value: string | null): ReceptionPart | null => {
    if (value === 'backgrounds' || value === 'look') return value;

    return value && (ALL_SLOTS as readonly number[]).includes(Number(value)) ? Number(value) : null;
};

/** Slots 3 and 5 are the right pane; the rest are as wide as the left. */
export const isWideSlot = (slot: number) => slot !== 3 && slot !== 5;

// --- Keys -----------------------------------------------------------------------------------

export const slotKey = (slot: number, name: 'widget' | 'conf' | 'layout' | 'separator' | 'title' | 'ignore') => `${PREFIX}dynamic.slot.${slot}.${name}`;

export const codeKey = (code: string, name: 'widget' | 'conf' | 'layout') => `${PREFIX}${code}.${name}`;

/** A background layer's variable: the default one, or the one a background code replaces it with. */
export const layerKey = (code: string, layer: string, name: 'uri' | 'visible') => `${PREFIX}${code ? `${code}.` : ''}${layer}.${name}`;

export const BG_TIMING = `${PREFIX}bgtiming`;

export const COMMON = {
    textColor: `${PREFIX}common.textcolor`,
    etchingColor: `${PREFIX}common.etchingcolor`,
    etchingPosition: `${PREFIX}common.etchingposition`,
    leftPaneWidth: `${PREFIX}dynamic.leftPaneWidth`,
    rightPaneWidth: `${PREFIX}dynamic.rightPaneWidth`,
    bonusRareImage: `${PREFIX}bonus.rare.image.uri`,
} as const;

/**
 * What the fixed widgets read besides their slot: the next limited rare's switch (named outside
 * `landing.view.`), the community goal's catalogue button, and the catalogue promo's and room
 * hopper's targets and pictures, as Flash's widgets read them.
 */
export const WIDGET_SETTINGS = {
    nextLimitedRareDisabled: 'next.limited.rare.countdown.widget.disabled',
    communityInteractive: `${PREFIX}community.interactive`,
    communityCatalogTarget: `${PREFIX}community.catalog.target`,
    catalogPromoTarget: `${PREFIX}catalog.promo.target`,
    catalogPromoImage: `${PREFIX}catalog.promo.image.uri`,
    roomHopperNetwork: `${PREFIX}roomhopper.network.id`,
    roomHopperImage: `${PREFIX}roomhopper.image.uri`,
} as const;

/** The catalogue promo's texts (`CatalogPromoWidget`), the same for every hotel's one promo. */
export const CATALOG_PROMO_TEXTS = [
    { key: 'landing.view.catalog.promo.title', label: 'Title' },
    { key: 'landing.view.catalog.promo.caption', label: 'Caption' },
    { key: 'landing.view.catalog.promo.info', label: 'Info' },
    { key: 'landing.view.catalog.promo.picture.text', label: 'Picture text' },
    { key: 'landing.view.catalog.open.page', label: 'Button' },
] as const;

/** An expiring page's texts: by the page's name. */
export const pageExpiryTextKey = (page: string, name: 'header' | 'desc') => `${PREFIX}pageexpiry.page.${page}.${name}`;

// --- Moving background objects -----------------------------------------------------------------

/** `MovingBackgroundObjects.MAX_OBJECTS`. */
export const MAX_MOVING_OBJECTS = 20;

/** A moving object's variable: `landing.view.bgobject.<n>`, or a background set's `landing.view.<code>.bgobject.<n>`. */
export const bgObjectKey = (code: string, n: number) => `${PREFIX}${code ? `${code}.` : ''}bgobject.${n}`;

/**
 * The kinds of moving object and their fields after `<image>;<type>`, as nitro-next's
 * `movingBackgroundObjects.ts` reads them. A random walk's image is under the image library itself;
 * the rest are under its `reception/`.
 */
export const MOVING_TYPES = [
    { value: 'line', label: 'Line', fields: [ 'Start x', 'Start y (from the bottom)', 'Speed x (px/ms)', 'Speed y (px/ms)' ] },
    { value: 'randomwalk', label: 'Random walk', fields: [ 'Start x', 'Start y', 'Speed x (px/s)', 'Speed y (px/s)', 'Jitter x', 'Jitter y', 'Every (ms)' ] },
    { value: 'spiral', label: 'Spiral', fields: [ 'Start radius', 'Start angle', 'Radius speed', 'Angle speed', 'Centre x', 'Centre y' ] },
    { value: 'animated', label: 'Animation', fields: [ 'Frames', 'Frames a second', 'X', 'Y', 'Plays when these objects start over (ids, comma-separated)' ] },
] as const;

export interface MovingObject {
    image: string;
    type: string;
    args: string[];
}

export const parseMovingObject = (value: string): MovingObject => {
    const [ image = '', type = '', ...args ] = value.split(';');

    return { image, type, args };
};

export const formatMovingObject = (object: MovingObject) => [ object.image.trim(), object.type, ...object.args.map(x => x.trim()) ].join(';');

/** Where the client loads a moving object's picture from, under the image library. */
export const movingObjectPath = (object: MovingObject) => (object.type === 'animated' ? `reception/${object.image}1.png` : object.type === 'randomwalk' ? `${object.image}.png` : `reception/${object.image}.png`);

/** A promo code may be any word the variables can follow; these are taken by the hotel view's own keys. */
const RESERVED_CODES = new Set([ 'dynamic', 'common', 'bonus', 'bgtiming', 'bgobject', 'catalog', 'community', 'roomhopper', 'pageexpiry', ...BACKGROUND_LAYERS.map(x => x.name) ]);

export const codeProblem = (code: string, taken: string[]) => {
    if (!code) return 'A promo needs a code.';
    if (!/^[A-Za-z0-9_-]+$/.test(code)) return 'Letters, digits, - and _ only: the code is part of its variables\' keys.';
    if (RESERVED_CODES.has(code)) return 'The hotel view uses that word for something else.';
    if (taken.includes(code)) return 'There is a promo with that code.';

    return null;
};

/** The promo codes: every `landing.view.<code>.widget`, and every code a schedule names. */
export const promoCodes = (keys: string[], scheduled: string[]) => {
    const codes = new Set<string>();

    for (const key of keys) {
        const match = /^landing\.view\.([^.]+)\.widget$/.exec(key);

        if (match?.[1] && !RESERVED_CODES.has(match[1])) codes.add(match[1]);
    }

    for (const code of scheduled) if (code) codes.add(code);

    return [ ...codes ].sort((a, b) => a.localeCompare(b));
};

/** The background codes: those `bgtiming` names, and any code with a layer of its own. */
export const backgroundCodes = (keys: string[], scheduled: string[]) => {
    const codes = new Set(scheduled.filter(Boolean));
    const layers = BACKGROUND_LAYERS.map(x => x.name).join('|');
    const pattern = new RegExp(`^landing\\.view\\.([^.]+)\\.((${layers})\\.(uri|visible)|bgobject\\.\\d+)$`);

    for (const key of keys) {
        const match = pattern.exec(key);

        if (match?.[1]) codes.add(match[1]);
    }

    return [ ...codes ].sort((a, b) => a.localeCompare(b));
};

// --- Schedules ------------------------------------------------------------------------------

/** One `date,code` of a schedule: from that time (UTC) on, until a later entry starts. */
export interface ScheduleEntry {
    /** `yyyy-MM-dd HH:mm`, as the server reads it, in UTC. */
    at: string;
    code: string;
}

export const parseSchedule = (value: string): ScheduleEntry[] => value
    .split(';')
    .map(entry => entry.trim())
    .filter(Boolean)
    .map((entry) => {
        const comma = entry.indexOf(',');

        return comma < 0 ? { at: entry, code: '' } : { at: entry.slice(0, comma).trim(), code: entry.slice(comma + 1).trim() };
    });

export const formatSchedule = (entries: ScheduleEntry[]) => entries
    .filter(x => x.at.trim() || x.code.trim())
    .map(x => `${x.at.trim()},${x.code.trim()}`)
    .join(';');

/** `ReceptionSchedule.TryParseTime`: `yyyy-MM-dd HH:mm[:ss]`, UTC. Null when it isn't one. */
export const parseTime = (value: string) => {
    const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());

    if (!match) return null;

    const [ , y = '', mo = '', d = '', h = '', mi = '', s = '' ] = match;
    const time = Date.UTC(+y, +mo - 1, +d, +h, +mi, s ? +s : 0);

    return Number.isNaN(time) ? null : time;
};

/** `ReceptionSchedule.GetCurrentCode`: the code of the latest entry started by `now`; empty before any. */
export const currentCode = (entries: ScheduleEntry[], now: number) => {
    let code = '';
    let latest = -Infinity;
    let index = -1;

    entries.forEach((entry, i) => {
        const at = parseTime(entry.at);

        if (at !== null && at <= now && at >= latest) {
            latest = at;
            code = entry.code;
            index = i;
        }
    });

    return { code, index };
};

/**
 * When each entry shows: from its time until the next entry starts (null: for good). An entry
 * hidden by a later one at the same time has `until` equal to `from`; one with no time, both null.
 */
export const scheduleWindows = (entries: ScheduleEntry[]) => entries.map((entry, index) => {
    const from = parseTime(entry.at);
    let until: number | null = null;

    if (from !== null) {
        entries.forEach((other, i) => {
            const at = parseTime(other.at);

            if (i !== index && at !== null && (at > from || (at === from && i > index)) && (until === null || at < until)) until = at;
        });
    }

    return { entry, index, from, until };
});

/**
 * The schedule with `code` added from `from` on, in time order. Given `until`, the slot goes back
 * then to what it would have shown without it. Later entries still take over when they start.
 */
export const scheduleBetween = (entries: ScheduleEntry[], code: string, from: string, until: string | null) => {
    const untilTime = until ? parseTime(until) : null;
    const added = [ ...entries, { at: from, code } ];

    if (until && untilTime !== null) added.push({ at: until, code: currentCode(entries, untilTime).code });

    // Stable: entries at the same time keep their order, so the one added still wins.
    const time = (entry: ScheduleEntry) => parseTime(entry.at) ?? Number.MAX_SAFE_INTEGER;

    return added.sort((a, b) => time(a) - time(b));
};

/** A schedule time for a `datetime-local` input, and back. */
export const toLocalInput = (at: string) => at.trim().replace(' ', 'T').slice(0, 16);
export const fromLocalInput = (value: string) => value.replace('T', ' ').slice(0, 16);

/** Now, as a schedule writes it. */
export const nowAt = (time = Date.now()) => new Date(time).toISOString().slice(0, 16).replace('T', ' ');

// --- Generic widgets ------------------------------------------------------------------------

/** The element types a promo's content column takes, and what each argument is. */
export const ELEMENT_TYPES = [
    { value: 'caption', label: 'Heading', args: [ 'text', 'width' ] },
    { value: 'subcaption', label: 'Subheading', args: [ 'text', 'width' ] },
    { value: 'bodytext', label: 'Text', args: [ 'text', 'width' ] },
    { value: 'catalogbutton', label: 'Catalogue button', args: [ 'text', 'page' ] },
    { value: 'internallinkbutton', label: 'Client link button', args: [ 'text', 'link' ] },
    { value: 'link', label: 'Web link', args: [ 'text', 'url' ] },
    { value: 'spacing', label: 'Space', args: [ 'height' ] },
    { value: 'customtimer', label: 'Countdown', args: [ 'floating', 'x', 'y', 'running', 'expired', 'until' ] },
] as const;

export type ElementArg = (typeof ELEMENT_TYPES)[number]['args'][number];

export interface GenericElement {
    type: string;
    args: string[];
}

/** `configureContentColumn`: `;` between elements, `,` between an element's arguments. */
export const parseConf = (conf: string): GenericElement[] => conf.split(';').filter(Boolean).map((entry) => {
    const [ type = '', ...args ] = entry.split(',');

    return { type, args };
});

export const formatConf = (elements: GenericElement[]) => elements.map(x => [ x.type, ...trimTrailing(x.args) ].join(',')).join(';');

const trimTrailing = (args: string[]) => {
    const copy = [ ...args ];

    while (copy.length > 0 && copy[copy.length - 1] === '') copy.pop();

    return copy;
};

/** The text keys an element shows: the first argument of a text or button, a countdown's two captions. */
export const elementTextKeys = (element: GenericElement) => {
    switch (element.type) {
        case 'caption':
        case 'subcaption':
        case 'bodytext':
        case 'catalogbutton':
        case 'internallinkbutton':
        case 'link':
            return element.args[0] ? [ element.args[0] ] : [];
        case 'customtimer':
            return [ element.args[3], element.args[4] ].filter((x): x is string => !!x);
        default:
            return [];
    }
};

/** Which arguments of an element are text keys, by position. */
export const isTextArg = (type: string, index: number) => (type === 'customtimer' ? index === 3 || index === 4 : index === 0 && type !== 'spacing');

/** `configureLayout`'s keys, as a promo's layout writes them. */
export interface GenericLayout {
    'bitmap.uri': string;
    'bitmap.x': string;
    'bitmap.y': string;
    'bitmap.width': string;
    'bitmap.height': string;
    'content.x': string;
    'content.y': string;
    'content.width': string;
    'container.height': string;
}

export const LAYOUT_FIELDS: (keyof GenericLayout)[] = [ 'bitmap.uri', 'bitmap.x', 'bitmap.y', 'bitmap.width', 'bitmap.height', 'content.x', 'content.y', 'content.width', 'container.height' ];

export const parseLayout = (layout: string): GenericLayout => {
    const result = Object.fromEntries(LAYOUT_FIELDS.map(x => [ x, '' ])) as unknown as GenericLayout;

    for (const entry of layout.split(';')) {
        const comma = entry.indexOf(',');

        if (comma < 0) continue;

        const key = entry.slice(0, comma) as keyof GenericLayout;

        if (LAYOUT_FIELDS.includes(key)) result[key] = entry.slice(comma + 1);
    }

    return result;
};

export const formatLayout = (layout: GenericLayout) => LAYOUT_FIELDS.filter(x => layout[x].trim() !== '').map(x => `${x},${layout[x].trim()}`).join(';');

/** What the client draws a promo with: `parseHotelViewGenericLayout`'s defaults filled in. */
export const resolveLayout = (layout: GenericLayout, wide: boolean) => {
    const number = (value: string, fallback: number) => (value.trim() === '' ? fallback : parseInt(value, 10) | 0);
    const optional = (value: string) => (value.trim() === '' ? null : parseInt(value, 10) | 0);

    return {
        bitmapUri: layout['bitmap.uri'],
        bitmapX: number(layout['bitmap.x'], 10),
        bitmapY: number(layout['bitmap.y'], 10),
        bitmapWidth: optional(layout['bitmap.width']),
        bitmapHeight: optional(layout['bitmap.height']),
        contentX: optional(layout['content.x']) ?? (wide ? 230 : 0),
        contentY: number(layout['content.y'], 0),
        contentWidth: number(layout['content.width'], 250),
        containerHeight: Math.max(number(layout['container.height'], 30), 30),
    };
};

// --- Values ---------------------------------------------------------------------------------

/** A variable's JSON value as the client reads it: text as it is, a number or true/false as text. */
export const readValue = (json: string | null | undefined) => {
    if (json === null || json === undefined) return '';

    try {
        const value: unknown = JSON.parse(json);

        return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? String(value) : '';
    } catch {
        return '';
    }
};

/**
 * `${key}` replaced with the key's value, as the client's configuration does, up to ten rounds.
 * `image.library.url` is the client's, which the panel knows; the rest are the hotel view's own.
 */
export const interpolate = (text: string, lookup: (key: string) => string | undefined) => {
    let value = text;

    for (let pass = 0; pass < 10; pass++) {
        const next = value.replace(/\$\{([^}]+)\}/g, (match, name: string) => lookup(name) ?? match);

        if (next === value) break;

        value = next;
    }

    return value;
};

/** A colour as the variables keep it (`ffffff`, `0xff000000`), for a colour input. */
export const toColorInput = (value: string) => {
    const hex = value.trim().replace(/^(#|0x)/i, '');

    return /^[0-9a-f]{6}$/i.test(hex) ? `#${hex}` : /^[0-9a-f]{8}$/i.test(hex) ? `#${hex.slice(2)}` : '#000000';
};

// --- Times the server keeps -----------------------------------------------------------------

/** A UTC time from the server (marked Z or not) for a `datetime-local` input, read as UTC. */
export const isoToInput = (iso: string | null) => (iso ? iso.replace(/Z$/, '').slice(0, 16) : '');

/** A `datetime-local` input, read as UTC, for the server; null when empty. */
export const inputToIso = (value: string) => (value ? `${value}:00Z` : null);

/** A UTC time from the server, as a number. */
export const isoTime = (iso: string | null) => (iso ? Date.parse(/Z$|[+-]\d\d:\d\d$/.test(iso) ? iso : `${iso}Z`) : null);

/** What the hotel view's pictures are: an address under the client's image library (`${image.library.url}reception/x.png`), or a full one. */
export const LIBRARY_ADDRESS: ImageAccept = { shapes: [ 'libraryUrl', 'url' ] };

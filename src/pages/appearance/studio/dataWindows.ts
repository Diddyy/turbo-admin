import type { DataWindowElement, DataWindowFile, DataWindowTemplate, PluginWindow } from '#/api/dataWindows';
import { dataWindowTemplateId } from '#/api/dataWindows';
import type { TemplateIndex, WindowElement } from '#/api/windows';

/** The area the studio lists a theme's own windows under, first. */
export const OWN_WINDOWS_AREA = 'This theme\'s windows';

/** How a new window starts. */
export type WindowStarter = 'blank' | 'dialog' | 'card' | 'list' | 'copy';

export const STARTERS: { value: WindowStarter; label: string; hint: string }[] = [
    { value: 'card', label: 'Info card', hint: 'A picture, a heading, a text and a Close button' },
    { value: 'dialog', label: 'Dialog', hint: 'A text and an OK button' },
    { value: 'list', label: 'List', hint: 'Rows of text and a Close button' },
    { value: 'blank', label: 'Blank', hint: 'An empty frame of the size you pick' },
    { value: 'copy', label: 'Copy of a window', hint: 'A window of the game, as the theme draws it, to change' },
];

/** The frame looks of Habbo's own windows a new one can take, by the frame's `style`. */
export const FRAME_STYLES = [ { value: '3', label: 'Habbo window' }, { value: '100', label: 'Light window' } ];

/** What a new window says, as staff fill the New window form. */
export interface WindowStart {
    title: string;
    starter: WindowStarter;
    width: number;
    height: number;
    frameStyle: string;
    heading: string;
    text: string;
    /** A picture's address, picked from the media library. */
    image: string;
    /** A me menu entry opening it, with the title as its caption. */
    meMenu: boolean;
}

/** A frame's content area starts below its header: `simple_alert`'s margins. */
const MARGINS: [ number, number, number, number ] = [ 1, 30, 1, 1 ];

const element = (tag: string, name: string, x: number, y: number, width: number, height: number, more: Partial<DataWindowElement> = {}): DataWindowElement => ({ tag, name, x, y, width, height, style: '100', vars: {}, children: [], ...more });

/** Habbo's thick button, as `simple_alert`'s close button. */
const button = (name: string, caption: string, width: number, contentWidth: number, y: number) => element('button_thick', name, Math.round((contentWidth - width) / 2), y, width, 28, { style: '3', caption, params: { events: [ 'input' ] } });

/** A frame as Habbo's own windows have it (`simple_alert`): its header, drop shadow and drag. */
const frame = (title: string, width: number, height: number, style: string, children: DataWindowElement[]): DataWindowElement => ({
    tag: 'frame',
    name: 'window',
    x: 0,
    y: 0,
    width,
    height,
    style,
    caption: title,
    vars: { margin_left: MARGINS[0], margin_top: MARGINS[1], margin_right: MARGINS[2], margin_bottom: MARGINS[3] },
    params: { events: [ 'input', 'dragTarget' ] },
    dropShadow: { distance: 4, angle: 45, color: 0, alpha: 0.35, blur: 4 },
    margins: MARGINS,
    children,
});

/** A window's file name from its title: `Welcome to the hotel` is `welcome-to-the-hotel`, another after a taken one `-2`. */
export const windowNameOf = (title: string, taken: readonly string[]) => {
    const base = title.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'window';
    let name = base;

    for (let at = 2; taken.includes(name); at++) name = `${base}-${at}`;

    return name;
};

/** A new window's file, from what staff filled in; `copy` is the template of the window copied. */
export const newWindowFile = (start: WindowStart, copy?: DataWindowTemplate): DataWindowFile => {
    const title = start.title.trim() || 'New window';
    const entries = start.meMenu ? [ { where: 'memenu' as const, caption: title } ] : [];

    if (start.starter === 'copy' && copy) return { title, template: { ...copy, name: windowNameOf(title, []) }, buttons: {}, entries };

    const width = start.starter === 'blank' ? start.width : 310;
    const inner = width - MARGINS[0] - MARGINS[2];
    let height = start.height;
    let children: DataWindowElement[] = [];
    let buttons: DataWindowFile['buttons'] = {};

    if (start.starter === 'card') {
        height = 190;
        children = [
            element('static_bitmap', 'image', 10, 10, 90, 90, { vars: { asset_uri: start.image, stretched_x: false, stretched_y: false } }),
            element('label', 'heading', 110, 10, inner - 120, 19, { caption: start.heading, vars: { text_style: 'il_heading_1', text_color: 12779520 } }),
            element('text', 'message', 110, 34, inner - 120, 66, { caption: start.text, vars: { multiline: true, word_wrap: true } }),
            button('close_button', 'Close', 126, inner, 118),
        ];
        buttons = { close_button: { close: true } };
    } else if (start.starter === 'dialog') {
        height = 160;
        children = [
            element('text', 'message', 10, 10, inner - 20, 70, { caption: start.text, vars: { multiline: true, word_wrap: true } }),
            button('ok_button', 'OK', 100, inner, 90),
        ];
        buttons = { ok_button: { close: true } };
    } else if (start.starter === 'list') {
        height = 200;
        children = [
            element('label', 'heading', 10, 10, inner - 20, 19, { caption: start.heading, vars: { text_style: 'il_heading_1', text_color: 12779520 } }),
            ...[ 0, 1, 2 ].map(row => element('text', `row_${row + 1}`, 10, 36 + (row * 22), inner - 20, 19, { caption: `Row ${row + 1}` })),
            button('close_button', 'Close', 126, inner, 128),
        ];
        buttons = { close_button: { close: true } };
    }

    return {
        title,
        template: { name: windowNameOf(title, []), width, height, elements: [ frame(title, width, height, start.frameStyle, children) ] },
        buttons,
        entries,
    };
};

/** The key a patch names an element by: its name when no other element has it, else its parent's key and its index (`@1`). */
const keyed = (elements: readonly DataWindowElement[], names: Map<string, number>, parent: string | null): WindowElement[] => elements.map((each, index) => {
    const own = each.name && names.get(each.name) === 1 ? each.name : null;
    const key = parent === null ? '' : (own ?? (parent ? `${parent}/@${index}` : `@${index}`));

    return {
        key,
        tag: each.tag,
        ...(each.name ? { name: each.name } : {}),
        ...(each.style ? { style: each.style } : {}),
        rect: [ each.x, each.y, each.width, each.height ],
        ...(typeof each.caption === 'string' ? { caption: each.caption } : {}),
        children: keyed(each.children ?? [], names, key),
    };
});

const countNames = (elements: readonly DataWindowElement[], names = new Map<string, number>()) => {
    for (const each of elements) {
        if (each.name) names.set(each.name, (names.get(each.name) ?? 0) + 1);

        countNames(each.children ?? [], names);
    }

    return names;
};

/** A window's template as the client's template index has it: every element by the key a patch names it by. */
export const indexTemplateOf = (template: DataWindowTemplate) => ({ name: template.name, width: template.width, height: template.height, elements: keyed(template.elements, countNames(template.elements), null) });

/**
 * The template index with the theme's own windows in it - the saved ones, the draft's over them
 * (null: deleted) - listed first under `OWN_WINDOWS_AREA`, so the studio shows, picks and edits them
 * as it does the game's.
 */
export const withOwnWindows = (index: TemplateIndex, theme: string, saved: readonly PluginWindow[] | undefined, draft: Readonly<Record<string, DataWindowFile | null>>): TemplateIndex => {
    const files = new Map<string, DataWindowFile>();

    for (const window of saved ?? []) {
        if (window.file) files.set(window.name, window.file);
    }

    for (const [ name, file ] of Object.entries(draft)) {
        if (file) files.set(name, file);
        else files.delete(name);
    }

    if (!files.size) return index;

    const templates = { ...index.templates };
    const own: NonNullable<TemplateIndex['windows']> = {};

    for (const [ name, file ] of files) {
        const id = dataWindowTemplateId(theme, name);

        templates[id] = indexTemplateOf(file.template);
        own[id] = { name: file.title || name, area: OWN_WINDOWS_AREA };
    }

    return { ...index, templates, windows: { ...own, ...index.windows } };
};

/** The theme's windows as the client is given them, the draft's over the saved ones: what the preview draws. */
export const ownWindowFiles = (theme: string, saved: readonly PluginWindow[] | undefined, draft: Readonly<Record<string, DataWindowFile | null>>) => {
    const files: Record<string, DataWindowFile> = {};

    for (const window of saved ?? []) {
        if (window.file) files[`${theme}/${window.name}`] = window.file;
    }

    for (const [ name, file ] of Object.entries(draft)) {
        if (file) files[`${theme}/${name}`] = file;
        else delete files[`${theme}/${name}`];
    }

    return files;
};

/** The elements of a window a player clicks: buttons and links, by name. */
export const clickableElements = (template: DataWindowTemplate) => {
    const found: DataWindowElement[] = [];
    const walk = (elements: readonly DataWindowElement[]) => elements.forEach((each) => {
        if (each.name && /button|link/.test(each.tag) && each.tag !== 'frame') found.push(each);

        walk(each.children ?? []);
    });

    walk(template.elements);

    return found;
};

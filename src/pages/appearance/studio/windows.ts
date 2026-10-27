import type { StudioWindowEntry, TemplateIndex, WindowElement, WindowTemplate } from '#/api/windows';

import { OWN_WINDOWS_AREA } from './dataWindows';

/** The areas of the game the studio lists windows by, as players know them, in this order: the theme's own windows first. */
export const AREAS = [ OWN_WINDOWS_AREA, 'Catalogue', 'Navigator', 'Inventory', 'Toolbar & purse', 'Room', 'Chat', 'Friends & messenger', 'Groups', 'Wired', 'Help & moderation', 'Games', 'Hotel view', 'Loading screen', 'Other' ];

/** The area of a window by its library, for a client whose index has no window map yet. */
const LIBRARY_AREAS: Record<string, string> = {
    'habbo-catalog-com': 'Catalogue',
    'habbo-navigator-com': 'Navigator',
    'habbo-new-navigator': 'Navigator',
    'habbo-inventory-com': 'Inventory',
    'habbo-toolbar-com': 'Toolbar & purse',
    'habbo-notifications-com': 'Toolbar & purse',
    'habbo-room-ui-com': 'Room',
    'habbo-avatar-editor-com': 'Room',
    'habbo-quest-engine-com': 'Room',
    'habbo-friend-list-com': 'Friends & messenger',
    'habbo-friend-bar-com': 'Friends & messenger',
    'habbo-messenger-com': 'Friends & messenger',
    'habbo-groups-com': 'Groups',
    'habbo-user-defined-room-events-com': 'Wired',
    'habbo-help-com': 'Help & moderation',
    'habbo-moderation-com': 'Help & moderation',
    'habbo-games-com': 'Games',
};

/** Templates drawn on the game's desktop with no frame of their own, which are windows all the same (the purse, the toolbar). */
const UNFRAMED_WINDOWS: Record<string, string> = {
    'habbo-toolbar-com/purse_xml': 'Purse',
    'habbo-toolbar-com/toolbar_view_xml': 'Toolbar',
};

/** A window of the studio's list: what players call it, its area, the parts drawn inside it and the states it is shown in. */
export interface StudioWindow {
    id: string;
    name: string;
    area: string;
    parts: string[];
    states: { id: string; name: string }[];
    /** Its layout, for its outline and its elements; none for a window Nitro draws itself. */
    template: WindowTemplate | undefined;
}

/** `catalog_ubuntu_with_tabs` as words: `Catalog ubuntu with tabs`. */
const wordsOf = (id: string) => {
    const asset = (id.split('/').pop() ?? id).replace(/_xml$/, '').replace(/[_-]+/g, ' ').trim();

    return asset.charAt(0).toUpperCase() + asset.slice(1);
};

/**
 * The windows players see, from the client's window map (`windows` in its template index: names,
 * areas, parts and states found in its code) - or, for a client built before it, the templates
 * drawn in a frame and the frames Nitro draws itself, named after their file. Parts (list rows,
 * grid items, page layouts) are never entries: they are reached inside their window.
 */
export const studioWindows = (index: TemplateIndex): StudioWindow[] => {
    if (index.windows && Object.keys(index.windows).length) {
        const entries = Object.entries(index.windows);
        // Two windows players call the same (the catalogue and the Builders Club's) are told apart by their file.
        const named = Map.groupBy(entries, ([ , entry ]) => `${entry.area}|${entry.name}`);

        return entries.map(([ id, entry ]: [ string, StudioWindowEntry ]) => ({
            id,
            name: !entry.name ? wordsOf(id) : (named.get(`${entry.area}|${entry.name}`)!.length > 1 ? `${entry.name} (${wordsOf(id).toLowerCase()})` : entry.name),
            area: AREAS.includes(entry.area) ? entry.area : 'Other',
            parts: entry.parts ?? [],
            states: entry.states ?? [],
            template: index.templates[id],
        }));
    }

    const framed = Object.entries(index.templates)
        .filter(([ id, template ]) => (template.elements[0]?.tag === 'frame') || (id in UNFRAMED_WINDOWS))
        .map(([ id, template ]) => ({ id, name: UNFRAMED_WINDOWS[id] ?? wordsOf(id), area: LIBRARY_AREAS[id.split('/')[0]!] ?? 'Other', parts: [], states: [], template }));
    const drawn = Object.keys(index.frames).map(id => ({ id, name: wordsOf(id), area: id.startsWith('wired') ? 'Wired' : 'Room', parts: [], states: [], template: undefined }));

    return [ ...framed, ...drawn ];
};

/** Every element of a tree, depth first. */
export const flatElements = (elements: readonly WindowElement[]): WindowElement[] => elements.flatMap(element => [ element, ...flatElements(element.children ?? []) ]);

/** The windows a part is drawn inside, from the window map. */
export const windowsOfPart = (windows: readonly StudioWindow[], part: string) => windows.filter(window => window.parts.includes(part));

/**
 * Whether a window has the words: in what players call it, its file, an element's key, name,
 * caption or text key, or in one of the parts drawn inside it - or shows a text the words found.
 */
export const windowMatches = (index: TemplateIndex, window: StudioWindow, words: string, shown: ReadonlySet<string>) => {
    if (!words) return true;

    if (window.name.toLowerCase().includes(words) || window.id.toLowerCase().includes(words)) return true;

    const elements = [ window.template, ...window.parts.map(part => index.templates[part]) ].flatMap(template => flatElements(template?.elements ?? []));

    return elements.some(element => [ element.key, element.name, element.caption, ...(element.texts ?? []) ].some(value => value?.toLowerCase().includes(words))
        || element.texts?.some(text => shown.has(text)));
};

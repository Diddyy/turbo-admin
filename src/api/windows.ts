import { type QueryClient, useQuery } from '@tanstack/react-query';

import { openZip } from '#/lib/zip';
import { dataUrlOf } from '#/preview/images';

import { useClientAssets } from './assets';
import { api } from './client';

/**
 * One element of a window as the client's `template-index.json` has it (nitro-next
 * `tools/skin-map.mjs`): `key` is what a patch's `element` or a binding names it by (none for an
 * element no key reaches), `rect` its `[x, y, width, height]`, `texts` the text keys its caption
 * and variables show.
 */
export interface WindowElement {
    key?: string;
    tag: string;
    name?: string;
    style?: string;
    /** Its tags (`#icon`), which a `#TAG` key part finds it by. */
    tags?: string[];
    rect: [ number, number, number, number ];
    caption?: string;
    texts?: string[];
    hidden?: boolean;
    children?: WindowElement[];
}

/** A template window: its first element is the window itself (key `''`). */
export interface WindowTemplate {
    name: string;
    width: number;
    height: number;
    elements: WindowElement[];
}

/** A window players open, as the client's window map has it: what they call it, its area, the part templates drawn inside it and its states. */
export interface StudioWindowEntry {
    name: string;
    area: string;
    parts?: string[];
    states?: { id: string; name: string }[];
}

/**
 * `template-index.json`: every template by id (`<library>/<asset>`), the frames Nitro draws itself
 * by frame id with their styles, and the window map: which ids are windows players open, and which
 * windows each part template is drawn inside.
 */
export interface TemplateIndex {
    version: 1;
    templates: Record<string, WindowTemplate>;
    frames: Record<string, string[]>;
    windows?: Record<string, StudioWindowEntry>;
    /** Each part template: what staff call it (the map's name for it, from the client's code) and the windows drawing it. */
    parts?: Record<string, { name?: string; windows: string[] }>;
}

/** One sprite of the theme sheet a skin draws (nitro-theme `SkinSprite`). */
export interface SkinSprite {
    part: string;
    sprite: string;
    /** The `asset.overlays` key that replaces it. */
    overlay: string;
    width?: number;
    height?: number;
    slice?: { left: number; top: number; right: number; bottom: number };
    rect?: { x: number; y: number; width: number; height: number };
}

/** A skin (`frame:3`): its sprites and the windows drawing it, by window id to element keys. */
export interface SkinEntry {
    component: string;
    style: string;
    tintColor?: string;
    sprites: SkinSprite[];
    windows: Record<string, string[]>;
}

/** `skins.json`: every skin with art, and every sprite with the skins it is in. */
export interface SkinMap {
    version: 1;
    skins: Record<string, SkinEntry>;
    sprites: Record<string, { width?: number; height?: number; skins: string[] }>;
}

// The client's build writes them: they change only with a new client, and the server keeps them too.
const FOREVER = { staleTime: Infinity, gcTime: Infinity, retry: false } as const;

export const useTemplateIndex = () => useQuery({ queryKey: [ 'client', 'windows', 'index' ], queryFn: () => api<TemplateIndex>('/client/windows/index'), ...FOREVER });

export const useSkinMap = () => useQuery({ queryKey: [ 'client', 'windows', 'skins' ], queryFn: () => api<SkinMap>('/client/windows/skins'), ...FOREVER });

/** Both files read again past the server's kept copy, after a new client is deployed. */
export const readWindowsAgain = async (queryClient: QueryClient) => {
    const [ index, skins ] = await Promise.all([ api<TemplateIndex>('/client/windows/index?fresh=true'), api<SkinMap>('/client/windows/skins?fresh=true') ]);

    queryClient.setQueryData([ 'client', 'windows', 'index' ], index);
    queryClient.setQueryData([ 'client', 'windows', 'skins' ], skins);
};

/** The library holding the theme sheet the skins' sprites are cut from. */
const THEME_LIBRARY = 'habbo-window-manager-com';

/** The theme sheet (`theme.png`) as an image url, and each sprite's place on it (`theme_spritesheet.json`). */
export interface ThemeSheet {
    url: string;
    frames: Record<string, { x: number; y: number; w: number; h: number }>;
}

/**
 * The theme sheet, read from the window manager's bundle where the client loads it
 * (`asset.bundles.templates`), so the skins are drawn as players see them. Null-ish while the
 * bundle's address isn't known; an error when it can't be read.
 */
export const useThemeSheet = () => {
    const template = useClientAssets()?.templates ?? '';

    return useQuery({
        queryKey: [ 'client', 'windows', 'sheet', template ],
        queryFn: async (): Promise<ThemeSheet> => {
            const response = await fetch(template.replaceAll('%libname%', THEME_LIBRARY));

            if (!response.ok) throw new Error(`The client's ${THEME_LIBRARY} bundle answered ${response.status}.`);

            const zip = openZip(await response.arrayBuffer());
            const [ png, sheet ] = await Promise.all([ zip.read('theme.png'), zip.read('theme_spritesheet.json') ]);

            if (!png || !sheet) throw new Error(`The client's ${THEME_LIBRARY} bundle has no theme sheet.`);

            const frames = (JSON.parse(new TextDecoder().decode(sheet)) as { frames: Record<string, { frame: { x: number; y: number; w: number; h: number } }> }).frames;

            return {
                url: await dataUrlOf(new Blob([ png as BlobPart ], { type: 'image/png' })),
                frames: Object.fromEntries(Object.entries(frames).map(([ name, { frame } ]) => [ name, frame ])),
            };
        },
        enabled: !!template,
        ...FOREVER,
        refetchOnWindowFocus: false,
    });
};

/**
 * A window by id: a template's, or one Nitro draws itself (`frames`), which a patch reaches only at
 * its root `''` - its frame's colour, style and position.
 */
export const windowOf = (index: TemplateIndex, id: string): WindowTemplate | undefined => index.templates[id]
    ?? (index.frames[id] ? { name: id, width: 0, height: 0, elements: [ { key: '', tag: 'frame', style: index.frames[id].join(' | '), rect: [ 0, 0, 0, 0 ] } ] } : undefined);

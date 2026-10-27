import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { postForm } from './bundles';
import { api, apiBlob, post, put, remove } from './client';
import type { VariableSearchResult } from './gamedata';

/** What a theme style holds; staff type each as `theme.json` says (turbo-cloud `docs/plugin-data.md`). */
export type PluginStyleType = 'color' | 'number' | 'image' | 'font' | 'text' | 'position';

/**
 * One style property of a theme (its own, or one of the theme it extends: the hotel's own plugin
 * extends the base theme `habbo`) and the hotel's value of it: `value` is `default` while `changed`
 * is false; a null `default` is the client's own, so nothing is sent until staff set it.
 */
export interface PluginStyle {
    name: string;
    type: PluginStyleType;
    group: string | null;
    label: string | null;
    hint: string | null;
    /** The library bitmap an image stands in for (`asset.overlays`). */
    overlay: string | null;
    /** The merged variable and the path in it the value also goes to (`[ 'frame.overrides', 'catalog', 'color' ]`); empty for none. */
    variable: string[];
    min: number | null;
    max: number | null;
    default: string | null;
    value: string | null;
    changed: boolean;
    /** The theme whose default it has: the base theme `habbo`'s, or one that names it again. */
    origin: string | null;
}

/** An image in a plugin's `wwwroot/styles/`: `path` as a patch's `asset` or an image style names it, `url` as a variable does. */
export interface PluginImage {
    path: string;
    url: string | null;
    bytes: number;
    modified: string;
}

export interface PluginImagesResponse {
    key: string;
    images: PluginImage[];
    canManage: boolean;
}

export interface PluginStylesResponse {
    key: string;
    /** The theme it extends; null for one that extends none. */
    extends: string | null;
    styles: PluginStyle[];
    canManage: boolean;
}

/** A window patch staff made: its ops are nitro-next's `TemplatePatchOp`s, as JSON. */
export interface HotelPatch {
    id: string;
    name: string;
    template: string;
    order: number | null;
    ops: unknown;
    disabled: boolean;
}

export interface HotelPatchesResponse {
    /** The key of the data plugin that holds them: the hotel's own, or the theme staff work on. */
    key: string;
    patches: HotelPatch[];
    canManage: boolean;
}

const stylesKey = (key: string) => [ 'plugins', key, 'styles' ];

const patchesKey = (key: string) => [ 'plugins', key, 'patches' ];

export const usePluginStyles = (key: string) => useQuery({
    queryKey: stylesKey(key),
    queryFn: () => api<PluginStylesResponse>(`/plugins/${encodeURIComponent(key)}/styles`),
});

/**
 * A style's change, its reset or an image upload; the theme's styles are read again after. With
 * `intoTheme` the change lands in the theme's own files (its `theme.json` default: staff work on the
 * theme), else it is this hotel's value of it.
 */
export const useStyleChange = (key: string, intoTheme = false) => {
    const queryClient = useQueryClient();
    const base = `/plugins/${encodeURIComponent(key)}/styles`;
    const target = intoTheme && key !== 'hotel' ? `?${new URLSearchParams({ target: key })}` : '';

    return useMutation({
        mutationFn: ({ name, value, file }: { name: string; value?: string | null; file?: File }) => {
            const path = `${base}/${encodeURIComponent(name)}`;

            if (file) {
                const form = new FormData();

                form.append('file', file);

                return postForm<PluginStyle>(`${path}/image${target}`, form);
            }

            return value === null || value === undefined ? remove<PluginStyle>(`${path}${target}`) : put<PluginStyle>(`${path}${target}`, { value });
        },
        onSettled: () => void queryClient.invalidateQueries({ queryKey: stylesKey(key) }),
    });
};

const imagesKey = (key: string) => [ 'plugins', key, 'images' ];

export const usePluginImages = (key: string) => useQuery({
    queryKey: imagesKey(key),
    queryFn: () => api<PluginImagesResponse>(`/plugins/${encodeURIComponent(key)}/images`),
});

/** Uploads an image into a plugin's `wwwroot/styles/`, under `name` or its own file name. */
export const uploadPluginImage = (key: string, file: File, name?: string) => {
    const form = new FormData();

    form.append('file', file);

    if (name) form.append('name', name);

    return postForm<PluginImage>(`/plugins/${encodeURIComponent(key)}/images`, form);
};

/** Uploads an image into the plugin's `wwwroot/styles/` (one by that name is replaced), or takes one away. */
export const useImageChange = (key: string) => {
    const queryClient = useQueryClient();
    const base = `/plugins/${encodeURIComponent(key)}/images`;

    return useMutation({
        mutationFn: ({ file, path }: { file?: File; path?: string }) => path ? remove<undefined>(`${base}?path=${encodeURIComponent(path)}`) : uploadPluginImage(key, file!),
        onSettled: () => void queryClient.invalidateQueries({ queryKey: imagesKey(key) }),
    });
};

const OVERLAYS = 'asset.overlays';

const OVERLAYS_KEY = [ 'gamedata', 'variables', OVERLAYS ];

/** The hotel's own `asset.overlays` entries, as Gamedata > Variables keeps them; refused when it holds something else than a JSON object. */
const readOverlays = async (): Promise<Record<string, string>> => {
    const found = await api<VariableSearchResult>(`/gamedata/variables?${new URLSearchParams({ q: OVERLAYS, page: '0' })}`);
    const value = found.items.find(item => item.key === OVERLAYS)?.value;

    if (!value) return {};

    const parsed: unknown = JSON.parse(value);

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error(`${OVERLAYS} is not a JSON object: fix it under Gamedata > Variables first.`);

    return parsed as Record<string, string>;
};

/** The hotel's own replacement of each library bitmap (`asset.overlays`: a url per overlay key); a plugin's own are added to them in the client's file. */
export const useHotelOverlays = () => useQuery({ queryKey: OVERLAYS_KEY, queryFn: readOverlays });

/**
 * Replaces one library bitmap (`url`), or gives it back (null), for the hotel or in the theme `key`
 * staff work on (its own files), keeping its other entries.
 */
export const useOverlayChange = (key: string) => {
    const change = useOverlaysChange(key);

    return useMutation({
        mutationFn: ({ overlay, url }: { overlay: string; url: string | null }) => change.mutateAsync({ [overlay]: url }),
    });
};

/** The patches staff made in `key`: the hotel's own data plugin, or the theme they work on. */
export const usePatches = (key: string) => useQuery({
    queryKey: patchesKey(key),
    queryFn: () => api<HotelPatchesResponse>(`/plugins/${encodeURIComponent(key)}/patches`),
});

export const useSavePatch = (key: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (patch: HotelPatch) => post<HotelPatch>(`/plugins/${encodeURIComponent(key)}/patches`, patch),
        onSettled: () => void queryClient.invalidateQueries({ queryKey: [ 'plugins' ] }),
    });
};

export const useRemovePatch = (key: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => remove<void>(`/plugins/${encodeURIComponent(key)}/patches/${encodeURIComponent(id)}`),
        onSettled: () => void queryClient.invalidateQueries({ queryKey: [ 'plugins' ] }),
    });
};

/** A theme staff make: one that extends `extends` (Habbo's own by default), or a copy of `copyOf`. */
export interface ThemeCreateRequest {
    key: string;
    name: string;
    extends: string | null;
    copyOf: string | null;
    author: string | null;
}

/** Makes a theme (a data plugin of its own in the plugin folder) and loads it; the theme list is read again. */
export const useCreateTheme = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (request: ThemeCreateRequest) => post<{ key: string; extends: string | null }>('/plugins/themes', request),
        onSettled: () => void queryClient.invalidateQueries({ queryKey: [ 'plugins' ] }),
    });
};

/** What the new plugin is called: another hotel installs the zip as it installs any package. */
export interface PluginPackageRequest {
    key: string;
    name: string;
    version: string;
    author: string | null;
}

/** Makes a data plugin of `key` as this hotel has it, and hands the zip to the browser. */
export const downloadPluginPackage = async (key: string, request: PluginPackageRequest) => {
    const url = URL.createObjectURL(await apiBlob(`/plugins/${encodeURIComponent(key)}/package`, request));
    const link = document.createElement('a');

    link.href = url;
    link.download = `${request.key}-${request.version}.zip`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/**
 * A skin set: many library bitmaps replaced (a url each) or given back (null) in one change, for the
 * hotel or in the theme `key` staff work on (its own files), each checked before any is written; a
 * bitmap the base theme declares as an image style goes through that style. Answers its
 * `asset.overlays` entries after.
 */
export const useOverlaysChange = (key: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (overlays: Record<string, string | null>) => put<{ overlays: Record<string, string> }>(`/plugins/${encodeURIComponent(key)}/overlays`, { overlays }),
        onSettled: () => Promise.all([
            queryClient.invalidateQueries({ queryKey: [ 'gamedata', 'variables' ] }),
            queryClient.invalidateQueries({ queryKey: stylesKey(key) }),
        ]),
    });
};

/** A font file in a plugin's `wwwroot/styles/`: `family` is what a font style or a text style names it by. */
export interface PluginFont {
    path: string;
    url: string | null;
    family: string;
    bytes: number;
    modified: string;
}

export interface PluginFontsResponse {
    key: string;
    fonts: PluginFont[];
    canManage: boolean;
}

/** The font files a font can be: WOFF2, WOFF, TrueType, OpenType. */
export const FONT_TYPES = '.woff2,.woff,.ttf,.otf,font/woff2,font/woff,font/ttf,font/otf';

const fontsKey = (key: string) => [ 'plugins', key, 'fonts' ];

export const usePluginFonts = (key: string) => useQuery({
    queryKey: fontsKey(key),
    queryFn: () => api<PluginFontsResponse>(`/plugins/${encodeURIComponent(key)}/fonts`),
});

/** Uploads a font into the plugin's `wwwroot/styles/` (clients load it as its file's name), or takes one away with its family. */
export const useFontChange = (key: string) => {
    const queryClient = useQueryClient();
    const base = `/plugins/${encodeURIComponent(key)}/fonts`;

    return useMutation({
        mutationFn: ({ file, path }: { file?: File; path?: string }) => {
            if (path) return remove<undefined>(`${base}?path=${encodeURIComponent(path)}`);

            const form = new FormData();

            form.append('file', file!);

            return postForm<PluginFont>(base, form);
        },
        onSettled: () => Promise.all([
            queryClient.invalidateQueries({ queryKey: fontsKey(key) }),
            queryClient.invalidateQueries({ queryKey: [ 'gamedata', 'variables' ] }),
        ]),
    });
};

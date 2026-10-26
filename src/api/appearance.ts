import { useQuery } from '@tanstack/react-query';

import { api } from './client';

/**
 * A plugin that is a theme (the hotel's own always: it extends the base theme): the theme it
 * extends, its style properties, those the hotel changed and those it declares itself; `error`
 * is why its `theme.json` can't be read.
 */
export interface PluginTheme {
    key: string;
    name: string | null;
    state: string;
    extends: string | null;
    styles: number;
    changed: number;
    own: number;
    error: string | null;
}

export interface PluginThemesResponse {
    /** The base theme Turbo ships, Habbo's own look: the root of the tree. */
    base: string;
    themes: PluginTheme[];
    canManage: boolean;
}

/** One entry of a plugin's `wwwroot/template-patches.json`, as its clients are given it. */
export interface PluginTemplatePatch {
    template: string;
    ops: unknown;
    order: number | null;
}

export const useThemes = () => useQuery({
    queryKey: [ 'plugins', 'themes' ],
    queryFn: () => api<PluginThemesResponse>('/plugins/themes'),
});

export const usePluginTemplatePatches = (key: string) => useQuery({
    queryKey: [ 'plugins', key, 'template-patches' ],
    queryFn: () => api<{ key: string; patches: PluginTemplatePatch[] }>(`/plugins/${encodeURIComponent(key)}/template-patches`),
});

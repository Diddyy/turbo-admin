import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, put } from './client';

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

/** Who a theme reaches (`docs/plugin-data.md`, "Who gets which theme"). */
export type ThemeStatus = 'live' | 'development' | 'off';

export interface ThemeAudience {
    key: string;
    extends: string | null;
    status: ThemeStatus;
    /** The hotel's one default: every player without a theme of their own draws it. */
    isDefault: boolean;
    /** Players may choose it in the client's settings. */
    selectable: boolean;
    /** While in development: the players and permission groups that get it. */
    players: { id: number; name: string | null }[];
    groups: string[];
}

export interface ThemeAudiencesResponse {
    themes: ThemeAudience[];
    /** Every permission group, for the audience editor. */
    groups: string[];
    canManage: boolean;
}

/** A change to who gets a theme; a field left out stays. Players by name or id. */
export interface ThemeAudienceChange {
    status?: ThemeStatus;
    isDefault?: boolean;
    selectable?: boolean;
    players?: string[];
    groups?: string[];
}

/** What the last appearance change did (`GET /plugins/themes/live`): the players live reload sent it to, of those online; `at` null for none lately. */
export interface ThemeLive {
    players: number;
    online: number;
    at: string | null;
}

/** Asked straight after a save: the server sends the save first, then says who it reached. */
export const fetchThemeLive = () => api<ThemeLive>('/plugins/themes/live');

export const useThemeAudiences = () => useQuery({
    queryKey: [ 'plugins', 'themes', 'audience' ],
    queryFn: () => api<ThemeAudiencesResponse>('/plugins/themes/audience'),
});

export const useSetThemeAudience = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ key, change }: { key: string; change: ThemeAudienceChange }) => put<{ key: string }>(`/plugins/themes/${encodeURIComponent(key)}/audience`, change),
        onSettled: () => void queryClient.invalidateQueries({ queryKey: [ 'plugins', 'themes' ] }),
    });
};

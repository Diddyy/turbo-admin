import type { PluginTheme } from '#/api/appearance';

/** A theme in the tree: how deep it is under the base theme. */
export interface ThemeNode {
    theme: PluginTheme;
    depth: number;
}

/**
 * The themes as a tree under the base theme (`habbo`, Habbo's own look): each under the theme it
 * extends, depth first, in key order; one extending none, or a theme not installed, at the top.
 */
export const themeTree = (themes: readonly PluginTheme[], base: string): ThemeNode[] => {
    const keys = new Set(themes.map(theme => theme.key));
    const under = (parent: string | null, depth: number, seen: Set<string>): ThemeNode[] => themes
        .filter(theme => (parent === null ? !theme.extends || (theme.extends !== base && !keys.has(theme.extends)) : theme.extends === parent) && !seen.has(theme.key))
        .flatMap(theme => [ { theme, depth }, ...under(theme.key, depth + 1, new Set([ ...seen, theme.key ])) ]);

    return [ ...under(base, 1, new Set()), ...under(null, 0, new Set()) ];
};

/** The theme's name as staff know it: the hotel's own plugin is "This hotel". */
export const themeName = (theme: Pick<PluginTheme, 'key' | 'name'>) => (theme.key === 'hotel' ? 'This hotel' : theme.name ?? theme.key);

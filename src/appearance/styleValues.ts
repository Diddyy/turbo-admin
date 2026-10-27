import type { PluginFont, PluginStyle } from '#/api/noCode';
import type { TemplateIndex } from '#/api/windows';
import type { DesignDraft } from '#/preview/DesignPreview';
import { designTemplateOfFrame } from '#/preview/designSamples';

/** `#rrggbb` (or `#aarrggbb`) as the browser's colour picker takes it: its last six digits. */
export const pickerValue = (value: string) => /^#[0-9a-f]{6,8}$/i.test(value) ? `#${value.slice(-6)}` : '#000000';

/** The faces the client ships, which a font style names as they are (nitro-next `docs/text.md`). */
export const SHIPPED_FONTS = [ 'Ubuntu', 'UbuntuCondensed', 'Volter', 'Volter Bold' ];

/** What a style with no value shows: the base theme's are the client's own, Habbo's look. */
export const CLIENTS_OWN = 'Habbo\'s own';

/** What each area of the base theme's styles restyles, said under its heading. */
export const GROUP_HINTS: Record<string, string> = {
    Windows: 'The frame, title bar and colour most windows are drawn with: catalogue, inventory, navigator.',
    Purse: 'The purse at the top right: its border art.',
    Catalogue: 'The catalogue window: its colour and where it first opens.',
    Navigator: 'The navigator window: its colour and where it first opens.',
    Fonts: 'The typefaces windows and chat are written in.',
    'Loading screen': 'What players see while the hotel loads: the picture, the bar and the words.',
};

/** Whose default a style goes back to: Habbo's own (the base theme's, or the client's) or that of the theme that set one. */
export const resetTo = (style: PluginStyle) => (style.origin === 'habbo' || style.origin === null ? CLIENTS_OWN : `${style.origin}'s default`);

/** A typed value as the client reads it (turbo-cloud `ThemeStyles.ClientValue`): in `templates.styles`, and in the variable it also goes to. Undefined while it is no value yet. */
export const clientValues = (style: PluginStyle, value: string): { style: unknown; variable: unknown } | undefined => {
    const text = value.trim();

    if (style.type === 'color') {
        const hex = /^#?([0-9a-f]{6}|[0-9a-f]{8})$/i.exec(text)?.[1];

        if (!hex) return undefined;

        const argb = (hex.length === 6) ? (0xFF000000 + Number.parseInt(hex, 16)) : Number.parseInt(hex, 16);

        return { style: argb, variable: `#${hex.slice(-6).toLowerCase()}` };
    }

    if (style.type === 'number') return (text !== '' && Number.isFinite(Number(text))) ? { style: Number(text), variable: Number(text) } : undefined;

    if (style.type === 'position') {
        const match = /^(-?\d+)\s*,\s*(-?\d+)$/.exec(text);
        const position = match && { x: Number(match[1]), y: Number(match[2]) };

        return position ? { style: position, variable: position } : undefined;
    }

    return ((style.type === 'font') || (style.type === 'text')) && text ? { style: text, variable: text } : undefined;
};

/**
 * The unsaved values as a preview's draft: each in `templates.styles` and in the variable it goes to; a
 * font that was uploaded also its `text.fonts` entry, so the preview loads its file.
 */
export const styleDraft = (pluginKey: string, styles: readonly PluginStyle[], values: Readonly<Record<string, string>>, fonts: readonly PluginFont[]): DesignDraft => {
    const draft: Required<Pick<DesignDraft, 'styles' | 'variables'>> = { styles: {}, variables: [] };

    for (const style of styles) {
        const value = values[style.name];
        const client = (value === undefined) ? undefined : clientValues(style, value);

        if (!client) continue;

        draft.styles[`${pluginKey}:${style.name}`] = client.style;

        if (style.variable.length > 1) draft.variables.push({ path: style.variable, value: client.variable });

        const font = (style.type === 'font') ? fonts.find(each => each.family === value?.trim()) : undefined;

        if (font?.url) draft.variables.push({ path: [ 'text.fonts', font.family ], value: font.url });
    }

    return draft;
};

/** The window a style changes, for its preview: the one its `frame.overrides` entry names (a frame Nitro draws, or a template's by its code's frame id). */
export const windowOfStyle = (index: TemplateIndex | undefined, style: PluginStyle | undefined) => {
    const name = (style?.variable[0] === 'frame.overrides') ? style.variable[1] : undefined;

    if (!index || !name) return undefined;

    return index.frames[name] ? name : designTemplateOfFrame(name);
};

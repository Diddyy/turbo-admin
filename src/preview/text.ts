/**
 * Text drawn the way the client draws it: the Flash text renderer (`#/vendor/flash-text`, the port
 * of Sulake's bit-exact re-implementation of Adobe AIR's rasterizer) with the client's own captured
 * fonts, served with the panel from `public/fonts`.
 *
 * `loadFlashFonts` registers them once a page: until they are in (or when one did not come), text is
 * drawn by the browser in the same layout, from the client's `.ttf` faces, which it also registers.
 * A preview reads `useFlashFonts` so it draws again once they are.
 */
import { useQuery } from '@tanstack/react-query';

import type { NativeFontBundle } from '#/vendor/flash-text/air32/types';
import { renderBrowserTextCanvas } from '#/vendor/flash-text/browserTextCanvas';
import { FLASH_FONT_FACES } from '#/vendor/flash-text/flashFontFaces';
import { renderFlashTextCanvas } from '#/vendor/flash-text/flashTextCanvas';
import { type FlashTextFormat, normalizeFlashTextFormat } from '#/vendor/flash-text/flashTextFormat';
import { parseFlashTextMarkup } from '#/vendor/flash-text/flashTextMarkup';
import { registerNativeFontBundle } from '#/vendor/flash-text/FlashTextRenderer';
import { HABBO_TEXT_STYLES } from '#/vendor/flash-text/habboTextStyles';

const FONTS = `${import.meta.env.BASE_URL}fonts/`;

/** The client's `.ttf` faces the browser's text falls back to, as nitro-theme's `flashFonts.ts` declares them. */
const BROWSER_FACES: { family: string; file: string; weight?: string; style?: string }[] = [
    { family: 'Ubuntu', file: 'Ubuntu-R.ttf', weight: '400', style: 'normal' },
    { family: 'Ubuntu', file: 'Ubuntu-B.ttf', weight: '700', style: 'normal' },
    { family: 'Ubuntu', file: 'Ubuntu-I.ttf', weight: '400', style: 'italic' },
    { family: 'Ubuntu', file: 'Ubuntu-BI.ttf', weight: '700', style: 'italic' },
    { family: 'UbuntuCondensed', file: 'Ubuntu-C.ttf' },
    { family: 'Volter', file: 'Volter.ttf', weight: '400' },
    { family: 'Volter', file: 'Volter-Bold.ttf', weight: '700' },
    { family: 'Volter Bold', file: 'Volter-Bold.ttf' },
];

let loading: Promise<boolean> | null = null;

/** Every face of the client's font table, once a page: true when all came. */
export const loadFlashFonts = () => loading ??= (async () => {
    const bundles = new Map<string, Promise<NativeFontBundle | null>>();
    const bundleOf = (file: string) => {
        if (!bundles.has(file))
            bundles.set(file, fetch(`${FONTS}${file}`).then(response => (response.ok ? response.json() as Promise<NativeFontBundle> : null)).catch(() => null));

        return bundles.get(file)!;
    };

    // Not waited on: the fallback only matters for text the exact renderer cannot draw.
    for (const face of BROWSER_FACES)
        void new FontFace(face.family, `url(${FONTS}${face.file})`, { weight: face.weight, style: face.style }).load().then(loaded => document.fonts.add(loaded)).catch(() => undefined);

    const faces = await Promise.all(FLASH_FONT_FACES.map(async face => ({ face, bundle: await bundleOf(face.bundle) })));

    for (const { face, bundle } of faces) {
        if (bundle)
            registerNativeFontBundle(face.family, face.weight, face.style, bundle);
    }

    return faces.every(({ bundle }) => bundle);
})();

/** Whether the client's fonts are in: false until they are (and when one did not come), so a preview draws again. */
export const useFlashFonts = () => useQuery({ queryKey: [ 'flash-fonts' ], queryFn: loadFlashFonts, staleTime: Infinity, gcTime: Infinity }).data ?? false;

/** `HabboFreeFlowChat.fixHtml`'s escape: the angle brackets only. */
export const escapeChatMarkup = (text: string) => text.replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** `PooledChatBubble.recreate`'s markup for a spoken line: the speaker's name in bold, then the words. */
export const chatLineMarkup = (name: string, words: string, anonymous: boolean) =>
    `${anonymous || !name ? '' : `<b>${escapeChatMarkup(name)}: </b>`}${escapeChatMarkup(words)}`;

export interface TextRender {
    canvas: HTMLCanvasElement;
    /** The laid-out text's extent (`TextField.textWidth` / `textHeight`), without the canvas's gutter. */
    textWidth: number;
    textHeight: number;
    /** `TextField.numLines`. */
    lineCount: number;
}

/**
 * Markup drawn in a format, as the client draws it: word-wrapped at `wrapWidth` when given. The
 * format is one of the client's text styles (`HABBO_TEXT_STYLES`) with anything over it.
 */
export const renderText = (markup: string, format: Partial<FlashTextFormat>, wrapWidth?: number): TextRender | null => {
    if (!markup.length)
        return null;

    const normal = normalizeFlashTextFormat(format);
    const runs = parseFlashTextMarkup(markup, normal);
    const options = wrapWidth === undefined ? {} : { wordWrap: true, wrapWidth: Math.max(1, Math.floor(wrapWidth)), breakWords: true };
    const rendered = renderFlashTextCanvas(runs, normal, options) ?? renderBrowserTextCanvas(runs, options);

    if (!rendered)
        return null;

    const lineCount = rendered.lineHeight > 0 ? Math.max(1, Math.round(rendered.textHeight / rendered.lineHeight)) : 1;

    return { canvas: rendered.canvas, textWidth: Math.ceil(rendered.textWidth), textHeight: Math.ceil(rendered.textHeight), lineCount };
};

/**
 * A chat bubble's words, as nitro-react's `renderChatBubbleText` rasterises them: the client's
 * `u_chat_speak` style with the bubble style's face, size and colour over it.
 */
export const renderChatText = (markup: string, fontFace: string, fontSize: number, color: number, wrapWidth: number) =>
    renderText(markup, { ...HABBO_TEXT_STYLES.u_chat_speak, fontFamily: fontFace, fontSize, color }, wrapWidth);

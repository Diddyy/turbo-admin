/**
 * A chat bubble drawn on a canvas as the client draws one in a room: nitro-react's
 * `computeChatBubbleLayout` and `ChatBubbleBody` (from Flash's `PooledChatBubble.recreate`), ported
 * from nitro-next at `1e0843c3` with Nitro Studio's canvas drawing (`nitro-studio/src/lib/chatBubble.ts`).
 *
 * - The words are the client's own text (`./text`): the speaker's name in bold, then what they say,
 *   in the style's face, size and colour, wrapped at the room's bubble width less the margins.
 * - The base is stretched through its nine-slice (`scale9`) to the words and their margins, never
 *   smaller than the base itself, and a tall one capped as a room caps it (not a system style).
 * - Drawn in the client's order: the base (with `chat_bubble_color` tinted in the speaker's chest
 *   colour, `tintBackground`), the emblem (its multi-line one once the words wrap), the pointer at
 *   its left margin, `base.height - pointerY` above the foot, the face - the style's icon, or the
 *   speaker's head - centred on `faceXY`, then the words.
 * - `paintGuides` draws the style's numbers over it, for editing them.
 */
import { chatLineMarkup, renderChatText, type TextRender } from './text';

export interface ChatStylePoint {
    x: number;
    y: number;
}

export interface ChatStyleRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

/** How a style is drawn, as `chat-style-definitions.json` has it (nitro-react's `ChatStyleRegPoints`). */
export interface ChatStyleRegPoints {
    scale9: ChatStyleRect;
    textFieldMargins: ChatStyleRect;
    overlapRect?: ChatStyleRect;
    pointerY?: number;
    /** How close to the bubble's left and right edges the pointer may go; the client's 28 and 15 without. */
    pointerXMargins?: number[];
    faceXY?: ChatStylePoint;
    colorXY?: ChatStylePoint;
    emblemXY?: ChatStylePoint;
    emblemMultilineXY?: ChatStylePoint;
    anonymous?: boolean;
    usePixelPerfectNineSlice?: boolean;
    textColorRGB?: number;
    fontFace?: string;
    fontSize?: number;
    linkColorRGB?: number;
    linkHoverColorRGB?: number;
    linkActiveColorRGB?: number;
}

/**
 * The wrap widths a room's bubble width setting picks between (`ChatBubbleWidth`), the height a
 * player's bubble is capped at the normal font size (`PooledChatBubble.MAX_HEIGHT`), and the chat
 * font size setting's scales and names.
 */
export const CHAT_BUBBLE_WIDTH_THIN = 240;
export const CHAT_BUBBLE_WIDTH_NORMAL = 350;
export const CHAT_BUBBLE_WIDTH_WIDE = 2000;
const CHAT_BUBBLE_MAX_TEXT_HEIGHT = 108;
export const CHAT_FONT_SIZE_SCALES = [ 1, 1.15, 1.3, 1.5, 1.75 ];
export const CHAT_FONT_SIZE_LABELS = [ 'S', 'M', 'L', 'XL', 'XXL' ];

/** `PooledChatBubble`'s pointer margins, for a style without its own. */
export const POINTER_MARGIN_LEFT = 28;
export const POINTER_MARGIN_RIGHT = 15;

/** `ChatStyle`'s defaults for a style that does not say. */
export const DEFAULT_FONT_FACE = 'Volter';
export const DEFAULT_FONT_SIZE = 9;

/** No head drawn: the client tints a coloured bubble white. */
export const NO_CHEST_COLOR = 0xffffff;

type Drawable = HTMLImageElement | HTMLCanvasElement | ImageBitmap;

interface Sized {
    width: number;
    height: number;
}

/** What a style draws with: its bitmaps (the base already tinted), and the face in place of a head or the speaker's. */
export interface BubbleImages {
    base: Drawable;
    pointer?: Drawable | null;
    emblem?: Drawable | null;
    emblemMultiline?: Drawable | null;
    /** The style's icon when it has one, else the speaker's head (`chatHeadOf`). */
    face?: Drawable | null;
}

/** How a style behaves, of what the layout reads. */
export interface BubbleFlags {
    system?: boolean;
    notification?: boolean;
}

/** How a room is set to show bubbles: the width they wrap at and the font size scale. */
export interface BubbleSettings {
    maxWidth?: number;
    fontSizeScale?: number;
}

export interface BubbleLayout {
    /** The nine-sliced background. */
    width: number;
    height: number;
    /** Everything drawn: the pointer, the emblem and the face may reach past the background. */
    bubbleWidth: number;
    bubbleHeight: number;
    text: TextRender | null;
    /** Text taller than the cap is clipped to this box, at the margins. */
    clip: { width: number; height: number } | null;
    pointerY: number | null;
    pointerX: number;
    face: { x: number; y: number; height: number; cropTop: number } | null;
    emblem: { image: Drawable; x: number; y: number } | null;
}

/** `chatBubbleMaxHeight`: the cap at a font size scale. */
const maxHeightAt = (scale: number) => Math.trunc(CHAT_BUBBLE_MAX_TEXT_HEIGHT * scale);

/** `ChatStyle.nineSliceBorders`: the fixed edges round the stretched middle. */
const bordersOf = (slice: ChatStyleRect, base: Sized) => ({
    left: slice.x,
    top: slice.y,
    right: Math.max(0, base.width - (slice.x + slice.width)),
    bottom: Math.max(0, base.height - (slice.y + slice.height)),
});

/** `computeChatBubbleLayout` for `name: words` in a style. */
export const layoutBubble = (regPoints: ChatStyleRegPoints, images: BubbleImages, name: string, words: string, flags: BubbleFlags = {}, settings: BubbleSettings = {}): BubbleLayout => {
    const margins = regPoints.textFieldMargins;
    const { base, pointer } = images;
    const maxWidth = settings.maxWidth ?? CHAT_BUBBLE_WIDTH_NORMAL;
    const scale = settings.fontSizeScale ?? 1;
    const maxHeight = maxHeightAt(scale);
    // `scaleChatFontSize`: the style's size times the scale, never under 1.
    const fontSize = Math.max(1, (regPoints.fontSize ?? DEFAULT_FONT_SIZE) * scale);
    const text = renderChatText(chatLineMarkup(name, words, !!regPoints.anonymous), regPoints.fontFace ?? DEFAULT_FONT_FACE, fontSize, regPoints.textColorRGB ?? 0, maxWidth - margins.x - margins.width);
    const textWidth = text?.textWidth ?? 0;
    const textHeight = text?.textHeight ?? 0;

    let width = Math.min(maxWidth, textWidth + margins.x + margins.width);
    let height = textHeight + margins.y + margins.height;

    if (!flags.system)
        height = Math.min(maxHeight, height);

    width = Math.max(width, base.width);
    height = Math.max(height, base.height);

    if (regPoints.usePixelPerfectNineSlice) {
        // `ManualNineSliceSprite.width/height`: whole pixels, never narrower than the fixed borders.
        const borders = bordersOf(regPoints.scale9, base);

        width = Math.max(borders.left + borders.right, Math.round(width));
        height = Math.max(borders.top + borders.bottom, Math.round(height));
    }

    let bubbleWidth = width;
    let bubbleHeight = height;

    // `ChatStyle.getEmblem`: an emblem needs both its point and its bitmap; the multi-line one once the words wrap.
    const multiline = (text?.lineCount ?? 1) > 1;
    const emblem = multiline && images.emblemMultiline && regPoints.emblemMultilineXY
        ? { image: images.emblemMultiline, ...regPoints.emblemMultilineXY }
        : images.emblem && regPoints.emblemXY ? { image: images.emblem, ...regPoints.emblemXY } : null;

    if (emblem) {
        bubbleWidth = Math.max(bubbleWidth, emblem.x + emblem.image.width);
        bubbleHeight = Math.max(bubbleHeight, emblem.y + emblem.image.height);
    }

    let pointerY: number | null = null;

    if (!regPoints.anonymous && pointer) {
        // `ChatStyle.pointerOffsetY`: the pointer hangs from the foot of the bubble, however tall it grew.
        pointerY = height - (base.height - (regPoints.pointerY ?? 0));
        bubbleHeight = Math.max(bubbleHeight, pointerY + pointer.height);
    }

    bubbleHeight = Math.max(bubbleHeight, margins.y + textHeight + margins.height);

    let face: BubbleLayout['face'] = null;
    const faceImage = images.face;

    if (regPoints.faceXY && faceImage && faceImage.width && faceImage.height) {
        // Flash kept the bottom `height` rows of an over-tall head.
        const cropTop = faceImage.height > height ? faceImage.height - height : 0;
        const shown = faceImage.height - cropTop;
        let x = regPoints.faceXY.x - faceImage.width / 2;
        let y = Math.max(1, regPoints.faceXY.y - shown / 2);

        if (flags.notification) {
            // Centred on the whole bubble, face included, half a pixel left, and lifted by half the pointer.
            const spriteHeight = Math.max(bubbleHeight, y + shown);

            y = Math.max(1, spriteHeight / 2 - shown / 2);
            x -= 0.5;

            if (!regPoints.anonymous)
                y -= (pointer?.height ?? 0) / 2 - 1;
        }

        // `roundPixels`, as the client's sprites are placed.
        face = { x: Math.round(x), y: Math.round(y), height: shown, cropTop };
        bubbleWidth = Math.max(bubbleWidth, face.x + faceImage.width);
        bubbleHeight = Math.max(bubbleHeight, face.y + shown);
    }

    const clip = !flags.system && textHeight > maxHeight ? { width: textWidth + 5, height: maxHeight - margins.height } : null;

    // `ChatBubble`: max(left margin, min(15, ...)) - so in a room's list, always the left margin.
    const pointerX = regPoints.pointerXMargins?.[0] ?? POINTER_MARGIN_LEFT;

    return { width, height, bubbleWidth, bubbleHeight, text, clip, pointerY, pointerX, face, emblem };
};

/** The base drawn at `width` x `height` through its nine-slice: corners as they are, edges stretched along, the middle both ways. */
const drawNineSlice = (context: CanvasRenderingContext2D, base: Drawable, slice: ChatStyleRect, x: number, y: number, width: number, height: number) => {
    const borders = bordersOf(slice, base);
    const columns = [ [ 0, borders.left ], [ borders.left, base.width - borders.left - borders.right ], [ base.width - borders.right, borders.right ] ] as const;
    const rows = [ [ 0, borders.top ], [ borders.top, base.height - borders.top - borders.bottom ], [ base.height - borders.bottom, borders.bottom ] ] as const;
    const targetColumns = [ borders.left, width - borders.left - borders.right, borders.right ];
    const targetRows = [ borders.top, height - borders.top - borders.bottom, borders.bottom ];
    let atY = y;

    for (let row = 0; row < 3; row++) {
        let atX = x;
        const [ sourceY, sourceHeight ] = rows[row]!;
        const targetHeight = targetRows[row]!;

        for (let column = 0; column < 3; column++) {
            const [ sourceX, sourceWidth ] = columns[column]!;
            const targetWidth = targetColumns[column]!;

            if (sourceWidth > 0 && sourceHeight > 0 && targetWidth > 0 && targetHeight > 0)
                context.drawImage(base, sourceX, sourceY, sourceWidth, sourceHeight, atX, atY, targetWidth, targetHeight);

            atX += targetWidth;
        }

        atY += targetHeight;
    }
};

/** Draws a laid-out bubble with its top left at (x, y), in the client's order. */
export const paintBubble = (context: CanvasRenderingContext2D, regPoints: ChatStyleRegPoints, images: BubbleImages, layout: BubbleLayout, x: number, y: number) => {
    const margins = regPoints.textFieldMargins;

    context.imageSmoothingEnabled = false;
    drawNineSlice(context, images.base, regPoints.scale9, x, y, layout.width, layout.height);

    if (layout.emblem)
        context.drawImage(layout.emblem.image, x + layout.emblem.x, y + layout.emblem.y);

    if (images.pointer && layout.pointerY !== null)
        context.drawImage(images.pointer, x + layout.pointerX, y + layout.pointerY);

    if (images.face && layout.face) {
        const { face } = images;

        context.drawImage(face, 0, layout.face.cropTop, face.width, layout.face.height, x + layout.face.x, y + layout.face.y, face.width, layout.face.height);
    }

    if (layout.text) {
        context.save();

        if (layout.clip) {
            context.beginPath();
            context.rect(x + margins.x, y + margins.y, layout.clip.width, layout.clip.height);
            context.clip();
        }

        context.drawImage(layout.text.canvas, x + margins.x, y + margins.y);
        context.restore();
    }
};

const canvasOf = (width: number, height: number) => {
    const canvas = document.createElement('canvas');

    canvas.width = Math.max(1, width);
    canvas.height = Math.max(1, height);

    const context = canvas.getContext('2d')!;

    context.imageSmoothingEnabled = false;

    return { canvas, context };
};

/**
 * `ChatStyle.getBackgroundTexture(color)`: with a `chat_bubble_color` layer, that bitmap multiplied
 * by the speaker's chest colour (keeping its own alpha) and darkened onto a copy of the base at 0,0
 * - Flash's `draw` passes no matrix, so `colorXY` places nothing. Without one, the base as it is.
 */
export const tintBackground = (base: Drawable, colorLayer: Drawable | null | undefined, color: number): Drawable => {
    if (!colorLayer)
        return base;

    const { canvas, context } = canvasOf(base.width, base.height);
    const { canvas: tinted, context: tint } = canvasOf(colorLayer.width, colorLayer.height);

    context.drawImage(base, 0, 0);
    tint.drawImage(colorLayer, 0, 0);
    tint.globalCompositeOperation = 'multiply';
    tint.fillStyle = `#${(color & 0xffffff).toString(16).padStart(6, '0')}`;
    tint.fillRect(0, 0, tinted.width, tinted.height);
    tint.globalCompositeOperation = 'destination-in';
    tint.drawImage(colorLayer, 0, 0);
    context.globalCompositeOperation = 'darken';
    context.drawImage(tinted, 0, 0);

    return canvas;
};

/** The colours the guides are drawn in, as the shape editor's legend names them. */
export const GUIDE_COLORS = { scale9: '#f43f5e', margins: '#0ea5e9', pointer: '#f59e0b', face: '#a855f7', emblem: '#22c55e' } as const;

/**
 * The style's numbers over a laid-out bubble: the nine-slice's stretched middle (`scale9`), the box
 * the words go in (`textFieldMargins`), the pointer's row (`pointerY`), the head's point (`faceXY`)
 * and the emblem's (`emblemXY`).
 */
export const paintGuides = (context: CanvasRenderingContext2D, regPoints: ChatStyleRegPoints, base: Sized, layout: BubbleLayout, x: number, y: number) => {
    const slice = regPoints.scale9;
    const margins = regPoints.textFieldMargins;
    const borders = bordersOf(slice, base);
    const cross = (point: ChatStylePoint, color: string) => {
        context.strokeStyle = color;
        context.beginPath();
        context.moveTo(x + point.x - 4, y + point.y + 0.5);
        context.lineTo(x + point.x + 5, y + point.y + 0.5);
        context.moveTo(x + point.x + 0.5, y + point.y - 4);
        context.lineTo(x + point.x + 0.5, y + point.y + 5);
        context.stroke();
    };

    context.save();
    context.lineWidth = 1;
    context.setLineDash([ 3, 2 ]);
    context.strokeStyle = GUIDE_COLORS.scale9;
    context.strokeRect(x + borders.left + 0.5, y + borders.top + 0.5, layout.width - borders.left - borders.right - 1, layout.height - borders.top - borders.bottom - 1);
    context.strokeStyle = GUIDE_COLORS.margins;
    context.strokeRect(x + margins.x + 0.5, y + margins.y + 0.5, layout.width - margins.x - margins.width - 1, layout.height - margins.y - margins.height - 1);

    if (layout.pointerY !== null) {
        context.strokeStyle = GUIDE_COLORS.pointer;
        context.beginPath();
        context.moveTo(x - 6, y + layout.pointerY + 0.5);
        context.lineTo(x + layout.width + 6, y + layout.pointerY + 0.5);
        context.stroke();
    }

    context.setLineDash([]);

    if (regPoints.faceXY)
        cross(regPoints.faceXY, GUIDE_COLORS.face);

    if (regPoints.emblemXY)
        cross(regPoints.emblemXY, GUIDE_COLORS.emblem);

    context.restore();
};

/** A bitmap's colours moved round the wheel, richer or duller, lighter or darker - its alpha kept. */
export const recolour = (source: Drawable, hue: number, saturation: number, lightness: number): HTMLCanvasElement => {
    const { canvas, context } = canvasOf(source.width, source.height);

    context.drawImage(source, 0, 0);

    if (!hue && saturation === 1 && !lightness)
        return canvas;

    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    const data = image.data;

    for (let at = 0; at < data.length; at += 4) {
        if (!data[at + 3])
            continue;

        const r = data[at]! / 255;
        const g = data[at + 1]! / 255;
        const b = data[at + 2]! / 255;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h = 0;
        let s = 0;
        let l = (max + min) / 2;

        if (max !== min) {
            const d = max - min;

            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            h = (max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60;
        }

        h = (((h + hue) % 360) + 360) % 360;
        s = Math.min(1, Math.max(0, s * saturation));
        l = Math.min(1, Math.max(0, l + lightness * (lightness > 0 ? 1 - l : l)));

        const c = (1 - Math.abs(2 * l - 1)) * s;
        const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
        const m = l - c / 2;
        const [ rr, gg, bb ] = h < 60 ? [ c, x, 0 ] : h < 120 ? [ x, c, 0 ] : h < 180 ? [ 0, c, x ] : h < 240 ? [ 0, x, c ] : h < 300 ? [ x, 0, c ] : [ c, 0, x ];

        data[at] = Math.round((rr + m) * 255);
        data[at + 1] = Math.round((gg + m) * 255);
        data[at + 2] = Math.round((bb + m) * 255);
    }

    context.putImageData(image, 0, 0);

    return canvas;
};

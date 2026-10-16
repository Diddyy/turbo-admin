/**
 * Avatars as the client draws them, from the hotel's nitro-imager (`Turbo:Admin:ImagerUrl`, which
 * the panel reads with the client's addresses): an image of a figure, and the speaker's head in a
 * chat bubble with the chest colour a style's colour layer is tinted in.
 */
import { useMemo } from 'react';

import { useClientAssets } from '#/api/assets';
import { type FigurePalette, usePalettes } from '#/api/gamedata';

import { useImage } from './images';

/** Looks to try a preview with: the dice go round them. */
export const SAMPLE_LOOKS = [
    'hr-115-42.hd-195-19.ch-3030-82.lg-275-1408.fa-1201-62',
    'hd-600-1.hr-515-33.ch-635-70.lg-716-66-62.sh-735-68',
    'hd-180-2.hr-3163-45.ch-3030-82.lg-3023-64.sh-3068-1408-110',
    'hd-605-3.hr-890-37.ch-665-92.lg-700-1408.sh-725-92',
    'hd-190-10.hr-893-31.ch-215-1408.lg-285-82.sh-290-91.ha-1002-1408',
    'hd-620-14.hr-545-61.ch-3067-1408.lg-3216-110.sh-3027-64',
];

export interface AvatarOptions {
    /** `s` small, `n` normal (the room's), `l` large. */
    size?: 's' | 'n' | 'l';
    direction?: number;
    headDirection?: number;
    headOnly?: boolean;
    gesture?: string;
    action?: string;
    gender?: 'M' | 'F';
}

/** An imager url for a figure; null without an imager. Habbo's `avatarimage` parameters. */
export const avatarUrl = (imager: string | undefined, figure: string, options: AvatarOptions = {}) => {
    if (!imager || !figure.trim())
        return null;

    const params = new URLSearchParams({ figure: figure.trim(), size: options.size ?? 'n', direction: String(options.direction ?? 2) });

    if (options.headDirection !== undefined) params.set('head_direction', String(options.headDirection));
    if (options.headOnly) params.set('headonly', '1');
    if (options.gesture) params.set('gesture', options.gesture);
    if (options.action) params.set('action', options.action);
    if (options.gender) params.set('gender', options.gender);

    return `${imager}/avatar?${params}`;
};

/**
 * The colour of a figure's chest piece (`ch-<set>-<colour>`), as `getPartColor(Chest)` reads it:
 * the colour of that id in the palette the `ch` kind takes its colours from. Null when the figure
 * wears no chest piece, or its colour is not in the palette.
 */
export const chestColorOf = (figure: string, palettes: FigurePalette[] | undefined): number | null => {
    const part = figure.split('.').map(x => x.split('-')).find(x => x[0] === 'ch');
    const colour = Number(part?.[2]);

    if (!part || !Number.isInteger(colour) || !palettes)
        return null;

    const palette = palettes.find(x => x.usedBy.includes('ch'));

    for (const entry of palette?.colors ?? []) {
        try {
            const record = JSON.parse(entry.data) as { id?: unknown; hex?: unknown };

            if (Number(record.id) === colour && typeof record.hex === 'string')
                return parseInt(record.hex, 16);
        } catch {
            // A colour the panel cannot read is not one to tint with.
        }
    }

    return null;
};

/** A picture at half its size, nearest neighbour, as Flash's `draw` with a 0.5 matrix and no smoothing. */
const halved = (image: HTMLImageElement) => {
    const canvas = document.createElement('canvas');

    canvas.width = Math.max(1, Math.round(image.width / 2));
    canvas.height = Math.max(1, Math.round(image.height / 2));

    const context = canvas.getContext('2d')!;

    context.imageSmoothingEnabled = false;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    return canvas;
};

/**
 * A speaker's head for a chat bubble, as `ChatBubbleFactory` draws it: the figure's head at the
 * room's scale, cropped to it and halved, facing the room's way (2); and the chest colour a coloured
 * bubble takes, white without one. `unavailable` says why there is no head: no imager set, or the
 * imager did not draw it.
 */
export const useChatHead = (figure: string) => {
    const assets = useClientAssets();
    const { data: palettes } = usePalettes();
    const url = avatarUrl(assets?.imager, figure, { size: 'n', headOnly: true, direction: 2 });
    const { image, failed } = useImage(url);
    const head = useMemo(() => (image ? halved(image) : null), [ image ]);
    const chestColor = useMemo(() => chestColorOf(figure, palettes), [ figure, palettes ]);
    const unavailable = assets && !assets.imager
        ? 'No imager is set (Turbo:Admin:ImagerUrl), so no head is drawn.'
        : failed ? 'The imager could not draw that look.' : null;

    return { head, chestColor, unavailable };
};

import { RotateCcw, Upload } from 'lucide-react';
import { useState } from 'react';

import { uploadPluginImage, usePluginImages } from '#/api/noCode';
import { type SkinSprite, useSkinMap, useThemeSheet } from '#/api/windows';
import { toastError } from '#/components/toast';
import { Badge, IconButton } from '#/components/ui';
import { skinComponentOf } from '#/preview/patchOps';
import { SheetSprite } from '#/preview/VisualEditor';

import { useStudio } from '../studio';

const IMAGE_TYPES = 'image/png,image/gif,image/jpeg,image/webp';

/** A sprite's part as staff read it: `states.default.pieces.0` is "default, piece 1". */
const partName = (part: string) => part.replace(/^states\./, '').replace(/\.pieces\.(\d+)$/, (_, at: string) => `, piece ${Number(at) + 1}`).replace(/\./g, ' ');

/**
 * One sprite of the skin, at its size, and "Replace art": the image goes into the theme's images
 * under the sprite's own name and stands in for it in the draft, so the preview draws it before
 * anything is saved. A sprite the base theme names as an image style (a window's frame, the purse's)
 * takes it through that style, as Theme settings shows it; any other through the theme's
 * `asset.overlays`.
 */
const SpriteRow = ({ sprite }: { sprite: SkinSprite }) => {
    const studio = useStudio();
    const { data: sheet } = useThemeSheet();
    const { data: images } = usePluginImages(studio.theme);
    const [ busy, setBusy ] = useState(false);
    const styled = studio.styles.find(style => (style.type === 'image') && (style.overlay === sprite.overlay));
    // A style holds its image's path in the theme; an overlay the image's address.
    const value = styled ? studio.style(styled.name) : studio.overlay(sprite.overlay);
    const replaced = typeof value === 'string';
    const art = styled ? (images?.images.find(image => image.path === value)?.url ?? null) : (value ?? null);

    const upload = async (file: File) => {
        setBusy(true);

        try {
            const extension = /\.[a-z0-9]+$/i.exec(file.name)?.[0].toLowerCase() ?? '';
            const image = await uploadPluginImage(studio.theme, file, `${sprite.overlay.split('/').pop()}${extension}`);

            // The style is the theme's own: it names its own image by its path.
            if (styled) studio.setStyle(styled.name, image.path, `art:${sprite.overlay}`);
            else studio.setOverlay(sprite.overlay, image.url ?? image.path, `art:${sprite.overlay}`);
        } catch (error) {
            toastError(error);
        } finally {
            setBusy(false);
        }
    };

    return (
        <li className="flex items-center gap-2 text-xs">
            <span className="grid w-9 shrink-0 place-items-center">
                {replaced && art
                    ? <img src={art} alt={`${partName(sprite.part)}: new art`} className="max-h-8 max-w-9 border border-line bg-subtle object-contain [image-rendering:pixelated]" />
                    : <SheetSprite sheet={sheet} sprite={sprite.sprite} max={32} />}
            </span>
            <span className="min-w-0 flex-1 truncate" title={sprite.sprite}>
                {partName(sprite.part)}
                {sprite.width !== undefined && <span className="ml-1 text-muted">{`${sprite.width}x${sprite.height}`}</span>}
            </span>
            {replaced && <Badge tone="amber">new art</Badge>}
            {studio.canManage && (
                <label className={`inline-flex shrink-0 items-center gap-1 text-accent ${busy ? 'opacity-50' : 'cursor-pointer hover:underline'}`}>
                    <Upload className="size-3.5" />
                    {busy ? 'Uploading...' : 'Replace art'}
                    <input
                        type="file"
                        accept={IMAGE_TYPES}
                        aria-label={`Replace the art of ${partName(sprite.part)}`}
                        className="sr-only"
                        disabled={busy}
                        onChange={(event) => {
                            const file = event.target.files?.[0];

                            event.target.value = '';

                            if (file) void upload(file);
                        }}
                    />
                </label>
            )}
            {replaced && (
                <IconButton
                    label={`${partName(sprite.part)}: as before`}
                    icon={<RotateCcw />}
                    small
                    // A style back to its default (Habbo's art); new art not saved yet simply dropped.
                    onClick={() => (styled ? studio.setStyle(styled.name, null, `art:${sprite.overlay}`) : studio.setOverlay(sprite.overlay, undefined, `art:${sprite.overlay}`))}
                />
            )}
        </li>
    );
};

/**
 * The element's skin (`<its kind>:<style>`) as a card: each sprite it is drawn with, at its size,
 * with its art replaced in the theme in place. New art changes every window drawing the skin.
 */
export const SkinCard = ({ tag, style }: { tag: string; style: string | undefined }) => {
    const { data: skins } = useSkinMap();
    const component = skinComponentOf(tag);
    const found = Object.entries(skins?.skins ?? {}).find(([ , skin ]) => (skin.component === component) && (skin.style === (style ?? '0')));

    if (!found) return null;

    const [ id, skin ] = found;
    const windows = Object.keys(skin.windows).length;

    return (
        <section aria-label="Skin art" className="flex flex-col gap-2 rounded-lg border border-line p-2">
            <header className="flex flex-wrap items-baseline gap-x-2 text-xs">
                <span className="font-medium">{`Skin ${id}`}</span>
                <span className="text-muted">{`${windows} window(s) draw it: new art changes each`}</span>
            </header>
            <ul className="flex flex-col gap-1.5">
                {skin.sprites.map(sprite => <SpriteRow key={sprite.part} sprite={sprite} />)}
            </ul>
        </section>
    );
};

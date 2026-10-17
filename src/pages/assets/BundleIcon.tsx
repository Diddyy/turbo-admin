import { Award, Box, FolderTree, Image, LayoutGrid, MessageCircle, Music, PawPrint, Shirt, Sofa, Sparkles } from 'lucide-react';
import { useState } from 'react';

import { furniIconUrl, useClientAssets } from '#/api/assets';
import { type BundleKind, useEffectIcons } from '#/api/bundles';
import { cx } from '#/lib/cx';

const GLYPHS = { furniture: Box, figure: Shirt, effect: Sparkles, pet: PawPrint, template: MessageCircle, room: LayoutGrid, 'furni-icon': Sofa, 'catalog-icon': FolderTree, badge: Award, 'catalog-image': Image, sound: Music } satisfies Record<BundleKind, typeof Box>;

/**
 * What a bundle is at a glance: a furniture's icon from the client's host, by the bundle's name; an
 * effect's icon from the hotel's inventory library, by the first of its ids that has one; clothing,
 * a pet, or one with no icon to find, gets its kind's symbol.
 */
export const BundleIcon = ({ kind, name, ids = [], className }: { kind: BundleKind; name: string; ids?: number[]; className?: string }) => {
    const assets = useClientAssets();
    const { data: effectIcons } = useEffectIcons(kind === 'effect' && ids.length > 0);
    const url = kind === 'furniture'
        ? furniIconUrl(assets, name)
        : kind === 'effect'
            ? ids.map(id => effectIcons?.get(id)).find(Boolean) ?? null
            : null;
    const [ failed, setFailed ] = useState<string | null>(null);
    const Glyph = GLYPHS[kind];

    return (
        <span className={cx('grid size-10 shrink-0 place-items-center rounded-lg bg-subtle', className)}>
            {url && failed !== url
                ? <img key={url} src={url} alt="" loading="lazy" className="max-h-[85%] max-w-[85%] [image-rendering:pixelated]" onError={() => setFailed(url)} />
                : <Glyph className="size-4 text-muted" aria-hidden />}
        </span>
    );
};

import { Box, MessageCircle, PawPrint, Shirt, Sparkles } from 'lucide-react';
import { useState } from 'react';

import { furniIconUrl, useClientAssets } from '#/api/assets';
import type { BundleKind } from '#/api/bundles';
import { cx } from '#/lib/cx';

const GLYPHS = { furniture: Box, figure: Shirt, effect: Sparkles, pet: PawPrint, template: MessageCircle } satisfies Record<BundleKind, typeof Box>;

/**
 * What a bundle is at a glance: a furniture's icon from the client's host, by the bundle's name;
 * clothing, an effect or a pet, or a furniture the host has no icon for, gets its kind's symbol.
 */
export const BundleIcon = ({ kind, name, className }: { kind: BundleKind; name: string; className?: string }) => {
    const assets = useClientAssets();
    const url = kind === 'furniture' ? furniIconUrl(assets, name) : null;
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

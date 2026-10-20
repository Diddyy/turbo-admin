import { ImageOff } from 'lucide-react';

import { useClientAssets } from '#/api/assets';
import { cx } from '#/lib/cx';

import { DEFAULT_COLOR, lighterHalfway, type Notice, parseColor } from './model';

/**
 * `static_bitmap.assetUri` as the client loads it: an address with `${image.library.url}` filled
 * in, or one of the client's own images by name (null: the panel can't draw those).
 */
const useImageUrl = (image: string) => {
    const assets = useClientAssets();
    const value = image.trim();

    if (!value || (!value.includes('/') && !value.includes('${'))) return null;

    const resolved = value.replaceAll('${image.library.url}', assets?.imageLibrary ?? '');

    if (resolved.includes('${')) return null;

    return resolved.startsWith('//') ? `https:${resolved}` : resolved;
};

/**
 * A notice about as the client docks it in the column under the purse (192 wide): a normal one
 * filled with its colour, its open button lighter and a cancel link; a promo or a countdown with
 * its colour as the border, the words underlined as a link, a countdown's clock under them. Drawn
 * by the panel, not the client: the client's own images show as their name.
 */
export const NoticePreview = ({ notice, missingText }: { notice: Notice; missingText?: boolean }) => {
    const color = parseColor(notice.fields.color) ?? DEFAULT_COLOR;
    const type = notice.fields.type || 'normal';
    const url = useImageUrl(notice.fields.image);
    const image = notice.fields.image.trim();
    const words = notice.desc || `notifications.new_feature.${notice.key}.desc`;

    const picture = (
        <span className="flex size-[30px] shrink-0 items-center justify-center" title={image || 'No image'}>
            {url
                ? <img src={url} alt="" className="max-h-[30px] max-w-[30px] [image-rendering:pixelated]" />
                : image
                    ? <span className="rounded bg-black/30 px-0.5 font-mono text-[8px] leading-tight break-all text-white/80">{image.slice(0, 24)}</span>
                    : <ImageOff className="size-4 text-white/40" />}
        </span>
    );

    if (type === 'normal') return (
        <div data-testid="notice-preview" className="flex w-[192px] flex-col gap-1 rounded-md p-1.5 text-[11px] text-white" style={{ backgroundColor: color }}>
            <div className="flex items-center gap-1.5">
                {picture}
                <span className={cx('leading-tight', missingText && 'italic opacity-70')}>{words}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
                <span className="rounded px-2 py-0.5 text-[11px] font-bold text-black" style={{ backgroundColor: lighterHalfway(color) }}>Open</span>
                <span className="underline">Close</span>
            </div>
        </div>
    );

    return (
        <div data-testid="notice-preview" className="flex w-[192px] flex-col rounded-md border-2 bg-[#2b2b2b]/90 p-1 text-[11px] text-white" style={{ borderColor: color, backgroundImage: `linear-gradient(${color}55, ${color}55)` }}>
            <div className="flex items-center gap-1.5">
                {picture}
                <span className={cx('leading-tight underline', missingText && 'italic opacity-70')}>{words}</span>
            </div>
            {type === 'countdown' && <span className="self-center font-mono text-[12px] font-bold tabular-nums">00:00:00:00</span>}
        </div>
    );
};

import { ImageOff, TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';

import { cx } from '#/lib/cx';

import { useNoticeImage } from './hooks';
import { countdownText, DEFAULT_COLOR, descKey, lighterHalfway, type Notice, parseColor, timeOf } from './model';

/** The seconds until a time in the variables' form by the panel's clock, ticking. */
const useSecondsUntil = (value: string) => {
    const at = timeOf(value);
    const [ now, setNow ] = useState(() => Date.now());

    useEffect(() => {
        if (at === null || at <= Date.now()) return;

        const timer = setInterval(() => setNow(Date.now()), 1000);

        return () => clearInterval(timer);
    }, [ at ]);

    return at === null ? 0 : Math.max(0, (at - now) / 1000);
};

/**
 * A notice about as the client docks it in the column under the purse (192 wide): a normal one
 * filled with its colour, its open button lighter and a cancel link; a promo or a countdown with
 * its colour as the border, the words underlined as a link, a countdown's clock under them (by the
 * panel's clock). Drawn by the panel, not the client. A notice without words shows its text key,
 * as the client does, marked; a picture the client can't find shows a warning in its place.
 */
export const NoticePreview = ({ notice }: { notice: Notice }) => {
    const color = parseColor(notice.fields.color) ?? DEFAULT_COLOR;
    const type = notice.fields.type || 'normal';
    const image = notice.fields.image.trim();
    const picture = useNoticeImage(image);
    const seconds = useSecondsUntil(type === 'countdown' ? notice.fields.count_down_to : '');
    const missingText = !notice.texts.desc;
    const words = notice.texts.desc || descKey(notice.key);
    const canClose = notice.fields.close !== 'never';

    const art = (
        <span className="flex size-[30px] shrink-0 items-center justify-center" title={picture.missing ? `The client has no image ${image}` : image || 'No image'}>
            {picture.url && !picture.missing
                ? <img src={picture.url} alt="" onError={picture.onError} className="max-h-[30px] max-w-[30px] [image-rendering:pixelated]" />
                : picture.missing
                    ? <TriangleAlert className="size-4 text-amber-300" aria-label="Image not found" />
                    : <ImageOff className="size-4 text-white/40" aria-label="No image" />}
        </span>
    );
    const text = (
        <span
            className={cx('leading-tight', type !== 'normal' && 'underline', missingText && 'rounded bg-black/40 px-0.5 font-mono text-[9px] break-all text-amber-200 no-underline')}
            title={missingText ? `No text ${descKey(notice.key)}: the client shows its key` : undefined}
        >
            {words}
        </span>
    );

    if (type === 'normal') return (
        <div data-testid="notice-preview" className="flex w-[192px] shrink-0 flex-col gap-1 rounded-md p-1.5 text-[11px] text-white" style={{ backgroundColor: color }}>
            <div className="flex items-center gap-1.5">
                {art}
                {text}
            </div>
            <div className="flex items-center justify-between gap-2">
                <span className="rounded px-2 py-0.5 text-[11px] font-bold text-black" style={{ backgroundColor: lighterHalfway(color) }}>{notice.texts.open_button || 'Open'}</span>
                {canClose && <span className="underline">{notice.texts.cancel_link || 'Close'}</span>}
            </div>
        </div>
    );

    return (
        <div data-testid="notice-preview" className="flex w-[192px] shrink-0 flex-col rounded-md border-2 bg-[#2b2b2b]/90 p-1 text-[11px] text-white" style={{ borderColor: color, backgroundImage: `linear-gradient(${color}55, ${color}55)` }}>
            <div className="flex items-center gap-1.5">
                {art}
                {text}
            </div>
            {type === 'countdown' && <span className="self-center font-mono text-[12px] font-bold tabular-nums">{countdownText(seconds)}</span>}
        </div>
    );
};

import { Images, X } from 'lucide-react';
import { useState } from 'react';

import { type ImageAccept, mediaFilePath, shapeOfValue, useMediaFind } from '#/api/media';
import { cx } from '#/lib/cx';

import { ImagePicker, MediaThumb } from './ImagePicker';

/**
 * A field that holds a picture: what it holds, drawn beside its value, and a button that opens
 * the image picker to choose another - so the value is picked, never typed. `resolve` draws a value
 * the media library doesn't know, as the client would find it; `preview={false}` for a field that
 * draws its picture itself.
 */
export const ImageInput = ({ id, value, onChange, accept, disabled, resolve, preview = true, title, className }: {
    id?: string;
    value: string;
    onChange: (value: string) => void;
    accept: ImageAccept;
    disabled?: boolean;
    resolve?: (value: string) => string | null;
    preview?: boolean;
    title?: string;
    className?: string;
}) => {
    const [ open, setOpen ] = useState(false);
    const text = value.trim();
    const shape = shapeOfValue(text, accept);
    const found = useMediaFind(shape?.key ?? null, shape?.value ?? '', accept.plugin);
    const url = (found.data ? mediaFilePath(found.data) : null) ?? (text && resolve ? resolve(text) : null);

    return (
        <div className={cx('flex min-w-0 items-center gap-2', className)}>
            {preview && <MediaThumb url={url || null} className="size-10 border border-line" />}
            <button
                id={id}
                type="button"
                disabled={disabled}
                aria-haspopup="dialog"
                onClick={() => setOpen(true)}
                data-testid="image-input"
                className={cx(
                    'flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-lg border border-line bg-canvas px-2 py-1 text-left text-[15px] sm:min-h-8 sm:text-[13px]',
                    'hover:border-muted/50 focus:border-accent focus:ring-2 focus:ring-accent/25 focus:outline-none disabled:opacity-60',
                )}
            >
                <Images className="size-4 shrink-0 text-muted" aria-hidden />
                <span className={cx('min-w-0 flex-1 truncate font-mono text-xs', !text && 'font-sans text-muted')} data-testid="image-input-value">{text || 'Pick a picture'}</span>
                {text && found.data === null && <span className="shrink-0 rounded bg-warn-soft px-1.5 text-[11px] font-medium text-warn">not in the media library</span>}
            </button>
            {text && !disabled && (
                <button type="button" onClick={() => onChange('')} aria-label="No picture" title="No picture" className="grid size-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-subtle hover:text-ink">
                    <X className="size-3.5" />
                </button>
            )}
            <ImagePicker open={open} title={title} accept={accept} value={text} onPick={onChange} onClose={() => setOpen(false)} />
        </div>
    );
};

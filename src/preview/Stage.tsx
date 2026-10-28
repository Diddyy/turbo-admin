/**
 * Where a preview is shown: a canvas drawn by `paint` in the middle of a backdrop (a room's floor,
 * the checkerboard, dark or light), at a whole zoom, crisp; and a toolbar under it with the zoom,
 * the backdrop and the preview's own controls. The canvas is drawn again whenever `paint` changes,
 * so a preview passes one made with the state it draws from.
 */
import { ZoomIn, ZoomOut } from 'lucide-react';
import { type ReactNode, useEffect, useRef } from 'react';

import { IconButton } from '#/components/ui';
import { cx } from '#/lib/cx';

import { type Backdrop, BACKDROPS } from './backdrops';

/** A few small choices in a row, for a toolbar. */
export const ToolChoice = <T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: ReactNode; title?: string }[]; onChange: (value: T) => void }) => (
    <div role="radiogroup" aria-label={label} className="flex gap-0.5 rounded-md bg-canvas p-0.5">
        {options.map(option => (
            <button
                key={String(option.value)}
                type="button"
                role="radio"
                aria-checked={option.value === value}
                title={option.title}
                onClick={() => onChange(option.value)}
                className={cx(
                    'flex h-7 min-w-7 items-center justify-center rounded px-2 text-xs font-medium transition-colors',
                    option.value === value ? 'bg-subtle text-ink shadow-[0_0_0_1px_var(--color-line)]' : 'text-muted hover:text-ink',
                )}
            >
                {option.label}
            </button>
        ))}
    </div>
);

interface StageProps {
    /** Draws the preview: sizes the canvas and paints it. Null shows `empty` instead. */
    paint: ((canvas: HTMLCanvasElement, context: CanvasRenderingContext2D) => void) | null;
    zoom: number;
    onZoom: (zoom: number) => void;
    backdrop: Backdrop;
    onBackdrop: (backdrop: Backdrop) => void;
    /** The preview's own controls, before the zoom and backdrop. */
    tools?: ReactNode;
    /** Controls in the stage's top right corner, over the backdrop: they stay put as a wide preview scrolls. */
    corner?: ReactNode;
    empty?: ReactNode;
    maxZoom?: number;
    className?: string;
}

export const Stage = ({ paint, zoom, onZoom, backdrop, onBackdrop, tools, corner, empty, maxZoom = 4, className }: StageProps) => {
    const canvas = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const element = canvas.current;
        const context = element?.getContext('2d');

        if (element && context && paint) {
            context.setTransform(1, 0, 0, 1, 0, 0);
            context.clearRect(0, 0, element.width, element.height);
            paint(element, context);
        }
    }, [ paint ]);

    return (
        <div className={cx('relative overflow-hidden rounded-xl border border-line bg-surface', className)}>
            {corner && <div className="absolute top-3 right-3 z-10">{corner}</div>}
            <div className="flex min-h-72 overflow-auto p-3" style={BACKDROPS.find(x => x.value === backdrop)?.style}>
                {paint
                    // Auto margins, not centring: a preview wider than the stage scrolls from its left edge rather than losing it.
                    ? <canvas ref={canvas} className="m-auto shrink-0 [image-rendering:pixelated]" style={{ zoom }} />
                    : <div className="m-auto">{empty}</div>}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line px-3 py-2 text-xs text-muted">
                {tools}
                <span className="ml-auto flex items-center gap-1">
                    <IconButton label="Zoom out" icon={<ZoomOut />} className="size-7" disabled={zoom <= 1} onClick={() => onZoom(zoom - 1)} />
                    <span className="w-6 text-center tabular-nums">{`${zoom}x`}</span>
                    <IconButton label="Zoom in" icon={<ZoomIn />} className="size-7" disabled={zoom >= maxZoom} onClick={() => onZoom(zoom + 1)} />
                    <ToolChoice
                        label="Behind the preview"
                        value={backdrop}
                        options={BACKDROPS.map(x => ({ value: x.value, title: x.label, label: <span className="size-3 rounded-sm border border-black/20" style={x.style} /> }))}
                        onChange={onBackdrop}
                    />
                </span>
            </div>
        </div>
    );
};

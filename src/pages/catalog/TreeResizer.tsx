import { type KeyboardEvent, type PointerEvent, useRef } from 'react';

import { TREE_WIDTH } from './treeWidth';

/** How far an arrow key moves the edge. */
const STEP = 16;

/**
 * The page tree's right edge, dragged sideways to make the tree wider or narrower; the arrow keys
 * move it too, and a double click puts it back.
 */
export const TreeResizer = ({ width, onWidth }: { width: number; onWidth: (width: number) => void }) => {
    const start = useRef<{ x: number; width: number } | null>(null);

    const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        start.current = { x: event.clientX, width };
    };

    const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
        if (start.current)
            onWidth(start.current.width + event.clientX - start.current.x);
    };

    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        const by = { ArrowLeft: -STEP, ArrowRight: STEP }[event.key];

        if (by) {
            event.preventDefault();
            onWidth(width + by);
        }
    };

    return (
        <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Width of the pages"
            aria-valuenow={width}
            aria-valuemin={TREE_WIDTH.min}
            aria-valuemax={TREE_WIDTH.max}
            tabIndex={0}
            title="Drag to make the pages wider or narrower; double click to put it back."
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={() => (start.current = null)}
            onPointerCancel={() => (start.current = null)}
            onDoubleClick={() => onWidth(TREE_WIDTH.start)}
            onKeyDown={onKeyDown}
            className="group absolute inset-y-0 right-0 z-10 flex w-2 cursor-col-resize touch-none justify-end outline-none max-lg:hidden"
        >
            <span className="h-full w-0.5 transition-colors group-hover:bg-accent group-focus-visible:bg-accent group-active:bg-accent" />
        </div>
    );
};

import { type DragEvent, type PointerEvent as ReactPointerEvent, useRef, useState } from 'react';

import type { DesignBox } from '#/preview/DesignPreview';
import { dragged, type DragKind, unionOf } from '#/preview/VisualEditor';

/** The game's desktop the preview draws on: the overlay's own pixels. */
const FRAME_WIDTH = 1008;

/** A press that moves less than this is a click. */
const CLICK_SLOP_PX = 3;

const HANDLE_PX = 8;

/** An edge this close to another element's edge or centre snaps to it, a guide drawn along it. */
const SNAP_PX = 5;

/** How long after a drop the moved boxes are drawn where they were dropped, until the preview has drawn them there. */
const DROP_SETTLE_MS = 500;

/** What the drag of a palette entry carries. */
export const PALETTE_MIME = 'application/x-turbo-window-part';

/** One element drawn in the window, as the preview host says it (`boxes`). */
export interface BoxedElement {
    template: string;
    key: string;
    tag: string;
    name: string | null;
    tags: string[];
    rects: DesignBox[];
}

export interface Picked {
    template: string;
    key: string;
}

const same = (a: Picked, b: Picked) => (a.template === b.template) && (a.key === b.key);

const HANDLES: { kind: DragKind; left: string; top: string; cursor: string }[] = [
    { kind: 'nw', left: '0%', top: '0%', cursor: 'nwse-resize' },
    { kind: 'n', left: '50%', top: '0%', cursor: 'ns-resize' },
    { kind: 'ne', left: '100%', top: '0%', cursor: 'nesw-resize' },
    { kind: 'e', left: '100%', top: '50%', cursor: 'ew-resize' },
    { kind: 'se', left: '100%', top: '100%', cursor: 'nwse-resize' },
    { kind: 's', left: '50%', top: '100%', cursor: 'ns-resize' },
    { kind: 'sw', left: '0%', top: '100%', cursor: 'nesw-resize' },
    { kind: 'w', left: '0%', top: '50%', cursor: 'ew-resize' },
];

/** The edges and centre of a box along one axis. */
const linesOf = (box: DesignBox, axis: 'x' | 'y') => (axis === 'x' ? [ box.x, box.x + (box.width / 2), box.x + box.width ] : [ box.y, box.y + (box.height / 2), box.y + box.height ]);

/** The smallest shift (within SNAP_PX) that puts one of `moving`'s lines on one of `others`', and the line. */
const snapAxis = (moving: DesignBox, others: readonly DesignBox[], axis: 'x' | 'y'): { shift: number; at: number } | null => {
    let best: { shift: number; at: number } | null = null;

    for (const line of linesOf(moving, axis)) {
        for (const other of others) {
            for (const at of linesOf(other, axis)) {
                const shift = at - line;

                if ((Math.abs(shift) <= SNAP_PX) && (!best || (Math.abs(shift) < Math.abs(best.shift)))) best = { shift, at };
            }
        }
    }

    return best;
};

export interface Move {
    /** In the overlay's pixels, snapped to the other elements where `snapped` says so. */
    dx: number;
    dy: number;
    snapped: { x: boolean; y: boolean };
    done: boolean;
}

interface EditorOverlayProps {
    elements: readonly BoxedElement[];
    selected: readonly Picked[];
    /** What debug drawing is on: every element's box, its name, its tags. */
    show: { rects: boolean; names: boolean; tags: boolean };
    snapToOthers: boolean;
    canEdit: boolean;
    /** A click: the element there picked by the client, `additive` (shift / ctrl) adding it to or taking it from the selection. */
    onPick: (x: number, y: number, additive: boolean) => void;
    /** A marquee drawn: the elements wholly inside it, `additive` keeping those picked. */
    onMarquee: (picked: Picked[], additive: boolean) => void;
    onMove: (move: Move) => void;
    /** The one picked element's handle dragged, in the overlay's pixels. */
    onResize: (kind: DragKind, dx: number, dy: number, done: boolean) => void;
    /** A palette entry dropped at a point. */
    onDrop: (kind: string, x: number, y: number) => void;
}

type Drag
    = | { mode: 'move'; x: number; y: number; moved: boolean; additive: boolean; from: DesignBox }
        | { mode: 'resize'; kind: DragKind; x: number; y: number; from: DesignBox }
        | { mode: 'marquee'; x: number; y: number; moved: boolean; additive: boolean };

/**
 * The window editor over the preview: the picked elements outlined (handles on one picked alone),
 * dragged together to move them - snapped to the edges and centres of the others, a guide drawn -
 * a marquee drawn over empty space to pick what it holds, a click to pick (shift or ctrl to add),
 * a palette entry dropped to add it there, and the debug drawing (every box, names, tags).
 */
export const EditorOverlay = ({ elements, selected, show, snapToOthers, canEdit, onPick, onMarquee, onMove, onResize, onDrop }: EditorOverlayProps) => {
    const root = useRef<HTMLDivElement>(null);
    const drag = useRef<Drag | null>(null);
    const [ live, setLive ] = useState<{ dx: number; dy: number; guides: { x?: number; y?: number } } | null>(null);
    const [ resizing, setResizing ] = useState<{ kind: DragKind; dx: number; dy: number } | null>(null);
    const [ marquee, setMarquee ] = useState<DesignBox | null>(null);
    const picked = elements.filter(element => selected.some(each => same(each, element)));
    const others = elements.filter(element => !selected.some(each => same(each, element)) && (element.key !== ''));
    const group = unionOf(picked.flatMap(element => element.rects));

    /** A pointer's place in the overlay's pixels, whatever the preview's zoom. */
    const pointOf = (clientX: number, clientY: number) => {
        const frame = root.current!.getBoundingClientRect();
        const ratio = FRAME_WIDTH / frame.width;

        return { x: (clientX - frame.left) * ratio, y: (clientY - frame.top) * ratio };
    };

    const inGroup = (x: number, y: number) => picked.some(element => element.rects.some(box => (x >= box.x) && (x <= box.x + box.width) && (y >= box.y) && (y <= box.y + box.height)));

    const snapped = (dx: number, dy: number, from: DesignBox) => {
        const moving = { ...from, x: from.x + dx, y: from.y + dy };
        const boxes = snapToOthers ? others.flatMap(element => element.rects) : [];
        const sx = snapAxis(moving, boxes, 'x');
        const sy = snapAxis(moving, boxes, 'y');

        return { dx: dx + (sx?.shift ?? 0), dy: dy + (sy?.shift ?? 0), snappedX: !!sx, snappedY: !!sy, guides: { ...(sx ? { x: sx.at } : {}), ...(sy ? { y: sy.at } : {}) } };
    };

    const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (event.button !== 0) return;

        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);

        const { x, y } = pointOf(event.clientX, event.clientY);
        const handle = (event.target as HTMLElement).dataset.handle as DragKind | undefined;
        const additive = event.shiftKey || event.ctrlKey || event.metaKey;

        if (handle && group && canEdit) drag.current = { mode: 'resize', kind: handle, x, y, from: group };
        else if (group && !additive && inGroup(x, y) && canEdit) drag.current = { mode: 'move', x, y, moved: false, additive, from: group };
        else drag.current = { mode: 'marquee', x, y, moved: false, additive };
    };

    const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
        const at = drag.current;

        if (!at) return;

        const { x, y } = pointOf(event.clientX, event.clientY);
        const dx = x - at.x;
        const dy = y - at.y;

        if (at.mode === 'resize') {
            setResizing({ kind: at.kind, dx, dy });
            onResize(at.kind, dx, dy, false);

            return;
        }

        if (!at.moved && (Math.abs(dx) < CLICK_SLOP_PX) && (Math.abs(dy) < CLICK_SLOP_PX)) return;

        at.moved = true;

        if (at.mode === 'marquee') {
            setMarquee({ x: Math.min(at.x, x), y: Math.min(at.y, y), width: Math.abs(dx), height: Math.abs(dy) });

            return;
        }

        const snap = snapped(dx, dy, at.from);

        setLive({ dx: snap.dx, dy: snap.dy, guides: snap.guides });
        onMove({ dx: snap.dx, dy: snap.dy, snapped: { x: snap.snappedX, y: snap.snappedY }, done: false });
    };

    const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
        const at = drag.current;

        drag.current = null;

        if (!at) return;

        const { x, y } = pointOf(event.clientX, event.clientY);

        if (at.mode === 'resize') {
            onResize(at.kind, x - at.x, y - at.y, true);
            window.setTimeout(() => setResizing(null), DROP_SETTLE_MS);

            return;
        }

        if (!at.moved) {
            onPick(x, y, at.additive);

            return;
        }

        if (at.mode === 'marquee') {
            const box = { x: Math.min(at.x, x), y: Math.min(at.y, y), width: Math.abs(x - at.x), height: Math.abs(y - at.y) };
            const holds = (rect: DesignBox) => (rect.width > 0) && (rect.x >= box.x) && (rect.y >= box.y) && (rect.x + rect.width <= box.x + box.width) && (rect.y + rect.height <= box.y + box.height);

            setMarquee(null);
            onMarquee(others.concat(at.additive ? picked : []).filter(element => element.rects.length && element.rects.every(holds)).map(({ template, key }) => ({ template, key })), at.additive);

            return;
        }

        const snap = snapped(x - at.x, y - at.y, at.from);

        onMove({ dx: snap.dx, dy: snap.dy, snapped: { x: snap.snappedX, y: snap.snappedY }, done: true });
        window.setTimeout(() => setLive(null), DROP_SETTLE_MS);
    };

    const onDragOver = (event: DragEvent<HTMLDivElement>) => {
        if (event.dataTransfer.types.includes(PALETTE_MIME)) event.preventDefault();
    };

    const onDropped = (event: DragEvent<HTMLDivElement>) => {
        const kind = event.dataTransfer.getData(PALETTE_MIME);

        if (!kind) return;

        event.preventDefault();

        const { x, y } = pointOf(event.clientX, event.clientY);

        onDrop(kind, Math.round(x), Math.round(y));
    };

    const shifted = (box: DesignBox) => (live ? { ...box, x: box.x + live.dx, y: box.y + live.dy } : box);
    let handlesBox = (picked.length === 1) ? group : undefined;

    if (handlesBox && resizing) {
        const change = dragged(resizing.kind, handlesBox, resizing.dx, resizing.dy);

        handlesBox = { x: change.x ?? handlesBox.x, y: change.y ?? handlesBox.y, width: change.width ?? handlesBox.width, height: change.height ?? handlesBox.height };
    } else if (handlesBox) handlesBox = shifted(handlesBox);

    return (
        <div
            ref={root}
            data-window-editor
            className="pointer-events-auto absolute inset-0 select-none"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onDragOver={onDragOver}
            onDrop={onDropped}
        >
            {(show.rects || show.names || show.tags) && elements.map(element => element.rects.slice(0, 1).map(box => (
                <div key={`${element.template}|${element.key}`} data-debug-rect={element.key} className={`absolute ${show.rects ? 'outline outline-1 outline-fuchsia-500/70' : ''}`} style={{ left: box.x, top: box.y, width: box.width, height: box.height }}>
                    {(show.names || show.tags) && (
                        <span className="absolute top-0 left-0 max-w-full truncate bg-black/70 px-0.5 font-mono text-[9px] leading-tight text-white">
                            {[ show.names ? (element.name ?? (element.key || 'window')) : null, show.tags ? [ element.tag, ...element.tags ].join(' ') : null ].filter(Boolean).join(' · ')}
                        </span>
                    )}
                </div>
            )))}
            {picked.flatMap(element => element.rects.map((box, at) => {
                const shown = shifted(box);

                return <div key={`${element.template}|${element.key}|${at}`} data-picked={element.key} className="absolute outline-2 outline-accent outline-dashed" style={{ left: shown.x, top: shown.y, width: shown.width, height: shown.height }} />;
            }))}
            {handlesBox && canEdit && (
                <div aria-label="The picked element" className="absolute" style={{ left: handlesBox.x, top: handlesBox.y, width: handlesBox.width, height: handlesBox.height }}>
                    {HANDLES.map(handle => (
                        <span
                            key={handle.kind}
                            aria-label={`Resize ${handle.kind}`}
                            data-handle={handle.kind}
                            className="absolute border border-accent bg-white"
                            style={{ left: handle.left, top: handle.top, width: HANDLE_PX, height: HANDLE_PX, marginLeft: -HANDLE_PX / 2, marginTop: -HANDLE_PX / 2, cursor: handle.cursor }}
                        />
                    ))}
                </div>
            )}
            {live?.guides.x !== undefined && <div data-guide="x" className="absolute top-0 bottom-0 w-px bg-rose-500" style={{ left: live.guides.x }} />}
            {live?.guides.y !== undefined && <div data-guide="y" className="absolute right-0 left-0 h-px bg-rose-500" style={{ top: live.guides.y }} />}
            {marquee && <div data-marquee className="absolute border border-accent bg-accent/10" style={{ left: marquee.x, top: marquee.y, width: marquee.width, height: marquee.height }} />}
        </div>
    );
};

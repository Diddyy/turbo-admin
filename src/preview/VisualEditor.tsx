import { ChevronDown, Eye, EyeOff, Palette, Redo2, RotateCcw, Undo2, X } from 'lucide-react';
import { type PointerEvent as ReactPointerEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';

import { useTextSearch } from '#/api/gamedata';
import { type SkinEntry, type ThemeSheet, useSkinMap, useTemplateIndex, useThemeSheet, type WindowElement, windowOf } from '#/api/windows';
import { Button, IconButton, Input, Labeled, Select, Switch } from '#/components/ui';

import { type DesignBox, type DesignDraft, DesignPreview, type DesignPreviewControls, type DesignRects, type DesignSelection } from './DesignPreview';
import { type OpsHistory } from './opsHistory';
import { colourOf, colourParts, colourValue, setOf, skinComponentOf, withEntry, withSet, withSets } from './patchOps';

/** A press that moves less than this is a click: it picks what is under it instead of moving the element. */
const CLICK_SLOP_PX = 3;

const HANDLE_PX = 8;

/** How long after a drop the box is drawn where it was dropped, until the preview has drawn the element there. */
const DROP_SETTLE_MS = 500;

type Ops = OpsHistory;

/** Every element of a window a patch can name, by its key, in the tree's order with its depth. */
const keyedElements = (elements: readonly WindowElement[]) => {
    const found: { element: WindowElement; depth: number }[] = [];

    const visit = (list: readonly WindowElement[], depth: number) => {
        for (const element of list) {
            if (element.key !== undefined) found.push({ element, depth });

            if (element.children) visit(element.children, depth + 1);
        }
    };

    visit(elements, 0);

    return found;
};

/** A sprite cut from the theme sheet, at most `max` pixels a side. */
const SheetSprite = ({ sheet, sprite, max = 24 }: { sheet: ThemeSheet | undefined; sprite: string; max?: number }) => {
    const frame = sheet?.frames[sprite];

    if (!sheet || !frame) return <span className="inline-block size-6 rounded border border-dashed border-line" />;

    const scale = Math.min(1, max / Math.max(frame.w, frame.h));

    return (
        <span className="inline-block shrink-0 overflow-hidden [image-rendering:pixelated]" style={{ width: frame.w * scale, height: frame.h * scale }}>
            <span className="block origin-top-left" style={{ width: frame.w, height: frame.h, background: `url(${sheet.url}) -${frame.x}px -${frame.y}px`, transform: `scale(${scale})` }} />
        </span>
    );
};

/** A skin's look: its first few sprites. */
const SkinLook = ({ skin, sheet }: { skin: SkinEntry | undefined; sheet: ThemeSheet | undefined }) => (
    <span className="flex items-center gap-0.5">
        {(skin?.sprites ?? []).slice(0, 3).map(sprite => <SheetSprite key={sprite.part} sheet={sheet} sprite={sprite.sprite} />)}
        {skin?.tintColor && <span className="ml-1 inline-block size-2.5 rounded-sm" style={{ background: skin.tintColor }} />}
    </span>
);

/** The skins an element of `tag` takes, as a drop-down drawing each. */
const StylePicker = ({ tag, value, onChange }: { tag: string; value: string | undefined; onChange: (style: string) => void }) => {
    const { data: skins } = useSkinMap();
    const { data: sheet } = useThemeSheet();
    const [ open, setOpen ] = useState(false);
    const component = skinComponentOf(tag);
    const options = useMemo(() => Object.entries(skins?.skins ?? {})
        .filter(([ , skin ]) => skin.component === component)
        .sort(([ , a ], [ , b ]) => Number(a.style) - Number(b.style) || a.style.localeCompare(b.style)), [ skins, component ]);

    if (!options.length) return <p className="text-xs text-muted">{`A ${tag} has no skins to pick from.`}</p>;

    const current = options.find(([ , skin ]) => skin.style === value)?.[1];

    return (
        <div className="relative">
            <button type="button" aria-haspopup="listbox" aria-expanded={open} aria-label="Style" onClick={() => setOpen(!open)} className="flex h-8 w-full items-center gap-2 rounded-lg border border-line bg-canvas px-2 text-[13px]">
                <SkinLook skin={current} sheet={sheet} />
                <span>{value === undefined ? 'Its own' : `Style ${value}`}</span>
                <ChevronDown className="ml-auto size-4 text-muted" />
            </button>
            {open && (
                <ul role="listbox" aria-label="Styles" className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-line bg-surface p-1 shadow-lg">
                    {options.map(([ id, skin ]) => (
                        <li key={id}>
                            <button
                                type="button"
                                role="option"
                                aria-selected={skin.style === value}
                                onClick={() => {
                                    onChange(skin.style);
                                    setOpen(false);
                                }}
                                className={`flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[13px] hover:bg-subtle ${skin.style === value ? 'bg-subtle' : ''}`}
                            >
                                <SkinLook skin={skin} sheet={sheet} />
                                <span>{`Style ${skin.style}`}</span>
                                <span className="ml-auto text-xs text-muted">{`${Object.keys(skin.windows).length} window(s)`}</span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

/** A colour as a picker and an opacity (0-255), with a way back to the element's own. */
const ColourField = ({ label, value, own, onChange, onReset }: { label: string; value: number | null; own: number | null; onChange: (argb: number) => void; onReset?: () => void }) => {
    const shown = value ?? own ?? 0xffffffff;
    const { hex, alpha } = colourParts(shown);

    return (
        <Labeled label={label}>
            <span className="flex items-center gap-2">
                <input type="color" aria-label={`${label} picker`} value={hex} onChange={event => onChange(colourOf(event.target.value, alpha))} className="h-8 w-10 rounded border border-line bg-canvas" />
                <Input type="number" aria-label={`${label} opacity`} title="Opacity, 0 (none) to 255 (whole)" min={0} max={255} value={alpha} onChange={event => onChange(colourOf(hex, Number(event.target.value)))} className="w-20" />
                <span className="font-mono text-xs text-muted">{hex}</span>
                {onReset && value !== null && <IconButton label="Its own colour" icon={<RotateCcw />} small onClick={onReset} />}
            </span>
        </Labeled>
    );
};

/** A number a patch sets, its own shown when none is set; emptied, the element's own comes back. */
const NumberField = ({ label, value, own, onChange }: { label: string; value: unknown; own: number | undefined; onChange: (value: number | undefined) => void }) => (
    <Labeled label={label}>
        <Input
            type="number"
            aria-label={label}
            value={typeof value === 'number' ? value : ''}
            placeholder={own === undefined ? '' : String(own)}
            onChange={event => onChange(event.target.value === '' ? undefined : Number(event.target.value))}
            className={`w-full ${typeof value === 'number' ? 'font-medium text-accent' : ''}`}
        />
    </Labeled>
);

/** A text key picked by what it says or by its key: the caption becomes `${key}`. */
const TextKeyPicker = ({ onPick }: { onPick: (key: string) => void }) => {
    const [ query, setQuery ] = useState('');
    const { data } = useTextSearch(query, 1);
    const found = query.trim().length >= 2 ? (data?.items ?? []).slice(0, 8) : [];

    return (
        <div className="flex flex-col gap-1">
            <Input aria-label="Find a text" value={query} onChange={event => setQuery(event.target.value)} placeholder="Find a text by what it says or its key" />
            {found.map(text => (
                <button key={text.key} type="button" onClick={() => onPick(text.key)} className="flex gap-2 rounded px-1.5 py-0.5 text-left text-xs hover:bg-subtle">
                    <span className="font-mono text-muted">{text.key}</span>
                    <span className="truncate">{text.value}</span>
                </button>
            ))}
        </div>
    );
};

const SCALES = [ 'fixed', 'move', 'stretch', 'center' ];
const ALIGN_H = [ 'left', 'center', 'right' ];
const ALIGN_V = [ 'top', 'middle', 'bottom' ];

/** A pair param (`scale`, `align`) as two drop-downs. */
const PairParam = ({ label, value, own, options, onChange }: { label: string; value: unknown; own: unknown; options: [ string[], string[] ]; onChange: (pair: [ string, string ]) => void }) => {
    const pair = (Array.isArray(value) ? value : Array.isArray(own) ? own : [ options[0][0], options[1][0] ]) as [ string, string ];

    return (
        <Labeled label={label}>
            <span className="flex gap-2">
                {[ 0, 1 ].map(at => (
                    <Select key={at} aria-label={`${label} ${at === 0 ? 'across' : 'down'}`} value={pair[at]} onChange={event => onChange(at === 0 ? [ event.target.value, pair[1] ] : [ pair[0], event.target.value ])}>
                        {options[at]!.map(option => <option key={option} value={option}>{option}</option>)}
                    </Select>
                ))}
            </span>
        </Labeled>
    );
};

/** A variable as a field of its kind: a switch, a number or a text. */
const VarField = ({ name, value, own, onChange }: { name: string; value: unknown; own: unknown; onChange: (value: unknown) => void }) => {
    const shown = value ?? own;

    if (typeof shown === 'boolean') return <Switch label={name} checked={shown} onChange={onChange} />;

    if (typeof shown === 'number') return <NumberField label={name} value={value} own={typeof own === 'number' ? own : undefined} onChange={onChange} />;

    return (
        <Labeled label={name}>
            <Input aria-label={name} value={typeof value === 'string' ? value : ''} placeholder={typeof own === 'string' ? own : ''} onChange={event => onChange(event.target.value)} />
        </Labeled>
    );
};

interface Picked {
    key: string;
    tag: string;
    /** The client's element as drawn, when it was picked in the preview. */
    drawn?: DesignSelection['element'];
}

type DragKind = 'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

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

/** A drag's change to an element's place and size, in a patch's pixels. */
const dragged = (kind: DragKind, start: { x: number; y: number; width: number; height: number }, dx: number, dy: number) => {
    const out: Record<string, number> = {};
    // Only what the drag changed: a move straight down sets y, not x as well.
    const across = dx !== 0;
    const down = dy !== 0;

    if (kind === 'move') {
        if (across) out.x = start.x + dx;
        if (down) out.y = start.y + dy;

        return out;
    }

    if (across && kind.includes('e')) out.width = Math.max(0, start.width + dx);
    if (down && kind.includes('s')) out.height = Math.max(0, start.height + dy);
    if (across && kind.includes('w')) Object.assign(out, { x: start.x + dx, width: Math.max(0, start.width - dx) });
    if (down && kind.includes('n')) Object.assign(out, { y: start.y + dy, height: Math.max(0, start.height - dy) });

    return out;
};

/**
 * The picked element's box over the preview: dragged, it moves the element; a handle dragged
 * resizes it; a click (no drag) picks what is under it, as a press on the window would.
 */
const Handles = ({ box, onDrag, onClick }: { box: DesignBox; onDrag: (kind: DragKind, dx: number, dy: number, done: boolean) => void; onClick: (x: number, y: number) => void }) => {
    // While dragged, the box is drawn from where it was pressed: the preview moves the element under it as it goes.
    const [ offset, setOffset ] = useState<{ from: DesignBox; kind: DragKind; dx: number; dy: number } | null>(null);
    const drag = useRef<{ kind: DragKind; x: number; y: number; from: DesignBox; moved: boolean } | null>(null);

    const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { kind: ((event.target as HTMLElement).dataset.handle as DragKind | undefined) ?? 'move', x: event.clientX, y: event.clientY, from: box, moved: false };
    };

    const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
        const at = drag.current;

        if (!at) return;

        const dx = event.clientX - at.x;
        const dy = event.clientY - at.y;

        if (!at.moved && (Math.abs(dx) < CLICK_SLOP_PX) && (Math.abs(dy) < CLICK_SLOP_PX)) return;

        at.moved = true;
        setOffset({ from: at.from, kind: at.kind, dx, dy });
        onDrag(at.kind, dx, dy, false);
    };

    const onPointerUp = (event: ReactPointerEvent<HTMLElement>) => {
        const at = drag.current;

        drag.current = null;

        if (!at) return;

        if (!at.moved) {
            const frame = (event.currentTarget.closest('[data-design-overlay]') as HTMLElement | null)?.getBoundingClientRect();

            if (frame) onClick(event.clientX - frame.left, event.clientY - frame.top);

            return;
        }

        onDrag(at.kind, event.clientX - at.x, event.clientY - at.y, true);
        // The preview draws the element where it was dropped within a moment: its box is the preview's again.
        window.setTimeout(() => setOffset(null), DROP_SETTLE_MS);
    };

    let shown = box;

    if (offset) {
        const change = dragged(offset.kind, offset.from, offset.dx, offset.dy);

        shown = { x: change.x ?? offset.from.x, y: change.y ?? offset.from.y, width: change.width ?? offset.from.width, height: change.height ?? offset.from.height };
    }

    return (
        <div data-design-overlay className="absolute inset-0">
            <div
                aria-label="Move the element"
                className="pointer-events-auto absolute cursor-move outline-2 outline-accent outline-dashed"
                style={{ left: shown.x, top: shown.y, width: shown.width, height: shown.height }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
            >
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
        </div>
    );
};

/** The box around every drawing of an element (a frame is drawn by more than one container); undefined for none with a size. */
const unionOf = (boxes: readonly DesignBox[]): DesignBox | undefined => {
    const sized = boxes.filter(box => (box.width > 0) && (box.height > 0));

    if (!sized.length) return undefined;

    const left = Math.min(...sized.map(box => box.x));
    const top = Math.min(...sized.map(box => box.y));

    return { x: left, y: top, width: Math.max(...sized.map(box => box.x + box.width)) - left, height: Math.max(...sized.map(box => box.y + box.height)) - top };
};

interface VisualEditorProps {
    template: string;
    part?: string;
    ops: readonly unknown[];
    history: Ops;
    draft: DesignDraft | undefined;
    owner: string | undefined;
    /** Below the preview: what an editor shows of the picked element besides its fields. */
    footer?: (picked: DesignSelection | null) => ReactNode;
}

/**
 * The window drawn by the game with the editor's patch, and the element picked in it edited by
 * hand: dragged to move, its handles to resize, and a field per value - place, size, colour,
 * shown or hidden, style (the skins its kind takes), caption (or a text by key), its variables and
 * layout params. Each change goes into the element's one `set` op; undo and redo step through them.
 */
export const VisualEditor = ({ template, part, ops, history, draft, owner, footer }: VisualEditorProps) => {
    const { data: index } = useTemplateIndex();
    const found = index ? windowOf(index, template) : undefined;
    const elements = useMemo(() => keyedElements(found?.elements ?? []), [ found ]);
    const [ picked, setPicked ] = useState<Picked | null>(null);
    const [ selection, setSelection ] = useState<DesignSelection | null>(null);
    const [ rects, setRects ] = useState<DesignRects | null>(null);
    const controls = useRef<DesignPreviewControls | null>(null);
    const dragStart = useRef<{ x: number; y: number; width: number; height: number; group: string } | null>(null);
    const indexed = picked ? elements.find(entry => entry.element.key === picked.key)?.element : undefined;
    const values = picked ? setOf(ops, picked.key) : {};
    const root = found?.elements[0];
    const framed = (root?.tag === 'frame') || !template.includes('/');
    const { undo, redo } = history;

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement | null;

            if (target?.closest('input, textarea, select, [contenteditable]')) return;

            if (event.key === 'Escape') {
                setPicked(null);

                return;
            }

            if (!(event.ctrlKey || event.metaKey)) return;

            const key = event.key.toLowerCase();

            if ((key === 'z') && !event.shiftKey) undo();
            else if ((key === 'y') || ((key === 'z') && event.shiftKey)) redo();
            else return;

            event.preventDefault();
        };

        window.addEventListener('keydown', onKey);

        return () => window.removeEventListener('keydown', onKey);
    }, [ undo, redo ]);

    /** The element's own place and size: as its layout has it (Habbo's own), else as drawn when picked in the preview. */
    const own = (indexed && { x: indexed.rect[0], y: indexed.rect[1], width: indexed.rect[2], height: indexed.rect[3] })
        ?? (picked?.drawn && { x: picked.drawn.x, y: picked.drawn.y, width: picked.drawn.width, height: picked.drawn.height });
    const current = own && {
        x: typeof values.x === 'number' ? values.x : own.x,
        y: typeof values.y === 'number' ? values.y : own.y,
        width: typeof values.width === 'number' ? values.width : own.width,
        height: typeof values.height === 'number' ? values.height : own.height,
    };

    const set = (property: string, value: unknown, group = property) => {
        if (picked) history.change(withSet(ops, picked.key, property, value), `${picked.key}:${group}`);
    };

    const onDrag = (kind: DragKind, dx: number, dy: number, done: boolean) => {
        if (!picked || !current) return;

        if (!dragStart.current) dragStart.current = { ...current, group: `${picked.key}:drag:${Date.now()}` };

        const scale = rects?.scale ?? 1;
        const change = dragged(kind, dragStart.current, Math.round(dx * scale), Math.round(dy * scale));

        history.change(withSets(ops, picked.key, change), dragStart.current.group);

        if (done) dragStart.current = null;
    };

    const box = (picked && rects && (rects.key === picked.key)) ? unionOf(rects.rects) : undefined;
    const ownColour = colourValue(picked?.drawn?.color ?? null);
    const drawnVars = picked?.drawn?.vars ?? {};
    const drawnParams = picked?.drawn?.params ?? {};
    const setVars = (values.vars ?? {}) as Record<string, unknown>;
    const setParams = (values.params ?? {}) as Record<string, unknown>;
    const ownHidden = !!indexed?.hidden;
    const hidden = typeof values.hidden === 'boolean' ? values.hidden : ownHidden;
    const ownStyle = indexed?.style;
    const style = typeof values.style === 'string' ? values.style : (typeof values.style === 'number' ? String(values.style) : ownStyle);
    const caption = typeof values.caption === 'string' ? values.caption : undefined;
    const rootColour = colourValue(setOf(ops, '').color ?? null);

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
                <Button variant="secondary" icon={<Undo2 />} disabled={!history.canUndo} onClick={undo} title="Undo (Ctrl+Z)">Undo</Button>
                <Button variant="secondary" icon={<Redo2 />} disabled={!history.canRedo} onClick={redo} title="Redo (Ctrl+Y)">Redo</Button>
                {framed && (
                    <span className="ml-2 flex items-center gap-2 text-xs">
                        <Palette className="size-4 text-muted" />
                        <span>Recolour this window</span>
                        <input
                            type="color"
                            aria-label="Window colour"
                            value={colourParts(rootColour ?? 0xffffffff).hex}
                            onChange={event => history.change(withSet(ops, '', 'color', colourOf(event.target.value, colourParts(rootColour ?? 0xffffffff).alpha)), ':color')}
                            className="h-7 w-9 rounded border border-line bg-canvas"
                        />
                        {rootColour !== null && <IconButton label="The window's own colour" icon={<RotateCcw />} small onClick={() => history.change(withSet(ops, '', 'color', undefined))} />}
                    </span>
                )}
            </div>
            <div className="grid gap-3 xl:grid-cols-[auto_20rem]">
                <DesignPreview
                    template={template}
                    part={part}
                    draft={draft}
                    owner={owner}
                    selected={picked?.key ?? null}
                    controls={controls}
                    onRects={setRects}
                    onSelect={(picks) => {
                        setSelection(picks);

                        if (picks.key !== null) setPicked({ key: picks.key, tag: picks.tag, drawn: picks.element });
                    }}
                    overlay={box && <Handles box={box} onDrag={onDrag} onClick={(x, y) => controls.current?.pick(x, y)} />}
                />
                <div className="flex flex-col gap-3 text-sm" aria-label="The picked element">
                    <Labeled label="Element" hint="Click it in the window, or pick it here (hidden ones too). Esc picks nothing.">
                        <span className="flex gap-1">
                            <Select
                                aria-label="Element"
                                value={picked?.key ?? '-'}
                                onChange={(event) => {
                                    const entry = elements.find(item => item.element.key === event.target.value);

                                    if (entry) setPicked({ key: entry.element.key!, tag: entry.element.tag });
                                }}
                            >
                                <option value="-" disabled>Pick an element</option>
                                {elements.map(({ element, depth }) => (
                                    <option key={element.key} value={element.key}>
                                        {`${'  '.repeat(depth)}${element.key === '' ? 'the window' : element.key} (${element.tag}${element.hidden ? ', hidden' : ''})`}
                                    </option>
                                ))}
                            </Select>
                            {picked && <IconButton label="Pick nothing" icon={<X />} onClick={() => setPicked(null)} />}
                        </span>
                    </Labeled>
                    {picked && (
                        <>
                            <div className="grid grid-cols-2 gap-2">
                                <NumberField label="X" value={values.x} own={own?.x} onChange={value => set('x', value)} />
                                <NumberField label="Y" value={values.y} own={own?.y} onChange={value => set('y', value)} />
                                <NumberField label="Width" value={values.width} own={own?.width} onChange={value => set('width', value)} />
                                <NumberField label="Height" value={values.height} own={own?.height} onChange={value => set('height', value)} />
                            </div>
                            <Switch
                                label={<span className="inline-flex items-center gap-1.5">{hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}Hidden</span>}
                                checked={hidden}
                                onChange={on => set('hidden', on === ownHidden ? undefined : on)}
                            />
                            <ColourField label="Colour" value={colourValue(values.color ?? null)} own={ownColour} onChange={argb => set('color', argb)} onReset={() => set('color', undefined, 'color-reset')} />
                            <Labeled label="Style">
                                <StylePicker tag={picked.tag} value={style} onChange={next => set('style', next === ownStyle ? undefined : next)} />
                            </Labeled>
                            <Labeled label="Caption" hint={indexed?.caption ? `Its own: ${indexed.caption}` : undefined}>
                                <Input aria-label="Caption" value={caption ?? ''} placeholder={indexed?.caption ?? ''} onChange={event => set('caption', event.target.value === '' ? undefined : event.target.value)} />
                            </Labeled>
                            <TextKeyPicker onPick={key => set('caption', `\${${key}}`, 'caption-key')} />
                            {Object.keys({ ...drawnVars, ...setVars }).length > 0 && (
                                <fieldset className="flex flex-col gap-2">
                                    <legend className="mb-1 text-xs font-medium text-muted">Variables</legend>
                                    {Object.keys({ ...drawnVars, ...setVars }).sort().map(name => (
                                        <VarField key={name} name={name} value={setVars[name]} own={drawnVars[name]} onChange={value => picked && history.change(withEntry(ops, picked.key, 'vars', name, value), `${picked.key}:vars.${name}`)} />
                                    ))}
                                </fieldset>
                            )}
                            {picked.drawn && (
                                <fieldset className="flex flex-col gap-2">
                                    <legend className="mb-1 text-xs font-medium text-muted">Layout</legend>
                                    <PairParam label="Follows its parent's resize" value={setParams.scale} own={drawnParams.scale} options={[ SCALES, SCALES ]} onChange={pair => history.change(withEntry(ops, picked.key, 'params', 'scale', pair), `${picked.key}:params.scale`)} />
                                    <PairParam label="Keeps this edge when resized" value={setParams.align} own={drawnParams.align} options={[ ALIGN_H, ALIGN_V ]} onChange={pair => history.change(withEntry(ops, picked.key, 'params', 'align', pair), `${picked.key}:params.align`)} />
                                </fieldset>
                            )}
                        </>
                    )}
                    {footer?.(selection)}
                </div>
            </div>
        </div>
    );
};

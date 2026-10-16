/**
 * The chat style editor's tabs, every field of a style's definition as nitro-react's
 * `ChatStyleDefinitions.ts` types it (after Nitro Studio's `ChatStyleEditors`):
 *
 * - `FlagsEditor`: who may speak with it - the server checks each line by these, and the client's
 *   picker offers it by them - and how it behaves.
 * - `WordsEditor`: the words' face, size and colour, and the links' colours.
 * - `ShapeEditor`: every other reg point - the nine-slice, the box the words go in, how far
 *   neighbours may overlap it, the pointer's row and margins, the head's, colour layer's and
 *   emblems' points, anonymous and pixel-perfect nine-slicing - with guides drawn over the bubble.
 * - `BitmapsEditor`: a picture of its own for each bitmap, and which of the optional ones it has.
 */
import { Eye, EyeOff, Upload, X } from 'lucide-react';
import type { ReactNode } from 'react';

import type { ChatStyleFile } from '#/api/content';
import { Button, Checkbox, IconButton, Input, Labeled, Select } from '#/components/ui';
import { cx } from '#/lib/cx';
import { type ChatStylePoint, type ChatStyleRect, type ChatStyleRegPoints, DEFAULT_FONT_FACE, DEFAULT_FONT_SIZE, GUIDE_COLORS, POINTER_MARGIN_LEFT, POINTER_MARGIN_RIGHT } from '#/preview/chatBubble';

import { BITMAP_FIELDS, FLAG_FIELDS, type Flags } from './fields';

/** A whole number field: an empty or partial entry is held as 0 rather than refused. */
const NumberInput = ({ value, onChange, min, max, label }: { value: number; onChange: (value: number) => void; min?: number; max?: number; label?: string }) => (
    <Input
        type="number"
        inputMode="numeric"
        aria-label={label}
        value={String(value)}
        min={min}
        max={max}
        onChange={(event) => {
            const next = Math.round(Number(event.target.value));

            onChange(Number.isFinite(next) ? next : 0);
        }}
        className="w-full font-mono tabular-nums"
    />
);

/* ---------------------------------------------------------------- flags */

export const FlagsEditor = ({ flags, normal, onChange }: { flags: Flags; normal: boolean; onChange: (next: Flags) => void }) => (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {([ [ 'who', 'Who may speak with it' ], [ 'how', 'How it behaves' ] ] as const).map(([ group, title ]) => (
            <div key={group} className="flex flex-col gap-3">
                <span className="text-sm font-medium">{title}</span>
                {FLAG_FIELDS.filter(flag => flag.group === group).map(flag => (
                    <Checkbox
                        key={flag.key}
                        label={flag.label}
                        hint={flag.hint}
                        checked={flags[flag.key]}
                        disabled={normal && group === 'who' && flag.key !== 'staffOverrideable'}
                        onChange={on => onChange({ ...flags, [flag.key]: on })}
                    />
                ))}
                {group === 'who' && normal && <p className="text-xs text-muted">The normal bubble is everyone's: a line in a bubble its speaker may not use is said in it.</p>}
            </div>
        ))}
    </div>
);

/* ---------------------------------------------------------------- words */

/** The faces the client's text renderer draws (`FLASH_FONT_FACES`). */
const FACES = [ 'Ubuntu', 'UbuntuCondensed', 'Volter', 'Volter Bold' ];

const hexOf = (rgb: number) => `#${(rgb & 0xffffff).toString(16).padStart(6, '0')}`;

const ColourInput = ({ label, value, faded, onChange }: { label: string; value: number; faded?: boolean; onChange: (value: number) => void }) => (
    <input
        type="color"
        aria-label={label}
        value={hexOf(value)}
        onChange={event => onChange(parseInt(event.target.value.slice(1), 16))}
        className={cx('h-11 w-14 cursor-pointer rounded-lg border border-line bg-canvas p-1 sm:h-9', faded && 'opacity-40')}
    />
);

/** A colour that may be left out: then the words' own. */
const OptionalColour = ({ label, hint, value, fallback, onChange }: { label: string; hint: string; value: number | undefined; fallback: number; onChange: (value: number | undefined) => void }) => (
    <Labeled label={label} hint={hint}>
        <span className="flex items-center gap-2">
            <ColourInput label={label} value={value ?? fallback} faded={value === undefined} onChange={onChange} />
            {value === undefined
                ? <span className="text-xs text-muted">as the words</span>
                : <IconButton label={`Clear the ${label.toLowerCase()}`} icon={<X />} onClick={() => onChange(undefined)} />}
        </span>
    </Labeled>
);

export const WordsEditor = ({ regPoints, onChange }: { regPoints: ChatStyleRegPoints; onChange: (next: Partial<ChatStyleRegPoints>) => void }) => {
    const text = regPoints.textColorRGB ?? 0;
    const face = regPoints.fontFace ?? DEFAULT_FONT_FACE;

    return (
        <div className="flex flex-col gap-4">
            <div className="grid max-w-xl grid-cols-[minmax(0,1fr)_6rem_auto] gap-3">
                <Labeled label="Words in" hint="fontFace">
                    <Select value={face} onChange={event => onChange({ fontFace: event.target.value })} className="w-full">
                        {!FACES.includes(face) && <option value={face}>{face}</option>}
                        {FACES.map(x => <option key={x} value={x}>{x}</option>)}
                    </Select>
                </Labeled>
                <Labeled label="Size" hint="fontSize">
                    <NumberInput value={regPoints.fontSize ?? DEFAULT_FONT_SIZE} min={1} max={64} onChange={fontSize => onChange({ fontSize: Math.max(1, fontSize) })} />
                </Labeled>
                <Labeled label="Colour" hint="textColorRGB">
                    <ColourInput label="The words' colour" value={text} onChange={textColorRGB => onChange({ textColorRGB })} />
                </Labeled>
            </div>
            <p className="text-xs text-muted">The client draws whole sizes in its own fonts; a size the chat font setting scales to a fraction is drawn in the browser's, as it is in a room.</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <OptionalColour label="Links" hint="linkColorRGB" value={regPoints.linkColorRGB} fallback={text} onChange={linkColorRGB => onChange({ linkColorRGB })} />
                <OptionalColour label="Links hovered" hint="linkHoverColorRGB" value={regPoints.linkHoverColorRGB} fallback={text} onChange={linkHoverColorRGB => onChange({ linkHoverColorRGB })} />
                <OptionalColour label="Links pressed" hint="linkActiveColorRGB" value={regPoints.linkActiveColorRGB} fallback={text} onChange={linkActiveColorRGB => onChange({ linkActiveColorRGB })} />
            </div>
        </div>
    );
};

/* ---------------------------------------------------------------- shape */

type RectKey = 'scale9' | 'textFieldMargins' | 'overlapRect';
type PointKey = 'faceXY' | 'colorXY' | 'emblemXY' | 'emblemMultilineXY';
type Side = keyof ChatStyleRect;

const RECTS: { key: RectKey; label: string; hint: string; sides: [ Side, string ][]; color?: string; optional?: boolean }[] = [
    { key: 'scale9', label: 'The stretched middle (scale9)', hint: 'What stretches as the words grow; the corners round it stay as drawn.', sides: [ [ 'x', 'From the left' ], [ 'y', 'From the top' ], [ 'width', 'Width' ], [ 'height', 'Height' ] ], color: GUIDE_COLORS.scale9 },
    { key: 'textFieldMargins', label: 'Round the words (textFieldMargins)', hint: 'How far the words sit from each edge of the bubble.', sides: [ [ 'x', 'Left' ], [ 'y', 'Top' ], [ 'width', 'Right' ], [ 'height', 'Bottom' ] ], color: GUIDE_COLORS.margins },
    { key: 'overlapRect', label: 'Overlapping neighbours (overlapRect)', hint: 'How far the bubbles above and beside it may reach over its art, from each edge.', sides: [ [ 'x', 'Left' ], [ 'y', 'Top' ], [ 'width', 'Right' ], [ 'height', 'Bottom' ] ], optional: true },
];

const POINTS: { key: PointKey; label: string; hint: string; color?: string; fallback: (baseHeight: number) => ChatStylePoint }[] = [
    { key: 'faceXY', label: 'The head (faceXY)', hint: 'The point the speaker\'s head, or the style\'s icon, is centred on; without it none is drawn.', color: GUIDE_COLORS.face, fallback: height => ({ x: 16, y: Math.round(height / 2) }) },
    { key: 'colorXY', label: 'The colour layer (colorXY)', hint: 'Kept for the client; it draws chat_bubble_color at the bubble\'s corner whatever this says.', fallback: () => ({ x: 0, y: 0 }) },
    { key: 'emblemXY', label: 'The emblem (emblemXY)', hint: 'Where chat_bubble_emblem is drawn over the bubble.', color: GUIDE_COLORS.emblem, fallback: () => ({ x: 0, y: 0 }) },
    { key: 'emblemMultilineXY', label: 'The emblem on more lines (emblemMultilineXY)', hint: 'Where chat_bubble_emblem_multiline takes its place once the words wrap.', fallback: () => ({ x: 0, y: 0 }) },
];

const Legend = ({ color, children }: { color?: string; children: ReactNode }) => (
    <legend className="mb-2 flex items-center gap-1.5 text-xs font-semibold">
        {color && <span className="size-2.5 rounded-sm" style={{ backgroundColor: color }} />}
        {children}
    </legend>
);

const TextButton = ({ onClick, children }: { onClick: () => void; children: ReactNode }) => (
    <button type="button" onClick={onClick} className="shrink-0 text-accent hover:underline">{children}</button>
);

export const ShapeEditor = ({ regPoints, baseHeight, guides, onGuides, onChange }: { regPoints: ChatStyleRegPoints; baseHeight: number; guides: boolean; onGuides: (on: boolean) => void; onChange: (next: Partial<ChatStyleRegPoints>) => void }) => {
    const [ left, right ] = [ regPoints.pointerXMargins?.[0] ?? POINTER_MARGIN_LEFT, regPoints.pointerXMargins?.[1] ?? POINTER_MARGIN_RIGHT ];

    return (
        <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-muted">In the bubble bitmap's pixels. The coloured guides on the bubble follow them as you type.</span>
                <Button variant="secondary" icon={guides ? <EyeOff /> : <Eye />} onClick={() => onGuides(!guides)}>{guides ? 'Hide the guides' : 'Show the guides'}</Button>
            </div>
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                {RECTS.map((rect) => {
                    const value = regPoints[rect.key];

                    return (
                        <fieldset key={rect.key} className="flex flex-col gap-2">
                            <Legend color={rect.color}>{rect.label}</Legend>
                            {value
                                ? (
                                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                            {rect.sides.map(([ side, sideLabel ]) => (
                                                <Labeled key={side} label={sideLabel}>
                                                    <NumberInput value={value[side]} onChange={next => onChange({ [rect.key]: { ...value, [side]: next } })} />
                                                </Labeled>
                                            ))}
                                        </div>
                                    )
                                : <Button variant="secondary" className="self-start" onClick={() => onChange({ [rect.key]: { x: 0, y: 0, width: 0, height: 0 } })}>Give it one</Button>}
                            <span className="flex items-start justify-between gap-2 text-xs text-muted">
                                {rect.hint}
                                {rect.optional && value && <TextButton onClick={() => onChange({ [rect.key]: undefined })}>Leave it out</TextButton>}
                            </span>
                        </fieldset>
                    );
                })}
                <fieldset className="flex flex-col gap-2">
                    <Legend color={GUIDE_COLORS.pointer}>The pointer (pointerY, pointerXMargins)</Legend>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <Labeled label="Its top row">
                            <NumberInput value={regPoints.pointerY ?? 0} onChange={pointerY => onChange({ pointerY })} />
                        </Labeled>
                        <Labeled label="Left margin">
                            <NumberInput value={left} min={0} onChange={next => onChange({ pointerXMargins: [ Math.max(0, next), right ] })} />
                        </Labeled>
                        <Labeled label="Right margin">
                            <NumberInput value={right} min={0} onChange={next => onChange({ pointerXMargins: [ left, Math.max(0, next) ] })} />
                        </Labeled>
                    </div>
                    <span className="flex items-start justify-between gap-2 text-xs text-muted">
                        {`The row of the bubble bitmap the pointer's top sits on, and how close to the bubble's edges it may go (the client's ${POINTER_MARGIN_LEFT} and ${POINTER_MARGIN_RIGHT} unless set). In a room it sits at its left margin.`}
                        {regPoints.pointerXMargins && <TextButton onClick={() => onChange({ pointerXMargins: undefined })}>{`Back to ${POINTER_MARGIN_LEFT} and ${POINTER_MARGIN_RIGHT}`}</TextButton>}
                    </span>
                </fieldset>
                {POINTS.map((point) => {
                    const value = regPoints[point.key];

                    return (
                        <fieldset key={point.key} className="flex flex-col gap-2">
                            <Legend color={point.color}>{point.label}</Legend>
                            <div className="grid grid-cols-2 items-end gap-2 sm:grid-cols-4">
                                {value
                                    ? (
                                            <>
                                                {([ [ 'x', 'Across' ], [ 'y', 'Down' ] ] as const).map(([ axis, axisLabel ]) => (
                                                    <Labeled key={axis} label={axisLabel}>
                                                        <NumberInput value={value[axis]} onChange={next => onChange({ [point.key]: { ...value, [axis]: next } })} />
                                                    </Labeled>
                                                ))}
                                                <Button variant="secondary" className="col-span-2" onClick={() => onChange({ [point.key]: undefined })}>Leave it out</Button>
                                            </>
                                        )
                                    : <Button variant="secondary" className="col-span-2" onClick={() => onChange({ [point.key]: point.fallback(baseHeight) })}>Give it one</Button>}
                            </div>
                            <span className="text-xs text-muted">{point.hint}</span>
                        </fieldset>
                    );
                })}
                <fieldset className="flex flex-col gap-3">
                    <Legend>How it is drawn</Legend>
                    <Checkbox
                        label="Anonymous (anonymous)"
                        hint="No name before the words, no pointer, and the bubble cannot be clicked."
                        checked={!!regPoints.anonymous}
                        onChange={on => onChange({ anonymous: on || undefined })}
                    />
                    <Checkbox
                        label="Pixel-perfect nine-slice (usePixelPerfectNineSlice)"
                        hint="Sized in whole pixels and never smaller than its corners: crisp at any size."
                        checked={!!regPoints.usePixelPerfectNineSlice}
                        onChange={on => onChange({ usePixelPerfectNineSlice: on || undefined })}
                    />
                </fieldset>
            </div>
        </div>
    );
};

/* ---------------------------------------------------------------- bitmaps */

/** A picture picked or dropped, for one bitmap. */
const PictureDrop = ({ label, state, disabled, onPicture }: { label: string; state: string; disabled?: boolean; onPicture: (picture: File) => void }) => (
    <label
        className={cx('flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-dashed border-line px-3 py-2 text-xs text-muted transition-colors', disabled ? 'opacity-60' : 'cursor-pointer hover:border-accent/60 hover:text-ink')}
        onDragOver={event => event.preventDefault()}
        onDrop={(event) => {
            event.preventDefault();

            const picture = event.dataTransfer.files[0];

            if (picture && !disabled)
                onPicture(picture);
        }}
    >
        <Upload className="size-3.5 shrink-0" />
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <span className="shrink-0 font-mono text-[11px]">{state}</span>
        <input
            type="file"
            accept="image/png,image/gif,image/webp"
            className="sr-only"
            disabled={disabled}
            onChange={(event) => {
                const picture = event.target.files?.[0];

                if (picture)
                    onPicture(picture);

                event.target.value = '';
            }}
        />
    </label>
);

export const BitmapsEditor = ({ bitmaps, available, uploads, sizes, onPicture, onBitmaps }: {
    /** The bitmaps it will have. */
    bitmaps: ChatStyleFile[];
    /** The bitmaps the style it is drawn from has: one of them taken away may be put back. */
    available: ChatStyleFile[];
    uploads: Partial<Record<ChatStyleFile, string>>;
    /** The size of each it has, as drawn. */
    sizes: Partial<Record<ChatStyleFile, { width: number; height: number }>>;
    onPicture: (file: ChatStyleFile, picture: File) => void;
    onBitmaps: (next: ChatStyleFile[]) => void;
}) => (
    <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Its pictures</span>
        {BITMAP_FIELDS.map(({ file, label, optional }) => {
            const has = bitmaps.includes(file);
            const size = sizes[file];

            return (
                <div key={file} className={cx('flex items-center gap-2', !has && 'opacity-70')}>
                    <PictureDrop
                        label={label}
                        state={uploads[file] ? 'yours' : has && size ? `${size.width}x${size.height}` : has ? file : 'none'}
                        onPicture={(picture) => {
                            onPicture(file, picture);

                            if (!has)
                                onBitmaps([ ...bitmaps, file ]);
                        }}
                    />
                    {optional && (
                        <Checkbox
                            label="Has it"
                            checked={has}
                            disabled={!has && !uploads[file] && !available.includes(file)}
                            onChange={on => onBitmaps(on ? [ ...bitmaps, file ] : bitmaps.filter(x => x !== file))}
                        />
                    )}
                </div>
            );
        })}
        <p className="text-xs text-muted">The bubble keeps its shape when its pictures change: draw them the same size, or change its shape to fit.</p>
    </div>
);

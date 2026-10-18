import { ArrowLeft, ArrowRight, Plus, Save, Trash2, Undo2 } from 'lucide-react';
import { useMemo, useState } from 'react';

import { FIGURE_KINDS, type FigurePalette, usePalettes, useSaveFigureBatch } from '#/api/gamedata';
import { ask } from '#/components/confirm';
import { Badge, Button, EmptyState, ErrorNotice, Input, Labeled, Loading, Panel, Select, SuccessNotice, Switch } from '#/components/ui';
import { cx } from '#/lib/cx';

/** A colour as the editor holds it: its record's fields, and Habbo's when Habbo has it. */
interface Colour {
    id: number;
    club: number;
    selectable: boolean;
    hex: string;
    /** Habbo's colour as last taken in; null for the hotel's own. */
    habbo: { club: number; selectable: boolean; hex: string } | null;
}

const CLUB_NAMES = [ 'Everyone', 'Club members', 'Club members (VIP)' ];

const HEX = /^[0-9a-f]{6}$/i;

const parse = (data: string | null) => {
    if (!data)
        return null;

    try {
        return JSON.parse(data) as Record<string, unknown>;
    } catch {
        return null;
    }
};

/** A palette's colours as the editor holds them, in their order. */
const coloursOf = (palette: FigurePalette): Colour[] => palette.colors.map((entry) => {
    const record = parse(entry.data) ?? {};
    const habbo = parse(entry.habboData);

    return {
        id: Number(record.id),
        club: Number(record.club ?? 0),
        selectable: record.selectable === true,
        hex: String(record.hex ?? '000000').toUpperCase(),
        habbo: habbo && { club: Number(habbo.club ?? 0), selectable: habbo.selectable === true, hex: String(habbo.hex ?? '').toUpperCase() },
    };
});

/** A colour's record as the server takes it: its place in the palette is its index. */
const recordOf = (palette: number, colour: Colour, index: number) => ({ palette, id: colour.id, index, club: colour.club, selectable: colour.selectable, hex: colour.hex });

const same = (a: Colour, b: Colour) => a.id === b.id && a.club === b.club && a.selectable === b.selectable && a.hex === b.hex;

const differsFromHabbo = (colour: Colour) => colour.habbo !== null && (colour.habbo.hex !== colour.hex || colour.habbo.club !== colour.club || colour.habbo.selectable !== colour.selectable);

/** One colour in the grid: its swatch, marked when it is for the club, hidden, new or changed from Habbo's. */
const Swatch = ({ colour, selected, isNew, onSelect, draggable, onDragStart, onDragOver, onDrop, dropping }: {
    colour: Colour;
    selected: boolean;
    isNew: boolean;
    onSelect: () => void;
    draggable: boolean;
    onDragStart: () => void;
    onDragOver: () => void;
    onDrop: () => void;
    dropping: boolean;
}) => (
    <button
        type="button"
        title={`#${colour.hex} · id ${colour.id}${colour.club ? ` · ${CLUB_NAMES[colour.club]}` : ''}${colour.selectable ? '' : ' · hidden'}`}
        aria-label={`Colour ${colour.hex}, id ${colour.id}`}
        aria-pressed={selected}
        onClick={onSelect}
        draggable={draggable}
        onDragStart={(event) => {
            event.dataTransfer.effectAllowed = 'move';
            onDragStart();
        }}
        onDragOver={(event) => {
            event.preventDefault();
            onDragOver();
        }}
        onDrop={(event) => {
            event.preventDefault();
            onDrop();
        }}
        className={cx(
            'relative aspect-square w-full rounded-lg border transition-[box-shadow,transform] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
            selected ? 'border-transparent shadow-[0_0_0_2px_var(--color-surface),0_0_0_4px_var(--color-accent)]' : 'border-black/15 hover:scale-105',
            dropping && 'shadow-[-4px_0_0_0_var(--color-accent)]',
            draggable && 'cursor-grab active:cursor-grabbing',
        )}
        style={{ background: `#${colour.hex}` }}
    >
        {!colour.selectable && <span aria-hidden className="absolute inset-0 rounded-lg bg-[repeating-linear-gradient(135deg,transparent_0_4px,rgb(0_0_0/0.35)_4px_6px)]" />}
        {colour.club > 0 && <span className="absolute -top-1.5 -right-1.5 rounded bg-accent px-1 font-mono text-[9px] leading-[14px] font-bold text-on-accent">HC</span>}
        {(isNew || differsFromHabbo(colour)) && <span aria-hidden className={cx('absolute -bottom-1 -left-1 size-2.5 rounded-full border-2 border-surface', isNew ? 'bg-good' : 'bg-warn')} />}
    </button>
);

/** The colour picked: its hex, who may use it, whether the editor offers it, and its place. */
const Inspector = ({ colour, index, count, canManage, onChange, onMove, onRemove }: {
    colour: Colour;
    index: number;
    count: number;
    canManage: boolean;
    onChange: (colour: Colour) => void;
    onMove: (to: number) => void;
    onRemove: () => void;
}) => {
    // What is typed while it isn't six hex digits yet; the colour's own hex otherwise.
    const [ typed, setTyped ] = useState<string | null>(null);
    const hex = typed ?? colour.hex;

    const setHexText = (text: string) => {
        const clean = text.replace(/^#/, '').toUpperCase();

        if (HEX.test(clean)) {
            setTyped(null);
            onChange({ ...colour, hex: clean });
        } else {
            setTyped(clean);
        }
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
                <span className="size-14 shrink-0 rounded-xl border border-black/15" style={{ background: `#${colour.hex}` }} />
                <div className="min-w-0">
                    <div className="font-mono text-lg font-semibold">#{colour.hex}</div>
                    <div className="font-mono text-[11px] text-muted">id {colour.id} · {index + 1} of {count}</div>
                </div>
            </div>
            <div className="grid grid-cols-[2.75rem_1fr] items-end gap-2">
                <input
                    type="color"
                    value={`#${colour.hex}`}
                    onChange={event => setHexText(event.target.value)}
                    disabled={!canManage}
                    aria-label="Pick a colour"
                    className="h-10 w-11 cursor-pointer rounded-lg border border-line bg-canvas p-1 sm:h-8"
                />
                <Labeled label="Hex">
                    <Input value={hex} onChange={event => setHexText(event.target.value)} maxLength={7} disabled={!canManage} className={cx('w-full font-mono uppercase', !HEX.test(hex) && 'border-bad')} />
                </Labeled>
            </div>
            <Labeled label="Who may use it">
                <Select value={colour.club} onChange={event => onChange({ ...colour, club: Number(event.target.value) })} disabled={!canManage}>
                    {CLUB_NAMES.map((name, level) => <option key={level} value={level}>{name}</option>)}
                </Select>
            </Labeled>
            <Switch label="Offered in the editor" hint="A hidden colour stays on anyone already wearing it." checked={colour.selectable} onChange={selectable => onChange({ ...colour, selectable })} disabled={!canManage} />
            {colour.habbo && differsFromHabbo(colour) && (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-warn-line bg-warn-soft px-3 py-2 text-xs text-warn">
                    <span className="size-3 rounded border border-black/15" style={{ background: `#${colour.habbo.hex}` }} />
                    <span>Habbo: #{colour.habbo.hex}, {CLUB_NAMES[colour.habbo.club]?.toLowerCase()}{colour.habbo.selectable ? '' : ', hidden'}</span>
                    {canManage && <button type="button" className="ml-auto font-medium text-accent hover:underline" onClick={() => onChange({ ...colour, ...colour.habbo! })}>Use Habbo's</button>}
                </div>
            )}
            {canManage && (
                <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
                    <Button variant="secondary" icon={<ArrowLeft />} disabled={index === 0} onClick={() => onMove(index - 1)} aria-label="Move earlier" title="Move earlier" />
                    <Button variant="secondary" icon={<ArrowRight />} disabled={index === count - 1} onClick={() => onMove(index + 1)} aria-label="Move later" title="Move later" />
                    <Button variant="ghost" icon={<Trash2 />} className="ml-auto text-bad hover:text-bad" onClick={onRemove}>Remove</Button>
                </div>
            )}
        </div>
    );
};

/**
 * The palettes clothing is coloured from: pick one, and its colours are a grid in the order the
 * avatar editor offers them - dragged into another order, picked to change, added and removed.
 * Nothing is written until the palette is saved, and then as one change set.
 */
export const PaletteEditor = ({ canManage }: { canManage: boolean }) => {
    const { data: palettes, error } = usePalettes();
    const save = useSaveFigureBatch();
    const [ paletteId, setPaletteId ] = useState<number | null>(null);
    const [ added, setAdded ] = useState<number[]>([]);
    const [ draft, setDraft ] = useState<Colour[] | null>(null);
    const [ selected, setSelected ] = useState(0);
    const [ dragged, setDragged ] = useState<number | null>(null);
    const [ over, setOver ] = useState<number | null>(null);

    // The palettes there are, and any added here that have no colours saved yet.
    const ids = useMemo(() => [ ...new Set([ ...(palettes ?? []).map(x => x.id), ...added ]) ].sort((a, b) => a - b), [ palettes, added ]);
    const current = paletteId ?? ids[0] ?? null;
    const palette = palettes?.find(x => x.id === current);
    const original = useMemo(() => (palette ? coloursOf(palette) : []), [ palette ]);
    const colours = draft ?? original;
    const removed = original.filter(x => !colours.some(c => c.id === x.id));
    const dirty = colours.length !== original.length || colours.some((colour, index) => !original[index] || !same(colour, original[index]));
    const nextId = Math.max(0, ...(palettes ?? []).flatMap(p => coloursOf(p).map(c => c.id)), ...colours.map(c => c.id)) + 1;
    const pick = colours[Math.min(selected, colours.length - 1)];
    const kept = colours.filter(x => original.some(o => o.id === x.id));
    const pending = [
        colours.length - kept.length > 0 && `${colours.length - kept.length} added`,
        removed.length > 0 && `${removed.length} removed`,
        kept.some(x => !same(x, original.find(o => o.id === x.id)!)) && `${kept.filter(x => !same(x, original.find(o => o.id === x.id)!)).length} changed`,
        kept.map(x => x.id).join() !== original.filter(o => kept.some(x => x.id === o.id)).map(x => x.id).join() && 'new order',
    ].filter((x): x is string => typeof x === 'string');

    const choose = (id: number) => {
        const go = () => {
            setPaletteId(id);
            setDraft(null);
            setSelected(0);
            save.reset();
        };

        if (dirty)
            ask({ title: 'Leave this palette?', body: 'Its unsaved changes are lost.', confirm: 'Leave', danger: true }, go);
        else
            go();
    };

    const edit = (next: Colour[]) => setDraft(next);

    const move = (from: number, to: number) => {
        if (from === to || to < 0 || to >= colours.length)
            return;

        const next = [ ...colours ];
        const [ colour ] = next.splice(from, 1);

        next.splice(to, 0, colour!);
        edit(next);
        setSelected(to);
    };

    const addColour = () => {
        const base = pick ?? { id: 0, club: 0, selectable: true, hex: 'FFFFFF', habbo: null };
        const next = [ ...colours ];
        const at = pick ? Math.min(selected, colours.length - 1) + 1 : colours.length;

        next.splice(at, 0, { id: nextId, club: base.club, selectable: true, hex: base.hex, habbo: null });
        edit(next);
        setSelected(at);
    };

    const addPalette = () => {
        const id = Math.max(0, ...ids) + 1;
        const go = () => {
            setAdded([ ...added, id ]);
            setPaletteId(id);
            setDraft([]);
            setSelected(0);
        };

        if (dirty)
            ask({ title: 'Start a new palette?', body: 'This one\'s unsaved changes are lost.', confirm: 'Start new', danger: true }, go);
        else
            go();
    };

    const commit = () => {
        if (current === null)
            return;

        const records = colours.map((colour, index) => recordOf(current, colour, index));
        const before = new Map(original.map((colour, index) => [ colour.id, JSON.stringify(recordOf(current, colour, index)) ]));
        const changed = records.filter(record => before.get(record.id) !== JSON.stringify(record));
        const newCount = colours.filter(x => !original.some(o => o.id === x.id)).length;
        const parts = [
            newCount && `${newCount} added`,
            removed.length && `${removed.length} removed`,
            changed.length - newCount > 0 && `${changed.length - newCount} changed`,
        ].filter(Boolean);

        save.mutate({
            kind: FIGURE_KINDS.color,
            save: changed.map(record => JSON.stringify(record)),
            delete: removed.map(colour => `${current}/${colour.id}`),
            summary: `Edited palette ${current}: ${parts.join(', ') || 'reordered'}`,
        }, { onSuccess: () => setDraft(null) });
    };

    if (error)
        return <ErrorNotice error={error} />;

    if (!palettes)
        return <Panel><Loading /></Panel>;

    const usedBy = palette?.usedBy ?? [];

    return (
        <div className="grid items-start gap-4 lg:grid-cols-[14rem_1fr]">
            <Panel className="overflow-clip">
                <ul className="divide-y divide-line">
                    {ids.map((id) => {
                        const of = palettes.find(x => x.id === id);
                        const preview = of ? coloursOf(of).slice(0, 8) : [];

                        return (
                            <li key={id}>
                                <button
                                    type="button"
                                    onClick={() => choose(id)}
                                    className={cx('flex w-full flex-col gap-1.5 px-4 py-3 text-left hover:bg-subtle/60', current === id && 'bg-subtle shadow-[inset_2px_0_0_var(--color-accent)]')}
                                >
                                    <span className="flex items-center justify-between gap-2 text-sm">
                                        <span className="font-medium">Palette {id}</span>
                                        <span className="font-mono text-[11px] text-muted">{of ? of.colors.length : 0}</span>
                                    </span>
                                    <span className="flex h-3 overflow-hidden rounded">
                                        {preview.length ? preview.map(c => <span key={c.id} className="flex-1" style={{ background: `#${c.hex}` }} />) : <span className="flex-1 bg-line" />}
                                    </span>
                                    <span className="truncate font-mono text-[11px] text-muted">{of?.usedBy.length ? of.usedBy.join(' ') : 'no clothing uses it'}</span>
                                </button>
                            </li>
                        );
                    })}
                </ul>
                {canManage && (
                    <div className="border-t border-line p-3">
                        <Button variant="secondary" icon={<Plus />} className="w-full" onClick={addPalette}>New palette</Button>
                    </div>
                )}
            </Panel>

            {current === null
                ? <Panel><EmptyState>No palettes yet: take Habbo’s figure data in above, or start a new one.</EmptyState></Panel>
                : (
                        <Panel
                            className="overflow-clip"
                            title={`Palette ${current}`}
                            description={(
                                <span className="flex flex-wrap items-center gap-1.5">
                                    <span>{colours.length} colours</span>
                                    {usedBy.length > 0 ? <span>· colours {usedBy.map(type => <Badge key={type} className="ml-1">{type}</Badge>)}</span> : <span>· no clothing uses it yet: set a kind's palette to {current} under Kinds</span>}
                                </span>
                            )}
                            actions={canManage && <Button variant="secondary" icon={<Plus />} onClick={addColour}>Add colour</Button>}
                        >
                            <div className="grid lg:grid-cols-[1fr_17rem]">
                                <div className="p-4">
                                    {colours.length === 0
                                        ? <EmptyState>No colours yet. Add one to start the palette.</EmptyState>
                                        : (
                                                <div
                                                    className="grid grid-cols-[repeat(auto-fill,minmax(2.5rem,1fr))] gap-2.5"
                                                    onDragEnd={() => {
                                                        setDragged(null);
                                                        setOver(null);
                                                    }}
                                                >
                                                    {colours.map((colour, index) => (
                                                        <Swatch
                                                            key={colour.id}
                                                            colour={colour}
                                                            selected={pick?.id === colour.id}
                                                            isNew={!original.some(x => x.id === colour.id)}
                                                            onSelect={() => setSelected(index)}
                                                            draggable={canManage}
                                                            onDragStart={() => setDragged(index)}
                                                            onDragOver={() => setOver(index)}
                                                            onDrop={() => {
                                                                if (dragged !== null)
                                                                    move(dragged, dragged < index ? index - 1 : index);

                                                                setDragged(null);
                                                                setOver(null);
                                                            }}
                                                            dropping={dragged !== null && over === index && dragged !== index}
                                                        />
                                                    ))}
                                                </div>
                                            )}
                                    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted">
                                        <span className="flex items-center gap-1.5"><span className="rounded bg-accent px-1 font-mono text-[9px] leading-[14px] font-bold text-on-accent">HC</span> club only</span>
                                        <span className="flex items-center gap-1.5"><span className="size-3 rounded bg-[repeating-linear-gradient(135deg,var(--color-line)_0_3px,transparent_3px_5px)]" /> hidden</span>
                                        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-warn" /> changed from Habbo's</span>
                                        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-good" /> new</span>
                                        {canManage && <span>Drag to reorder. The avatar editor lists everyone's colours before club ones.</span>}
                                    </div>
                                </div>
                                <aside className="border-t border-line p-4 lg:border-t-0 lg:border-l">
                                    {pick
                                        ? (
                                                <Inspector
                                                    key={pick.id}
                                                    colour={pick}
                                                    index={colours.indexOf(pick)}
                                                    count={colours.length}
                                                    canManage={canManage}
                                                    onChange={colour => edit(colours.map(x => (x.id === colour.id ? colour : x)))}
                                                    onMove={to => move(colours.indexOf(pick), to)}
                                                    onRemove={() => {
                                                        edit(colours.filter(x => x.id !== pick.id));
                                                        setSelected(Math.max(0, colours.indexOf(pick) - 1));
                                                    }}
                                                />
                                            )
                                        : <p className="text-sm text-muted">Pick a colour to change it.</p>}
                                </aside>
                            </div>
                            {(save.error || (save.isSuccess && !dirty)) && (
                                <div className="border-t border-line p-4">
                                    {save.error && <ErrorNotice error={save.error} />}
                                    {save.isSuccess && !dirty && <SuccessNotice>Saved. Figures are checked against it at once, and the client gets it with the next figure data it loads.</SuccessNotice>}
                                </div>
                            )}
                            {canManage && dirty && (
                                <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur">
                                    <span className="text-sm text-muted">Unsaved: {pending.join(', ')}</span>
                                    <div className="flex gap-2">
                                        <Button variant="ghost" icon={<Undo2 />} onClick={() => setDraft(null)}>Discard</Button>
                                        <Button icon={<Save />} disabled={save.isPending || colours.some(x => !HEX.test(x.hex))} onClick={commit}>Save palette</Button>
                                    </div>
                                </div>
                            )}
                        </Panel>
                    )}
        </div>
    );
};

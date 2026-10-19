import { Braces, Plus, Save, Trash2, Undo2, X } from 'lucide-react';
import { type ReactNode, useMemo, useState } from 'react';

import { FIGURE_KINDS, type FigureEntry, type FigureKindEntry, useDeleteFigure, useFigureKinds, useFigureSearch, usePalettes, useSaveFigure } from '#/api/gamedata';
import { ask } from '#/components/confirm';
import { ListToolbar } from '#/components/ListToolbar';
import { SearchInput } from '#/components/SearchInput';
import { Badge, Button, EmptyState, ErrorNotice, IconButton, Input, Labeled, Loading, Panel, Segmented, Select, Switch, Textarea } from '#/components/ui';
import { cx } from '#/lib/cx';
import { useFillHeight } from '#/lib/fillHeight';

import { HabboDiffers, OpenRow } from './parts';

/** What each of Habbo's kinds of clothing is, as the avatar editor groups them. */
const KIND_LABELS: Record<string, string> = {
    hr: 'Hair',
    hd: 'Face & skin',
    ch: 'Shirts',
    lg: 'Trousers',
    sh: 'Shoes',
    ha: 'Hats',
    he: 'Hair accessories',
    ea: 'Glasses',
    fa: 'Face accessories',
    ca: 'Chest accessories',
    wa: 'Belts',
    cc: 'Jackets',
    cp: 'Chest prints',
};

const labelOf = (type: string) => KIND_LABELS[type] ?? type.toUpperCase();

const GENDERS = [ { value: 'U', label: 'Anyone' }, { value: 'M', label: 'Men' }, { value: 'F', label: 'Women' } ];

const CLUBS = [ { value: '0', label: 'Everyone' }, { value: '1', label: 'Club' }, { value: '2', label: 'VIP' } ];

/** The pieces shown, by who may wear them; each a field as the piece's JSON writes it. */
const ACCESS_FILTERS: Record<string, { label: string; has: string[] }> = {
    all: { label: 'Any access', has: [] },
    everyone: { label: 'Everyone', has: [ '"club":0', '"sellable":false' ] },
    club: { label: 'Club only', has: [ '"club":1|"club":2' ] },
    sold: { label: 'Sold', has: [ '"sellable":true' ] },
    hidden: { label: 'Hidden', has: [ '"selectable":false' ] },
};

const GENDER_FILTERS: Record<string, { label: string; has: string[] }> = {
    all: { label: 'Any gender', has: [] },
    M: { label: 'Men', has: [ '"gender":"M"' ] },
    F: { label: 'Women', has: [ '"gender":"F"' ] },
    U: { label: 'Anyone', has: [ '"gender":"U"' ] },
};

interface Part {
    id: number;
    type: string;
    colorable: boolean;
    index: number;
    colorindex: number;
    palettemapid?: number;
    breed?: number;
}

/** A piece's fields, by the names Habbo's file gives them. */
interface Piece {
    id: number;
    type: string;
    gender: string;
    club: number;
    colorable: boolean;
    selectable: boolean;
    preselectable: boolean;
    sellable: boolean;
    parts: Part[];
    hiddenlayers: string[];
}

/** A kind's fields. */
interface Kind {
    type: string;
    paletteid: number;
    mand_m_0: boolean;
    mand_f_0: boolean;
    mand_m_1: boolean;
    mand_f_1: boolean;
}

/** A record's JSON as its fields; null when it has none or doesn't read. */
function read<T>(data: string | null): T | null {
    if (!data)
        return null;

    try {
        return JSON.parse(data) as T;
    } catch {
        return null;
    }
}

const MUST_WEAR: { field: keyof Kind; label: string }[] = [
    { field: 'mand_m_0', label: 'Men' },
    { field: 'mand_f_0', label: 'Women' },
    { field: 'mand_m_1', label: 'Club men' },
    { field: 'mand_f_1', label: 'Club women' },
];

/** The palette a kind of clothing is coloured from, picked from those there are, shown by its colours. */
const PalettePicker = ({ value, onChange, disabled }: { value: number; onChange: (id: number) => void; disabled: boolean }) => {
    const { data: palettes } = usePalettes();
    const chosen = palettes?.find(x => x.id === value);

    return (
        <div className="flex flex-col gap-1.5">
            <Labeled label="Coloured from">
                <Select value={value} onChange={event => onChange(Number(event.target.value))} disabled={disabled}>
                    {!chosen && <option value={value}>Palette {value} (has no colours)</option>}
                    {palettes?.map(x => <option key={x.id} value={x.id}>Palette {x.id} · {x.colors.length} colours</option>)}
                </Select>
            </Labeled>
            <span className="flex h-2.5 overflow-hidden rounded">
                {chosen?.colors.length
                    ? chosen.colors.slice(0, 24).map(entry => <span key={entry.key} className="flex-1" style={{ background: `#${read<{ hex?: string }>(entry.data)?.hex ?? '000000'}` }} />)
                    : <span className="flex-1 bg-line" />}
            </span>
        </div>
    );
};

/** Toggle chips: each on or off, all in sight. */
const Chip = ({ on, onChange, disabled, children }: { on: boolean; onChange: (on: boolean) => void; disabled: boolean; children: string }) => (
    <button
        type="button"
        aria-pressed={on}
        disabled={disabled}
        onClick={() => onChange(!on)}
        className={cx(
            'h-10 rounded-lg border px-3 text-[13px] font-medium transition-colors disabled:opacity-60 sm:h-8',
            on ? 'border-accent/50 bg-accent-soft text-accent' : 'border-line text-muted hover:text-ink',
        )}
    >
        {children}
    </button>
);

/** A kind's own settings: the palette its pieces are coloured from, and who must always wear one. */
const KindSettings = ({ kind, pieces, canManage, onRemoved }: { kind: FigureEntry; pieces: number; canManage: boolean; onRemoved: () => void }) => {
    const original = useMemo(() => read<Kind>(kind.data)!, [ kind.data ]);
    const habbo = useMemo(() => read<Kind>(kind.habboData), [ kind.habboData ]);
    const [ draft, setDraft ] = useState<Kind>(original);
    const save = useSaveFigure();
    const remove = useDeleteFigure();
    const dirty = JSON.stringify(draft) !== JSON.stringify(original);
    const habboDiffers = habbo !== null && JSON.stringify(habbo) !== JSON.stringify(draft);

    return (
        <Panel
            title={(
                <span className="flex items-baseline gap-2">
                    <span className="text-base">{labelOf(kind.key)}</span>
                    <span className="font-mono text-xs font-normal text-muted">{kind.key}</span>
                </span>
            )}
            description={`${pieces.toLocaleString()} ${pieces === 1 ? 'piece' : 'pieces'}${kind.fromHabbo ? '' : ' · the hotel\'s own kind'}`}
            actions={canManage && (
                <>
                    {dirty && <Button variant="ghost" icon={<Undo2 />} onClick={() => setDraft(original)}>Discard</Button>}
                    {dirty && <Button icon={<Save />} disabled={save.isPending} onClick={() => save.mutate({ kind: FIGURE_KINDS.setType, data: JSON.stringify(draft) })}>Save</Button>}
                    {!dirty && (
                        <IconButton
                            label="Remove this kind"
                            tone="bad"
                            icon={<Trash2 />}
                            disabled={remove.isPending}
                            onClick={() => ask(
                                {
                                    title: `Remove the kind ${kind.key}?`,
                                    body: pieces ? `Its ${pieces} pieces stay, but the client can't draw them without it.` : undefined,
                                    confirm: 'Remove',
                                },
                                () => remove.mutate({ kind: FIGURE_KINDS.setType, key: kind.key }, { onSuccess: onRemoved }),
                            )}
                        />
                    )}
                </>
            )}
        >
            <div className="grid gap-5 p-4 sm:grid-cols-[minmax(12rem,16rem)_1fr]">
                <PalettePicker value={draft.paletteid} onChange={paletteid => setDraft({ ...draft, paletteid })} disabled={!canManage} />
                <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-muted">Always worn by</span>
                    <div className="flex flex-wrap gap-2">
                        {MUST_WEAR.map(({ field, label }) => (
                            <Chip key={field} on={draft[field] === true} onChange={on => setDraft({ ...draft, [field]: on })} disabled={!canManage}>{label}</Chip>
                        ))}
                    </div>
                    <span className="text-xs text-muted">A figure without one gets the first piece its wearer may have.</span>
                </div>
            </div>
            {(habboDiffers || save.error || remove.error) && (
                <div className="flex flex-col gap-2 border-t border-line px-4 py-3">
                    {habbo && habboDiffers && <HabboDiffers habbo={`palette ${habbo.paletteid}, always worn by ${MUST_WEAR.filter(x => habbo[x.field]).map(x => x.label.toLowerCase()).join(', ') || 'nobody'}`} canManage={canManage} onUse={() => setDraft(habbo)} />}
                    {(save.error || remove.error) && <ErrorNotice error={save.error ?? remove.error} />}
                </div>
            )}
        </Panel>
    );
};

/** A piece in one line: what it is, who may wear it, its parts and colours. */
const PieceSummary = ({ entry }: { entry: FigureEntry }) => {
    const piece = read<Piece>(entry.data);
    const habbo = read<Piece>(entry.habboData);

    if (!piece)
        return <span className="font-mono text-[13px]">{entry.group}-{entry.key}</span>;

    const types = [ ...new Set(piece.parts.map(x => x.type)) ];
    const layers = Math.max(0, ...piece.parts.map(x => x.colorindex));

    return (
        <div className="grid items-center gap-x-4 gap-y-1 sm:grid-cols-[7rem_4.5rem_minmax(9rem,1fr)_minmax(8rem,1.2fr)_5.5rem]">
            <span className="font-mono text-[13px] font-medium">{entry.group}-{entry.key}</span>
            <span className="text-xs text-muted">{GENDERS.find(x => x.value === piece.gender)?.label ?? piece.gender}</span>
            <span className="flex flex-wrap gap-1">
                {piece.club > 0 && <Badge tone="accent">{piece.club === 2 ? 'vip' : 'club'}</Badge>}
                {piece.sellable && <Badge tone="amber">sold</Badge>}
                {!piece.selectable && <Badge>hidden</Badge>}
                {!entry.fromHabbo && <Badge tone="green">hotel's own</Badge>}
                {habbo && JSON.stringify(habbo) !== JSON.stringify(piece) && <Badge tone="amber">changed</Badge>}
            </span>
            <span className="truncate font-mono text-[11px] text-muted max-sm:hidden" title={types.join(' ')}>{types.join(' ')}</span>
            <span className="font-mono text-[11px] text-muted max-sm:hidden">{piece.colorable && layers > 0 ? `${layers} ${layers === 1 ? 'colour' : 'colours'}` : 'no colour'}</span>
        </div>
    );
};

/** The columns of a part's row, from `sm` up: asset id, part, layer, colour, and removing it. */
const PART_COLUMNS = 'sm:grid-cols-[6rem_5rem_4rem_minmax(9rem,1fr)_2rem]';

/** A field of a part's row: named above it on a phone, where the column headings aren't shown. */
const PartField = ({ label, children, className }: { label: string; children: ReactNode; className?: string }) => (
    <label className={cx('flex min-w-0 flex-col gap-1', className)}>
        <span className="text-xs font-medium text-muted sm:sr-only">{label}</span>
        {children}
    </label>
);

/**
 * A piece's parts, one row each: the asset it draws, on which layer, in which of its colours. A
 * compact grid under column headings from `sm` up; on a phone each part is a small card of its own.
 */
const PartsTable = ({ parts, onChange, disabled }: { parts: Part[]; onChange: (parts: Part[]) => void; disabled: boolean }) => {
    const set = (index: number, part: Part) => onChange(parts.map((x, i) => (i === index ? part : x)));
    const removeButton = (index: number) => !disabled && <IconButton label="Remove part" icon={<X />} onClick={() => onChange(parts.filter((_, i) => i !== index))} />;

    return (
        <div className="rounded-lg border border-line">
            <div aria-hidden className={cx('grid gap-x-3 px-3 py-2 font-mono text-[11px] font-medium tracking-[0.08em] text-muted uppercase max-sm:hidden', PART_COLUMNS)}>
                <span>Asset id</span>
                <span>Part</span>
                <span>Layer</span>
                <span>Coloured by</span>
            </div>
            <ul className="divide-y divide-line sm:border-t sm:border-line">
                {parts.map((part, index) => (
                    <li key={index} className={cx('grid grid-cols-3 gap-x-3 gap-y-2 p-3 sm:items-center sm:px-3 sm:py-1.5', PART_COLUMNS)}>
                        <div className="col-span-3 flex items-center justify-between sm:hidden">
                            <span className="text-xs font-semibold">Part {index + 1}</span>
                            {removeButton(index)}
                        </div>
                        <PartField label="Asset id">
                            <Input value={part.id} onChange={event => set(index, { ...part, id: Number(event.target.value) || 0 })} inputMode="numeric" disabled={disabled} className="w-full font-mono" />
                        </PartField>
                        <PartField label="Part">
                            <Input value={part.type} onChange={event => set(index, { ...part, type: event.target.value.toLowerCase() })} disabled={disabled} className="w-full font-mono" />
                        </PartField>
                        <PartField label="Layer">
                            <Input value={part.index} onChange={event => set(index, { ...part, index: Number(event.target.value) || 0 })} inputMode="numeric" disabled={disabled} className="w-full font-mono" />
                        </PartField>
                        <PartField label="Coloured by" className="col-span-3 sm:col-span-1">
                            <Select
                                value={part.colorable ? part.colorindex : 0}
                                onChange={(event) => {
                                    const colorindex = Number(event.target.value);

                                    set(index, { ...part, colorindex, colorable: colorindex > 0 });
                                }}
                                disabled={disabled}
                            >
                                <option value={0}>Not coloured</option>
                                <option value={1}>First colour</option>
                                <option value={2}>Second colour</option>
                                <option value={3}>Third colour</option>
                            </Select>
                        </PartField>
                        <div className="text-right max-sm:hidden">{removeButton(index)}</div>
                    </li>
                ))}
            </ul>
            {!disabled && (
                <div className="border-t border-line p-2">
                    <Button
                        variant="ghost"
                        icon={<Plus />}
                        onClick={() => onChange([ ...parts, parts.length ? { ...parts[parts.length - 1]! } : { id: 0, type: 'ch', colorable: true, index: 0, colorindex: 1 } ])}
                    >
                        Add part
                    </Button>
                </div>
            )}
        </div>
    );
};

/** The part types a piece hides on the avatar while worn, as chips. */
const HiddenLayers = ({ layers, onChange, disabled }: { layers: string[]; onChange: (layers: string[]) => void; disabled: boolean }) => {
    const [ text, setText ] = useState('');
    const add = () => {
        const type = text.trim().toLowerCase();

        if (/^[a-z0-9]{1,8}$/.test(type) && !layers.includes(type))
            onChange([ ...layers, type ]);

        setText('');
    };

    return (
        <div className="flex flex-wrap items-center gap-1.5">
            {layers.length === 0 && disabled && <span className="text-sm text-muted">None.</span>}
            {layers.map(layer => (
                <span key={layer} className="inline-flex h-8 items-center gap-1 rounded-md border border-line bg-canvas pr-1 pl-2.5 font-mono text-xs">
                    {layer}
                    {!disabled && (
                        <button type="button" aria-label={`Stop hiding ${layer}`} className="grid size-5 place-items-center rounded text-muted hover:bg-subtle hover:text-ink [&>svg]:size-3.5" onClick={() => onChange(layers.filter(x => x !== layer))}>
                            <X />
                        </button>
                    )}
                </span>
            ))}
            {!disabled && (
                <Input
                    value={text}
                    onChange={event => setText(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                            event.preventDefault();
                            add();
                        }
                    }}
                    onBlur={add}
                    placeholder="add a part type"
                    className="h-8 w-36 font-mono text-xs sm:h-8"
                    aria-label="Hide a part type"
                />
            )}
        </div>
    );
};

/** A piece to change - or, with none, one of the hotel's own to add. */
const PieceEditor = ({ entry, type, nextId, canManage, onDone }: { entry: FigureEntry | null; type: string; nextId: number; canManage: boolean; onDone: () => void }) => {
    const original = useMemo<Piece>(
        () => (entry && read<Piece>(entry.data)) || { id: nextId, type, gender: 'U', club: 0, colorable: true, selectable: true, preselectable: false, sellable: false, parts: [ { id: nextId, type, colorable: true, index: 0, colorindex: 1 } ], hiddenlayers: [] },
        [ entry, nextId, type ],
    );
    const habbo = useMemo(() => (entry ? read<Piece>(entry.habboData) : null), [ entry ]);
    const [ piece, setPiece ] = useState<Piece>(original);
    const [ json, setJson ] = useState<string | null>(null);
    const save = useSaveFigure();
    const remove = useDeleteFigure();
    const text = JSON.stringify(piece);
    const changed = !entry || text !== JSON.stringify(original);
    const jsonError = json !== null && read<Piece>(json) === null;
    const disabled = !canManage;
    const set = (next: Partial<Piece>) => setPiece({ ...piece, ...next });

    return (
        <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
                {!entry && (
                    <Labeled label="Id" hint="Free in every kind.">
                        <Input value={piece.id} onChange={event => set({ id: Number(event.target.value) || 0 })} inputMode="numeric" className="w-28 font-mono" />
                    </Labeled>
                )}
                <div className="flex flex-col gap-1.5 max-sm:w-full">
                    <span className="text-xs font-medium text-muted">For</span>
                    <div className="w-full sm:w-60"><Segmented label="For" value={piece.gender} onChange={gender => set({ gender })} options={GENDERS} disabled={disabled} /></div>
                </div>
                <div className="flex flex-col gap-1.5 max-sm:w-full">
                    <span className="text-xs font-medium text-muted">Who may wear it</span>
                    <div className="w-full sm:w-60"><Segmented label="Who may wear it" value={String(piece.club)} onChange={club => set({ club: Number(club) })} options={CLUBS} disabled={disabled} /></div>
                </div>
            </div>
            <div className="grid gap-x-8 sm:grid-cols-2 lg:max-w-3xl">
                <Switch label="Offered in the editor" hint="A hidden piece can still be given." checked={piece.selectable} onChange={selectable => set({ selectable })} disabled={disabled} />
                <Switch label="Sold" hint="Worn only by players who own it." checked={piece.sellable} onChange={sellable => set({ sellable })} disabled={disabled} />
                <Switch label="Given to new looks" checked={piece.preselectable} onChange={preselectable => set({ preselectable })} disabled={disabled} />
                <Switch label="Takes colours" checked={piece.colorable} onChange={colorable => set({ colorable })} disabled={disabled} />
            </div>
            <div className="flex flex-col gap-2">
                <span className="text-xs font-medium text-muted">Parts</span>
                <PartsTable parts={piece.parts} onChange={parts => set({ parts })} disabled={disabled} />
            </div>
            <div className="flex flex-col gap-2">
                <span className="text-xs font-medium text-muted">Hides while worn</span>
                <HiddenLayers layers={piece.hiddenlayers} onChange={hiddenlayers => set({ hiddenlayers })} disabled={disabled} />
            </div>
            {json !== null && (
                <Labeled label="Every field, as JSON">
                    <Textarea
                        value={json}
                        onChange={(event) => {
                            setJson(event.target.value);

                            const parsed = read<Piece>(event.target.value);

                            if (parsed)
                                setPiece(parsed);
                        }}
                        rows={10}
                        spellCheck={false}
                        disabled={disabled}
                        className={cx('w-full font-mono text-xs', jsonError && 'border-bad')}
                    />
                </Labeled>
            )}
            {habbo && JSON.stringify(habbo) !== text && <HabboDiffers habbo="this piece is set differently" canManage={canManage} onUse={() => setPiece(habbo)} />}
            <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
                {canManage && (
                    <Button icon={entry ? <Save /> : <Plus />} disabled={!changed || jsonError || save.isPending} onClick={() => save.mutate({ kind: FIGURE_KINDS.set, data: text }, { onSuccess: onDone })}>
                        {entry ? 'Save' : 'Add piece'}
                    </Button>
                )}
                <Button variant="ghost" icon={<X />} onClick={onDone}>{canManage ? 'Cancel' : 'Close'}</Button>
                <Button variant="ghost" icon={<Braces />} onClick={() => setJson(json === null ? JSON.stringify(piece, null, 2) : null)}>{json === null ? 'JSON' : 'Hide JSON'}</Button>
                {canManage && entry && (
                    <Button
                        variant="ghost"
                        icon={<Trash2 />}
                        className="ml-auto text-bad hover:text-bad"
                        disabled={remove.isPending}
                        onClick={() => ask(
                            {
                                title: `Remove ${entry.group}-${entry.key}?`,
                                body: 'Nobody can wear it, and Habbo\'s later updates leave it removed unless Habbo changes it.',
                                confirm: 'Remove',
                            },
                            () => remove.mutate({ kind: FIGURE_KINDS.set, key: entry.key }, { onSuccess: onDone }),
                        )}
                    >
                        Remove
                    </Button>
                )}
            </div>
            {(save.error || remove.error) && <ErrorNotice error={save.error ?? remove.error} />}
        </div>
    );
};

/** A kind's pieces, filtered and a page at a time, each opening in place to change. */
const Pieces = ({ type, nextId, canManage }: { type: string; nextId: number; canManage: boolean }) => {
    const [ text, setText ] = useState('');
    const [ gender, setGender ] = useState('all');
    const [ access, setAccess ] = useState('all');
    const [ page, setPage ] = useState(0);
    const [ open, setOpen ] = useState<string | null>(null);
    const has = [ ...GENDER_FILTERS[gender]!.has, ...ACCESS_FILTERS[access]!.has ];
    const { data: found, isFetching, error } = useFigureSearch(FIGURE_KINDS.set, type, text, page, has);
    const size = found?.pageSize ?? 1;
    const filtered = text.trim() !== '' || gender !== 'all' || access !== 'all';

    return (
        <Panel className="overflow-clip">
            <ListToolbar
                watch={[ type, text, gender, access, page ]}
                page={{ offset: page * size, limit: size, total: found?.total, onChange: offset => setPage(Math.floor(offset / size)) }}
            >
                <SearchInput
                    value={text}
                    onValueChange={(value) => {
                        setText(value);
                        setPage(0);
                    }}
                    placeholder="Id or asset"
                    className="min-w-36 flex-1 sm:max-w-56"
                    aria-label="Find pieces"
                />
                <Select
                    value={gender}
                    aria-label="Gender"
                    onChange={(event) => {
                        setGender(event.target.value);
                        setPage(0);
                    }}
                >
                    {Object.entries(GENDER_FILTERS).map(([ value, filter ]) => <option key={value} value={value}>{filter.label}</option>)}
                </Select>
                <Select
                    value={access}
                    aria-label="Who may wear it"
                    onChange={(event) => {
                        setAccess(event.target.value);
                        setPage(0);
                    }}
                >
                    {Object.entries(ACCESS_FILTERS).map(([ value, filter ]) => <option key={value} value={value}>{filter.label}</option>)}
                </Select>
                {canManage && <Button variant="secondary" icon={<Plus />} onClick={() => setOpen('')}>New piece</Button>}
            </ListToolbar>
            {open === '' && (
                <div className="border-b border-line bg-subtle/40 p-4 sm:pl-11">
                    <PieceEditor entry={null} type={type} nextId={nextId} canManage={canManage} onDone={() => setOpen(null)} />
                </div>
            )}
            {error && <div className="p-4"><ErrorNotice error={error} /></div>}
            {!found && isFetching && <Loading />}
            {found && found.items.length === 0 && <EmptyState>{filtered ? 'No piece of this kind matches.' : 'This kind has no pieces yet.'}</EmptyState>}
            {found && found.items.length > 0 && (
                <ul className={cx('divide-y divide-line transition-opacity', isFetching && 'opacity-60')}>
                    {found.items.map(item => (
                        <OpenRow key={item.key} open={open === item.key} onToggle={() => setOpen(open === item.key ? null : item.key)} summary={<PieceSummary entry={item} />}>
                            <PieceEditor key={item.data} entry={item} type={type} nextId={nextId} canManage={canManage} onDone={() => setOpen(null)} />
                        </OpenRow>
                    ))}
                </ul>
            )}
        </Panel>
    );
};

/** A kind of the hotel's own: its type, as figures write it, and the palette it's coloured from. */
const NewKind = ({ kinds, onAdded }: { kinds: FigureKindEntry[]; onAdded: (type: string) => void }) => {
    const [ type, setType ] = useState('');
    const save = useSaveFigure();
    const clean = type.trim().toLowerCase();
    const valid = /^[a-z0-9]{1,8}$/.test(clean) && !kinds.some(x => x.entry.key === clean);

    return (
        <form
            className="flex flex-col gap-2 border-t border-line p-3"
            onSubmit={(event) => {
                event.preventDefault();
                save.mutate(
                    { kind: FIGURE_KINDS.setType, data: JSON.stringify({ type: clean, paletteid: 3, mand_m_0: false, mand_f_0: false, mand_m_1: false, mand_f_1: false }) },
                    { onSuccess: () => onAdded(clean) },
                );
            }}
        >
            <div className="flex gap-2">
                <Input value={type} onChange={event => setType(event.target.value)} placeholder="New kind, e.g. xx" maxLength={8} className="min-w-0 flex-1 font-mono" aria-label="New kind" />
                <IconButton label="Add kind" icon={<Plus />} type="submit" disabled={!valid || save.isPending} className="border-line bg-subtle" />
            </div>
            {save.error && <ErrorNotice error={save.error} />}
        </form>
    );
};

/**
 * The clothing: every kind down the side with how many pieces it has; the one picked with its own
 * settings - its palette, who must always wear one - over its pieces, filtered and edited in place.
 */
export const ClothingEditor = ({ canManage }: { canManage: boolean }) => {
    const { data, error } = useFigureKinds();
    const [ chosen, setChosen ] = useState<string | null>(null);
    const fillKinds = useFillHeight<HTMLElement>();

    if (error)
        return <ErrorNotice error={error} />;

    if (!data)
        return <Panel><Loading /></Panel>;

    const current = data.kinds.find(x => x.entry.key === chosen) ?? data.kinds[0];

    return (
        <div className="grid items-start gap-4 lg:grid-cols-[14rem_1fr]">
            <Panel ref={fillKinds} className="flex flex-col overflow-clip lg:sticky lg:top-16 lg:max-h-(--fill-height)">
                {data.kinds.length === 0 && <EmptyState>No kinds yet: take Habbo’s figure data in above.</EmptyState>}
                <ul className="max-h-[60dvh] min-h-0 divide-y divide-line overflow-y-auto lg:max-h-none">
                    {data.kinds.map(({ entry, pieces }) => (
                        <li key={entry.key}>
                            <button
                                type="button"
                                onClick={() => setChosen(entry.key)}
                                className={cx(
                                    'flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-subtle/60',
                                    current?.entry.key === entry.key && 'bg-subtle shadow-[inset_2px_0_0_var(--color-accent)]',
                                )}
                            >
                                <span className="w-7 font-mono text-xs text-muted">{entry.key}</span>
                                <span className="min-w-0 flex-1 truncate">{labelOf(entry.key)}</span>
                                <span className="font-mono text-[11px] text-muted tabular-nums">{pieces.toLocaleString()}</span>
                            </button>
                        </li>
                    ))}
                </ul>
                {canManage && <NewKind kinds={data.kinds} onAdded={setChosen} />}
            </Panel>
            {current && (
                <div className="flex min-w-0 flex-col gap-4">
                    <KindSettings key={`${current.entry.key}:${current.entry.data}`} kind={current.entry} pieces={current.pieces} canManage={canManage} onRemoved={() => setChosen(null)} />
                    <Pieces key={current.entry.key} type={current.entry.key} nextId={data.nextSetId} canManage={canManage} />
                </div>
            )}
        </div>
    );
};

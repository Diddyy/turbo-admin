import { ArrowLeftRight, Box, Download, Fingerprint, LayoutGrid, Palette, RotateCcw, Save, Settings2, Store, Type, Undo2, Upload, Wrench } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { Link } from 'react-router';

import { furniIconUrl, useClientAssets } from '#/api/assets';
import { downloadBundle, useBundle } from '#/api/bundles';
import { ApiError } from '#/api/client';
import { FURNITURE_KINDS, type FurnitureDefinition, furnitureTag, useFurnitureDefinition, useLogicTypes, useUpdateDefinition } from '#/api/gamedata';
import { Modal } from '#/components/Modal';
import { toastError } from '#/components/toast';
import { Badge, Button, ErrorNotice, Input, Loading, Segmented, Select, Switch, Textarea } from '#/components/ui';
import { cx } from '#/lib/cx';
import { fromNow } from '#/lib/time';
import { formatBytes } from '#/pages/assets/format';

import { type FieldInfo, FIELDS, SPECIAL_TYPES, USAGE_POLICIES } from './fields';
import { showValue } from './labels';
import { LogicSelect } from './LogicSelect';
import { UploadDialog } from './UploadDialog';

type Item = Record<string, unknown>;
type Draft = Record<string, string | boolean>;

interface Section {
    id: string;
    title: string;
    icon: ReactNode;
    /** What the section is for, under its title. */
    about: string;
    keys: string[];
    floorOnly?: boolean;
}

/** The editor's sections, in the order a definition is usually looked over. */
const SECTIONS: Section[] = [
    { id: 'overview', title: 'Overview', icon: <Box />, about: 'How it looks, where it is sold and the bundle it is drawn from.', keys: [] },
    { id: 'text', title: 'Name', icon: <Type />, about: 'What players read in the catalog, their inventory and the room.', keys: [ 'name', 'description' ] },
    { id: 'kind', title: 'Kind', icon: <LayoutGrid />, about: 'What sort of furniture it is, and the line it belongs to.', keys: [ 'specialtype', 'category', 'furniline', 'environment', 'rare', 'excludeddynamic' ] },
    { id: 'placement', title: 'Placement', icon: <ArrowLeftRight />, about: 'The tiles it takes, how tall it stands and what avatars may do on it.', keys: [ 'xdim', 'ydim', 'height', 'defaultdir', 'canstandon', 'cansiton', 'canlayon', 'canputstuffon' ], floorOnly: true },
    { id: 'behaviour', title: 'Behaviour', icon: <Settings2 />, about: 'The logic the server runs for it, who may use it, and its states.', keys: [ 'logic', 'usagepolicy', 'states', 'customparams', 'extradata' ] },
    { id: 'trading', title: 'Trading', icon: <Store />, about: 'Where players may pass it on.', keys: [ 'tradeable', 'recyclable', 'cangroup', 'cansell' ] },
    { id: 'client', title: 'Client', icon: <Palette />, about: 'What only the client reads: where its asset is, its colours and ads.', keys: [ 'revision', 'partcolors', 'adurl' ] },
    { id: 'identity', title: 'Identity', icon: <Fingerprint />, about: 'What the hotel and the client know it by.', keys: [ 'classname', 'id' ] },
];

/** Longer words for some fields, under their controls. */
const HINTS: Record<string, string> = {
    logic: 'A new logic reaches furniture already in a room when the room loads again.',
    classname: 'The bundle and the icon follow it: change it only to point at another library.',
    id: 'The client tells furniture apart by its sprite id and special type.',
    extradata: 'Named JSON sections: a crackable\'s rewards, a vending machine\'s items…',
    states: 'Read from Habbo\'s asset file when it is taken in.',
    revision: 'The folder the client loads its asset from.',
    partcolors: 'One colour per tinted layer, as #rrggbb, separated by commas.',
};

/** What a flag means, under its switch. */
const FLAG_HINTS: Record<string, string> = {
    canstandon: 'Avatars may walk onto it.',
    cansiton: 'Avatars sit on it.',
    canlayon: 'Avatars lie on it, as on a bed.',
    canputstuffon: 'Other furniture may be stacked on it.',
    tradeable: 'Players may trade it to each other.',
    recyclable: 'The recycler takes it.',
    cangroup: 'Several of it show as one stack in the inventory.',
    cansell: 'Players may sell it on the marketplace.',
    rare: 'Shown as a rare in the client.',
    excludeddynamic: 'Left out of what the client downloads as it goes.',
};

/** Fields that read better across the whole row. */
const WIDE = new Set([ 'description', 'extradata', 'customparams', 'adurl', 'partcolors' ]);

/** A field's value as its control holds it: text for text and numbers, a flag for a flag. */
const toInput = (field: FieldInfo, value: unknown): string | boolean => {
    if (field.kind === 'bool')
        return value === true;

    if (field.kind === 'colors')
        return value && typeof value === 'object' && 'color' in value && Array.isArray(value.color) ? value.color.join(', ') : '';

    return value === null || value === undefined ? '' : String(value);
};

/** The control's value as the server takes it. */
const fromInput = (field: FieldInfo, input: string | boolean): unknown => {
    if (field.kind === 'bool')
        return input === true;

    const text = String(input);

    if (field.kind === 'int' || field.kind === 'number')
        return text.trim() === '' ? 0 : Number(text);

    if (field.kind === 'colors') {
        const colors = text.split(',').map(x => x.trim()).filter(x => x.length > 0);

        return colors.length ? { color: colors } : null;
    }

    return text;
};

const colorsOf = (text: string) => text.split(',').map(x => x.trim()).filter(x => /^#?[0-9a-f]{3,8}$/i.test(x)).map(x => (x.startsWith('#') ? x : `#${x}`));

interface FileInfo {
    logic?: string | null;
    visualization?: string | null;
    states: number;
    otherAnimations: number[];
    dimensionX?: number | null;
    dimensionY?: number | null;
    dimensionZ?: number | null;
    directions: number[];
    colors: number[];
    layerCount?: number | null;
}

const Fact = ({ label, children }: { label: string; children: ReactNode }) => (
    <div className="flex items-baseline justify-between gap-3 py-2">
        <dt className="text-[13px] text-muted">{label}</dt>
        <dd className="min-w-0 truncate text-right font-mono text-xs">{children}</dd>
    </div>
);

const Card = ({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) => (
    <section className="flex min-w-0 flex-col rounded-xl border border-line bg-surface">
        <header className="flex min-h-10 items-center justify-between gap-2 border-b border-line px-4">
            <h3 className="text-[13px] font-semibold">{title}</h3>
            {actions}
        </header>
        <div className="flex-1 px-4 py-1">{children}</div>
    </section>
);

/** The furniture's icon on a checkerboard, as the catalog draws it. */
const Icon = ({ className: classname, size }: { className: string; size: 'sm' | 'lg' }) => {
    const assets = useClientAssets();
    const url = furniIconUrl(assets, classname);
    const [ failed, setFailed ] = useState<string | null>(null);

    return (
        <span className={cx(
            'grid shrink-0 place-items-center rounded-xl border border-line bg-[repeating-conic-gradient(var(--color-subtle)_0%_25%,var(--color-surface)_0%_50%)] bg-[length:12px_12px]',
            size === 'lg' ? 'size-20' : 'size-9 rounded-lg',
        )}
        >
            {url && failed !== url
                ? <img key={url} src={url} alt="" className="max-h-[80%] max-w-[80%] [image-rendering:pixelated]" onError={() => setFailed(url)} />
                : <Box className={cx('text-muted', size === 'lg' ? 'size-6' : 'size-4')} aria-hidden />}
        </span>
    );
};

/** The bundle the furniture is drawn from: whether there is one, its revision and size, and getting a new one in. */
const BundleCard = ({ definition, canManage }: { definition: FurnitureDefinition; canManage: boolean }) => {
    const name = definition.assetName;
    const { data, error } = useBundle({ kind: 'furniture', name });
    const [ replacing, setReplacing ] = useState(false);
    const missing = error instanceof ApiError && error.status === 404;

    return (
        <Card
            title="Bundle"
            actions={canManage && <Button variant="ghost" icon={<Upload />} className="-mr-2 h-8 px-2 text-xs" onClick={() => setReplacing(true)}>{missing ? 'Upload' : 'Replace'}</Button>}
        >
            {!data && !error && <Loading />}
            {error && !missing && <div className="py-2"><ErrorNotice error={error} /></div>}
            {missing && <p className="py-3 text-[13px] text-bad">{`There is no bundle named ${name}: the client draws a placeholder.`}</p>}
            {data && (
                <dl className="divide-y divide-line">
                    <Fact label="Name">{name}</Fact>
                    <Fact label="State">
                        <span className="inline-flex flex-wrap justify-end gap-1">
                            {data.error ? <Badge tone="red">failed</Badge> : <Badge tone="green">ok</Badge>}
                            <Badge tone={data.source === 'upload' ? 'accent' : 'neutral'}>{data.source}</Badge>
                            {definition.tags.includes('bundle-outdated') && <Badge tone="accent">Habbo has newer</Badge>}
                        </span>
                    </Fact>
                    <Fact label="Revision">{data.revision ?? '-'}</Fact>
                    <Fact label="Size">{data.error ? '-' : formatBytes(data.size)}</Fact>
                    <Fact label="Updated">{fromNow(data.updatedAt)}</Fact>
                    {data.error && <p className="py-2 text-xs text-bad">{data.error}</p>}
                    {!data.error && data.hash && (
                        <div className="py-2.5">
                            <button type="button" onClick={() => void downloadBundle('furniture', name).catch(toastError)} className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline [&>svg]:size-3.5">
                                <Download /> Download .nitro
                            </button>
                        </div>
                    )}
                </dl>
            )}
            <UploadDialog open={replacing} name={name} onClose={() => setReplacing(false)} />
        </Card>
    );
};

/** The furniture at a glance: its look and tags, where it is sold, its bundle, and what Habbo's file said. */
const Overview = ({ definition, item, draft, differing, canManage, onUseHabbo }: { definition: FurnitureDefinition; item: Item; draft: Draft; differing: number; canManage: boolean; onUseHabbo: () => void }) => {
    const notSold = definition.tags.includes('not-sold');
    const file = definition.habboFile && definition.habboFileRead ? JSON.parse(definition.habboFile) as FileInfo : null;
    const list = (values: number[]) => (values.length ? values.join(', ') : '-');
    const name = String(draft.name ?? '') || definition.className;
    const description = String(draft.description ?? '');

    return (
        <div className="flex flex-col gap-4">
            <section className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-4 sm:flex-row sm:items-start">
                <Icon className={definition.className} size="lg" />
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <div className="min-w-0">
                        <h3 className="truncate text-base font-semibold">{name}</h3>
                        {description && <p className="mt-0.5 line-clamp-2 text-[13px] text-muted">{description}</p>}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        <Badge>{FURNITURE_KINDS[definition.productType] ?? 'furniture'}</Badge>
                        <Badge>{`sprite ${String(item.id)}`}</Badge>
                        {typeof draft.furniline === 'string' && draft.furniline && <Badge>{draft.furniline}</Badge>}
                        {definition.tags.map((tag) => {
                            const info = furnitureTag(tag);

                            return <span key={tag} title={info.meaning}><Badge tone={info.tone}>{info.label}</Badge></span>;
                        })}
                    </div>
                    {definition.tags.length > 0 && (
                        <ul className="flex flex-col gap-0.5 text-xs text-muted">
                            {definition.tags.map(tag => <li key={tag}>{furnitureTag(tag).meaning}</li>)}
                        </ul>
                    )}
                </div>
                {canManage && differing > 0 && (
                    <div className="flex flex-col items-start gap-1.5 rounded-lg bg-warn-soft px-3 py-2.5 sm:max-w-56">
                        <span className="text-xs text-warn">{`${differing} ${differing === 1 ? 'field differs' : 'fields differ'} from Habbo's.`}</span>
                        <Button variant="secondary" icon={<RotateCcw />} className="h-8 px-2.5 text-xs" onClick={onUseHabbo}>Use all of Habbo's</Button>
                    </div>
                )}
            </section>

            <div className="grid gap-4 lg:grid-cols-2">
                <Card title="Catalog">
                    <dl className="divide-y divide-line">
                        <Fact label="Sold">{notSold ? <Badge>not sold</Badge> : <Badge tone="green">yes</Badge>}</Fact>
                        <Fact label="Offer">{showValue(JSON.stringify(item.offerid))}</Fact>
                        <Fact label="Builders Club offer">{showValue(JSON.stringify(item.bcofferid))}</Fact>
                    </dl>
                    {notSold && <p className="pb-3 text-xs text-muted">No visible offer sells it. <Link to="/catalog" className="font-medium text-accent hover:underline">Open the catalog</Link> to put it on a page.</p>}
                </Card>
                <BundleCard definition={definition} canManage={canManage} />
                {(file || definition.habboFile) && (
                    <div className="lg:col-span-2">
                        <Card title="Habbo's asset file">
                            {file
                                ? (
                                        <dl className="grid divide-line sm:grid-cols-2 sm:gap-x-6 [&>div]:border-b [&>div]:border-line">
                                            <Fact label="Logic">{file.logic ?? '-'}</Fact>
                                            <Fact label="Visualization">{file.visualization ?? '-'}</Fact>
                                            <Fact label="States">{file.states}{file.otherAnimations.length ? ` (+${file.otherAnimations.length})` : ''}</Fact>
                                            <Fact label="Size">{[ file.dimensionX, file.dimensionY, file.dimensionZ ].map(x => x ?? '-').join(' × ')}</Fact>
                                            <Fact label="Directions">{list(file.directions)}</Fact>
                                            <Fact label="Layers, colours">{file.layerCount ?? '-'}, {list(file.colors)}</Fact>
                                        </dl>
                                    )
                                : <p className="py-3 text-xs text-warn">{`It couldn't be read: ${definition.habboFile}`}</p>}
                        </Card>
                    </div>
                )}
            </div>
        </div>
    );
};

/** The tiles a floor furniture takes, drawn, so a width and length read at a glance. */
const Footprint = ({ width, length }: { width: number; length: number }) => {
    const w = Math.min(Math.max(width, 0), 8);
    const l = Math.min(Math.max(length, 0), 8);

    if (w === 0 || l === 0)
        return null;

    return (
        <div className="flex items-center gap-3 rounded-lg bg-canvas px-3 py-2.5">
            <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${w}, 0.75rem)` }} aria-hidden>
                {Array.from({ length: w * l }, (_, index) => <span key={index} className="size-3 rounded-[3px] bg-accent/70" />)}
            </div>
            <span className="text-xs text-muted">{`${width} × ${length} ${width * length === 1 ? 'tile' : 'tiles'}`}{width > 8 || length > 8 ? ' (drawn up to 8)' : ''}</span>
        </div>
    );
};

/** The definition's fields in sections, Habbo's beside any the hotel holds otherwise. */
const EditorBody = ({ definition, canManage }: { definition: FurnitureDefinition; canManage: boolean }) => {
    // The item as the file writes it, its states, which the file does not carry, and the
    // server's own columns, which no file carries.
    const item: Item = { ...(JSON.parse(definition.item) as Item), states: definition.states, ...(JSON.parse(definition.serverFields) as Item) };
    const { data: logics } = useLogicTypes();
    const habbo = definition.habbo ? JSON.parse(definition.habbo) as Item : null;
    const isWall = definition.productType === 1;
    const fields = FIELDS.filter(field => !(isWall && field.floor));
    const byKey = new Map(fields.map(field => [ field.key, field ]));
    const original: Draft = Object.fromEntries(fields.map(field => [ field.key, toInput(field, item[field.key]) ]));
    const [ draft, setDraft ] = useState<Draft>(original);
    const [ section, setSection ] = useState('overview');
    const update = useUpdateDefinition(definition.id);
    const changed = fields.filter(field => draft[field.key] !== original[field.key]);
    const set = (key: string, value: string | boolean) => setDraft(current => ({ ...current, [key]: value }));

    const habboOf = (field: FieldInfo) => (habbo && !field.server && field.key in habbo ? toInput(field, habbo[field.key]) : null);
    const differs = (field: FieldInfo) => {
        const value = habboOf(field);

        return value !== null && value !== draft[field.key];
    };
    const habboText = (field: FieldInfo) => {
        const value = habboOf(field);

        return field.kind === 'bool' ? (value ? 'yes' : 'no') : (value === '' ? '-' : String(value));
    };
    const differing = fields.filter(differs);
    const sections = SECTIONS.filter(x => !(x.floorOnly && isWall));
    const shown = sections.find(x => x.id === section) ?? sections[0]!;
    const fieldsOf = (target: Section) => target.keys.map(key => byKey.get(key)).filter((field): field is FieldInfo => !!field);

    /** Habbo's value beside a field the hotel holds otherwise, and a way to put it back. */
    const habboNote = (field: FieldInfo) => differs(field) && (
        <span className="flex min-w-0 items-center gap-1.5 text-xs">
            <span className="size-1.5 shrink-0 rounded-full bg-warn" aria-hidden />
            <span className="min-w-0 truncate text-warn" title={habboText(field)}>{`Habbo: ${habboText(field)}`}</span>
            {canManage && <button type="button" onClick={() => set(field.key, habboOf(field)!)} className="shrink-0 font-medium text-accent hover:underline">Use</button>}
        </span>
    );

    const control = (field: FieldInfo) => {
        const value = String(draft[field.key] ?? '');
        const ring = differs(field) && 'border-warn';

        switch (field.key) {
            case 'description':
                return <Textarea value={value} onChange={event => set(field.key, event.target.value)} rows={3} disabled={!canManage} className={cx('w-full', ring)} />;
            case 'extradata':
                return <Textarea value={value} onChange={event => set(field.key, event.target.value)} rows={5} placeholder="{}" disabled={!canManage} className="w-full font-mono text-xs" />;
            case 'logic':
                return <LogicSelect value={value} logics={logics} onChange={next => set(field.key, next)} disabled={!canManage} />;
            case 'usagepolicy':
                return <Segmented label="Who may use it" value={value} onChange={next => set(field.key, next)} options={USAGE_POLICIES.map(x => ({ value: String(x.value), label: x.label }))} disabled={!canManage} />;
            case 'specialtype':
                return (
                    <Select value={value} onChange={event => set(field.key, event.target.value)} disabled={!canManage} className={cx('w-full', ring)}>
                        {!SPECIAL_TYPES.some(x => String(x.value) === value) && <option value={value}>{value || '-'}</option>}
                        {SPECIAL_TYPES.map(x => <option key={x.value} value={String(x.value)}>{`${x.label} (${x.value})`}</option>)}
                    </Select>
                );
            case 'defaultdir':
                return (
                    <Select value={value} onChange={event => set(field.key, event.target.value)} disabled={!canManage} className={cx('w-full font-mono', ring)}>
                        {[ 0, 1, 2, 3, 4, 5, 6, 7 ].map(x => <option key={x} value={String(x)}>{x}</option>)}
                    </Select>
                );
            default:
                return (
                    <Input
                        value={value}
                        onChange={event => set(field.key, event.target.value)}
                        inputMode={field.kind === 'int' ? 'numeric' : field.kind === 'number' ? 'decimal' : undefined}
                        disabled={!canManage}
                        className={cx('w-full', ring, field.kind !== 'text' || field.server ? 'font-mono' : null)}
                    />
                );
        }
    };

    const input = (field: FieldInfo) => (
        <div key={field.key} className={cx('flex min-w-0 flex-col gap-1.5', (WIDE.has(field.key) || field.key === 'usagepolicy') && 'sm:col-span-2')}>
            <div className="flex min-h-5 items-baseline justify-between gap-3">
                <label className="shrink-0 text-xs font-medium text-muted">{field.label}</label>
                {habboNote(field)}
            </div>
            {control(field)}
            {field.kind === 'colors' && colorsOf(String(draft[field.key] ?? '')).length > 0 && (
                <span className="flex flex-wrap gap-1">
                    {colorsOf(String(draft[field.key])).map((color, index) => (
                        <span key={`${color}:${index}`} title={color} className="size-5 rounded-md border border-line" style={{ background: color }} />
                    ))}
                </span>
            )}
            {HINTS[field.key] && <span className="text-xs text-muted">{HINTS[field.key]}</span>}
        </div>
    );

    const toggle = (field: FieldInfo) => (
        <div key={field.key} className={cx('rounded-lg border px-3', differs(field) ? 'border-warn-line bg-warn-soft/40' : 'border-line')}>
            <Switch label={field.label} checked={draft[field.key] === true} onChange={checked => set(field.key, checked)} disabled={!canManage} hint={habboNote(field) || FLAG_HINTS[field.key]} />
        </div>
    );

    const unsavedIn = (target: Section) => fieldsOf(target).filter(field => draft[field.key] !== original[field.key]).length;
    const differingIn = (target: Section) => fieldsOf(target).some(differs);

    return (
        <div className="flex flex-1 flex-col">
            {/* On a phone the bar and the section are two rows: the bar keeps its own height, the section takes the rest. */}
            <div className="grid flex-1 grid-cols-[minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)] md:grid-cols-[12.5rem_minmax(0,1fr)] md:grid-rows-[minmax(0,1fr)]">
                <nav aria-label="Sections" className="sticky top-0 z-10 flex gap-1 overflow-x-auto border-b border-line bg-surface p-2 sm:static md:flex-col md:overflow-visible md:border-r md:border-b-0 md:bg-canvas/50 md:p-3">
                    {sections.map(target => (
                        <button
                            key={target.id}
                            type="button"
                            onClick={(event) => {
                                setSection(target.id);
                                // On a phone the bar scrolls sideways: the tab picked stays in sight.
                                event.currentTarget.scrollIntoView({ block: 'nearest', inline: 'nearest' });
                            }}
                            aria-current={target.id === shown.id}
                            className={cx(
                                'flex min-h-9 shrink-0 items-center gap-2.5 rounded-lg px-3 text-left text-sm whitespace-nowrap transition-colors [&>svg]:size-4 [&>svg]:shrink-0',
                                target.id === shown.id ? 'bg-accent-soft font-medium text-accent' : 'text-muted hover:bg-subtle hover:text-ink',
                            )}
                        >
                            {target.icon}
                            <span className="flex-1">{target.title}</span>
                            {unsavedIn(target) > 0 && <span className="rounded-full bg-accent px-1.5 text-[11px] font-semibold text-on-accent tabular-nums">{unsavedIn(target)}</span>}
                            {unsavedIn(target) === 0 && differingIn(target) && <span className="size-1.5 rounded-full bg-warn" title="Differs from Habbo" />}
                        </button>
                    ))}
                </nav>

                <div className="min-w-0 p-4 sm:p-6">
                    <header className="mb-5">
                        <h3 className="text-[15px] font-semibold">{shown.title}</h3>
                        <p className="mt-0.5 text-[13px] text-muted">{shown.about}</p>
                    </header>

                    {shown.id === 'overview' && (
                        <Overview
                            definition={definition}
                            item={item}
                            draft={draft}
                            differing={differing.length}
                            canManage={canManage}
                            onUseHabbo={() => setDraft(current => ({ ...current, ...Object.fromEntries(differing.map(field => [ field.key, habboOf(field)! ])) }))}
                        />
                    )}

                    {shown.id !== 'overview' && (() => {
                        const all = fieldsOf(shown);
                        const values = all.filter(field => field.kind !== 'bool');
                        const flags = all.filter(field => field.kind === 'bool');

                        return (
                            <div className="flex max-w-3xl flex-col gap-5">
                                {shown.id === 'placement' && <Footprint width={Number(draft.xdim) || 0} length={Number(draft.ydim) || 0} />}
                                {shown.id === 'behaviour' && !habbo && (
                                    <p className="rounded-lg bg-canvas px-3 py-2.5 text-xs text-muted">Habbo has no furniture of this kind and classname: it is the hotel's own, and Habbo's updates never touch it.</p>
                                )}
                                {values.length > 0 && <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">{values.map(input)}</div>}
                                {flags.length > 0 && <div className="grid gap-2 sm:grid-cols-2">{flags.map(toggle)}</div>}
                                {shown.id === 'identity' && (
                                    <p className="flex items-start gap-2 rounded-lg bg-warn-soft px-3 py-2.5 text-xs text-warn [&>svg]:mt-px [&>svg]:size-3.5 [&>svg]:shrink-0">
                                        <Wrench />
                                        Habbo's updates find this furniture by its classname: renamed, Habbo's comes in as a new one beside it.
                                    </p>
                                )}
                            </div>
                        );
                    })()}
                </div>
            </div>

            <footer className="sticky bottom-0 z-10 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur sm:static sm:px-6">
                <div className="min-w-0 flex-1 text-[13px]">
                    {update.error
                        ? <span className="text-bad">{update.error instanceof Error ? update.error.message : 'It could not be saved.'}</span>
                        : changed.length > 0
                            ? <span className="text-ink">{`${changed.length} unsaved ${changed.length === 1 ? 'change' : 'changes'}`}<span className="text-muted">{`: ${changed.map(x => x.label).join(', ')}`}</span></span>
                            : <span className="text-muted">{update.isSuccess ? 'Saved. Habbo\'s later updates leave what you changed as it is.' : canManage ? 'No changes.' : 'You can look, not change.'}</span>}
                </div>
                {canManage && (
                    <div className="flex gap-2">
                        <Button variant="ghost" icon={<Undo2 />} disabled={changed.length === 0} onClick={() => setDraft(original)}>Discard</Button>
                        <Button icon={<Save />} disabled={changed.length === 0 || update.isPending} onClick={() => update.mutate(Object.fromEntries(changed.map(field => [ field.key, fromInput(field, draft[field.key]!) ])))}>
                            {update.isPending ? 'Saving' : 'Save'}
                        </Button>
                    </div>
                )}
            </footer>
        </div>
    );
};

/**
 * One furniture definition, opened from the list: an overview of how it looks, where it is sold
 * and its bundle; then every column it has, in sections - furnidata's, with Habbo's value beside
 * any the hotel holds otherwise, and the server's own, the logic picked from those registered.
 */
export const FurnitureEditor = ({ id, canManage, onClose }: { id: number | null; canManage: boolean; onClose: () => void }) => {
    const { data: definition, error } = useFurnitureDefinition(id);
    const shown = definition && definition.id === id ? definition : null;

    return (
        <Modal
            open={id !== null}
            onClose={onClose}
            className="sm:min-h-[88dvh] sm:max-w-6xl"
            title={shown
                ? (
                        <span className="flex min-w-0 items-center gap-2.5">
                            <Icon className={shown.className} size="sm" />
                            <span className="min-w-0 truncate font-mono">{shown.className}</span>
                        </span>
                    )
                : 'Furniture'}
        >
            {error && <div className="p-5"><ErrorNotice error={error} /></div>}
            {!shown && !error && <Loading />}
            {shown && <EditorBody key={`${shown.id}:${shown.item}:${shown.serverFields}:${shown.tags.join()}`} definition={shown} canManage={canManage} />}
        </Modal>
    );
};

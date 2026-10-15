import { Download, RotateCcw, Save, Undo2, Upload } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { Link } from 'react-router';

import { furniIconUrl, useClientAssets } from '#/api/assets';
import { downloadBundle, useBundle } from '#/api/bundles';
import { ApiError } from '#/api/client';
import { FURNITURE_KINDS, type FurnitureDefinition, furnitureTag, useFurnitureDefinition, useUpdateDefinition } from '#/api/gamedata';
import { Modal } from '#/components/Modal';
import { toastError } from '#/components/toast';
import { Badge, Button, ErrorNotice, Input, Labeled, Loading, Select, SuccessNotice, Switch, Textarea, WarningNotice } from '#/components/ui';
import { cx } from '#/lib/cx';
import { fromNow } from '#/lib/time';
import { formatBytes } from '#/pages/assets/format';

import { type FieldInfo, FIELDS, SPECIAL_TYPES } from './fields';
import { showValue } from './labels';
import { FieldGroup, HabboDiffers } from './parts';
import { UploadDialog } from './UploadDialog';

type Item = Record<string, unknown>;
type Draft = Record<string, string | boolean>;

/** The fields as the editor groups them: what players read, what it is, where it stands, trading, and the rest. */
const GROUPS: { title: string; keys: string[]; floorOnly?: boolean }[] = [
    { title: 'What players read', keys: [ 'name', 'description' ] },
    { title: 'What it is', keys: [ 'specialtype', 'category', 'furniline', 'environment', 'rare', 'excludeddynamic' ] },
    { title: 'Size and placement', keys: [ 'xdim', 'ydim', 'height', 'defaultdir', 'canstandon', 'cansiton', 'canlayon', 'canputstuffon' ], floorOnly: true },
    { title: 'Trading', keys: [ 'tradeable', 'recyclable' ] },
    { title: 'Client', keys: [ 'revision', 'states', 'partcolors', 'customparams', 'adurl' ] },
];

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
    <div className="flex items-baseline justify-between gap-3 py-1.5">
        <dt className="text-xs text-muted">{label}</dt>
        <dd className="min-w-0 truncate text-right font-mono text-xs">{children}</dd>
    </div>
);

const Card = ({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) => (
    <section className="rounded-xl border border-line">
        <header className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
            <h3 className="font-mono text-[11px] font-medium tracking-[0.08em] text-muted uppercase">{title}</h3>
            {actions}
        </header>
        <div className="px-3 py-1.5">{children}</div>
    </section>
);

/** The bundle the furniture is drawn from: whether there is one, its revision and size, and getting a new one in. */
const BundleCard = ({ definition, canManage }: { definition: FurnitureDefinition; canManage: boolean }) => {
    const name = definition.assetName;
    const { data, error } = useBundle({ kind: 'furniture', name });
    const [ replacing, setReplacing ] = useState(false);
    const missing = error instanceof ApiError && error.status === 404;
    const outdated = definition.tags.includes('bundle-outdated');

    return (
        <Card
            title="Bundle"
            actions={canManage && <Button variant="ghost" icon={<Upload />} className="h-8 px-2 text-xs sm:h-7" onClick={() => setReplacing(true)}>{missing ? 'Upload' : 'Replace'}</Button>}
        >
            {!data && !error && <Loading />}
            {error && !missing && <ErrorNotice error={error} />}
            {missing && <p className="py-1.5 text-xs text-bad">{`No bundle named ${name}: the client draws a placeholder.`}</p>}
            {data && (
                <dl className="divide-y divide-line">
                    <Fact label="Name">{name}</Fact>
                    <Fact label="State">
                        <span className="inline-flex flex-wrap justify-end gap-1">
                            {data.error ? <Badge tone="red">failed</Badge> : <Badge tone="green">ok</Badge>}
                            <Badge tone={data.source === 'upload' ? 'accent' : 'neutral'}>{data.source}</Badge>
                            {outdated && <Badge tone="accent">Habbo has newer</Badge>}
                        </span>
                    </Fact>
                    <Fact label="Revision">{data.revision ?? '-'}</Fact>
                    <Fact label="Size">{data.error ? '-' : formatBytes(data.size)}</Fact>
                    <Fact label="Updated">{fromNow(data.updatedAt)}</Fact>
                    {data.error && <p className="py-1.5 text-xs text-bad">{data.error}</p>}
                    {!data.error && data.hash && (
                        <div className="py-1.5">
                            <button type="button" onClick={() => void downloadBundle('furniture', name).catch(toastError)} className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline [&>svg]:size-3.5">
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

/** Where the furniture is sold, its look and what Habbo's asset file said of it. */
const Sidebar = ({ definition, item, canManage }: { definition: FurnitureDefinition; item: Item; canManage: boolean }) => {
    const assets = useClientAssets();
    const icon = furniIconUrl(assets, definition.className);
    const [ iconFailed, setIconFailed ] = useState(false);
    const notSold = definition.tags.includes('not-sold');
    let file: FileInfo | null = null;

    if (definition.habboFile && definition.habboFileRead)
        file = JSON.parse(definition.habboFile) as FileInfo;

    const list = (values: number[]) => (values.length ? values.join(', ') : '-');

    return (
        <div className="flex flex-col gap-3">
            <div className="grid h-28 place-items-center rounded-xl border border-line bg-[repeating-conic-gradient(var(--color-subtle)_0%_25%,transparent_0%_50%)] bg-[length:16px_16px]">
                {icon && !iconFailed
                    ? <img src={icon} alt="" className="max-h-20 max-w-[80%] [image-rendering:pixelated]" onError={() => setIconFailed(true)} />
                    : <span className="text-xs text-muted">No icon</span>}
            </div>
            <Card title="Catalog">
                <dl className="divide-y divide-line">
                    <Fact label="Sold">{notSold ? <Badge>not sold</Badge> : <Badge tone="green">yes</Badge>}</Fact>
                    <Fact label="Offer">{showValue(JSON.stringify(item.offerid))}</Fact>
                    <Fact label="Builders Club offer">{showValue(JSON.stringify(item.bcofferid))}</Fact>
                </dl>
                {notSold && <p className="pb-1.5 text-xs text-muted">No visible offer sells it. <Link to="/catalog" className="text-accent hover:underline">Open the catalog</Link> to put it on a page.</p>}
            </Card>
            <BundleCard definition={definition} canManage={canManage} />
            {(file || definition.habboFile) && (
                <Card title="Habbo's asset file">
                    {file
                        ? (
                                <dl className="divide-y divide-line">
                                    <Fact label="Logic">{file.logic ?? '-'}</Fact>
                                    <Fact label="Visualization">{file.visualization ?? '-'}</Fact>
                                    <Fact label="States">{file.states}{file.otherAnimations.length ? ` (+${file.otherAnimations.length})` : ''}</Fact>
                                    <Fact label="Size">{[ file.dimensionX, file.dimensionY, file.dimensionZ ].map(x => x ?? '-').join(' × ')}</Fact>
                                    <Fact label="Directions">{list(file.directions)}</Fact>
                                    <Fact label="Layers, colours">{file.layerCount ?? '-'}, {list(file.colors)}</Fact>
                                </dl>
                            )
                        : <p className="py-1.5 text-xs text-warn">{`It couldn't be read: ${definition.habboFile}`}</p>}
                </Card>
            )}
        </div>
    );
};

/** The definition's furnidata fields, grouped, each with Habbo's beside it where the hotel's differs. */
const EditorBody = ({ definition, canManage }: { definition: FurnitureDefinition; canManage: boolean }) => {
    // The item as the file writes it, and its states, which the file does not carry.
    const item: Item = { ...(JSON.parse(definition.item) as Item), states: definition.states };
    const habbo = definition.habbo ? JSON.parse(definition.habbo) as Item : null;
    const isWall = definition.productType === 1;
    const fields = FIELDS.filter(field => !(isWall && field.floor));
    const original: Draft = Object.fromEntries(fields.map(field => [ field.key, toInput(field, item[field.key]) ]));
    const [ draft, setDraft ] = useState<Draft>(original);
    const update = useUpdateDefinition(definition.id);
    const changed = fields.filter(field => draft[field.key] !== original[field.key]);
    const set = (key: string, value: string | boolean) => setDraft(current => ({ ...current, [key]: value }));

    const habboOf = (field: FieldInfo) => (habbo && field.key in habbo ? toInput(field, habbo[field.key]) : null);
    const differs = (field: FieldInfo) => {
        const value = habboOf(field);

        return value !== null && value !== draft[field.key];
    };
    const shown = (field: FieldInfo) => {
        const value = habboOf(field);

        return field.kind === 'bool' ? (value ? 'yes' : 'no') : (value === '' ? '-' : String(value));
    };
    const differing = fields.filter(differs);
    const byKey = new Map(fields.map(field => [ field.key, field ]));

    const control = (field: FieldInfo) => {
        const value = String(draft[field.key] ?? '');
        const warn = differs(field) && 'border-warn';

        if (field.key === 'description')
            return <Textarea value={value} onChange={event => set(field.key, event.target.value)} rows={2} disabled={!canManage} className={cx('w-full', warn)} />;

        if (field.key === 'specialtype')
            return (
                <Select value={value} onChange={event => set(field.key, event.target.value)} disabled={!canManage} className={cx('w-full', warn)}>
                    {!SPECIAL_TYPES.some(x => String(x.value) === value) && <option value={value}>{value || '-'}</option>}
                    {SPECIAL_TYPES.map(x => <option key={x.value} value={String(x.value)}>{`${x.value} · ${x.label}`}</option>)}
                </Select>
            );

        if (field.key === 'defaultdir')
            return (
                <Select value={value} onChange={event => set(field.key, event.target.value)} disabled={!canManage} className={cx('w-full font-mono', warn)}>
                    {[ 0, 1, 2, 3, 4, 5, 6, 7 ].map(x => <option key={x} value={String(x)}>{x}</option>)}
                </Select>
            );

        return (
            <Input
                value={value}
                onChange={event => set(field.key, event.target.value)}
                inputMode={field.kind === 'int' ? 'numeric' : field.kind === 'number' ? 'decimal' : undefined}
                disabled={!canManage}
                className={cx('w-full', warn, field.kind !== 'text' && 'font-mono')}
            />
        );
    };

    const input = (field: FieldInfo) => (
        <div key={field.key} className={cx('flex flex-col gap-1', (field.key === 'description' || field.key === 'name') && 'sm:col-span-2')}>
            <Labeled label={field.label}>{control(field)}</Labeled>
            {field.kind === 'colors' && colorsOf(String(draft[field.key] ?? '')).length > 0 && (
                <span className="flex flex-wrap gap-1">
                    {colorsOf(String(draft[field.key])).map((color, index) => (
                        <span key={`${color}:${index}`} title={color} className="size-5 rounded border border-line" style={{ background: color }} />
                    ))}
                </span>
            )}
            {differs(field) && <HabboDiffers habbo={shown(field)} canManage={canManage} onUse={() => set(field.key, habboOf(field)!)} />}
        </div>
    );

    const flag = (field: FieldInfo) => (
        <div key={field.key} className="border-b border-line last:border-b-0 sm:border-b-0">
            <Switch label={field.label} checked={draft[field.key] === true} onChange={checked => set(field.key, checked)} disabled={!canManage} />
            {differs(field) && <div className="-mt-1 pb-2"><HabboDiffers habbo={shown(field)} canManage={canManage} onUse={() => set(field.key, habboOf(field)!)} /></div>}
        </div>
    );

    return (
        <div className="flex min-h-full flex-col">
            <div className="flex flex-wrap items-center gap-1.5 border-b border-line px-4 py-3 sm:px-5">
                <Badge>{FURNITURE_KINDS[definition.productType] ?? 'furniture'}</Badge>
                <Badge>{`sprite ${String(item.id)}`}</Badge>
                {definition.tags.map((tag) => {
                    const info = furnitureTag(tag);

                    return <span key={tag} title={info.meaning}><Badge tone={info.tone}>{info.label}</Badge></span>;
                })}
                {canManage && habbo && differing.length > 0 && (
                    <Button
                        variant="ghost"
                        icon={<RotateCcw />}
                        className="ml-auto h-8 px-2 text-xs sm:h-7"
                        onClick={() => setDraft(current => ({ ...current, ...Object.fromEntries(differing.map(field => [ field.key, habboOf(field)! ])) }))}
                    >
                        {`Use Habbo's for all ${differing.length}`}
                    </Button>
                )}
            </div>
            <div className="grid flex-1 gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_17rem]">
                <div className="flex min-w-0 flex-col gap-6">
                    {!habbo && <WarningNotice>Habbo has no furniture of this kind and classname: it is the hotel's own, and Habbo's updates never touch it.</WarningNotice>}
                    {GROUPS.filter(group => !(group.floorOnly && isWall)).map((group) => {
                        const groupFields = group.keys.map(key => byKey.get(key)).filter((field): field is FieldInfo => !!field);
                        const values = groupFields.filter(field => field.kind !== 'bool');
                        const flags = groupFields.filter(field => field.kind === 'bool');

                        return (
                            <FieldGroup key={group.title} title={group.title}>
                                {values.length > 0 && <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{values.map(input)}</div>}
                                {flags.length > 0 && <div className="grid gap-x-6 sm:grid-cols-2">{flags.map(flag)}</div>}
                            </FieldGroup>
                        );
                    })}
                </div>
                <Sidebar definition={definition} item={item} canManage={canManage} />
            </div>
            {(update.error || (update.isSuccess && changed.length === 0)) && (
                <div className="px-4 pb-4 sm:px-5">
                    {update.error && <ErrorNotice error={update.error} />}
                    {update.isSuccess && changed.length === 0 && <SuccessNotice>Saved. Habbo's later updates leave the fields you changed as they are.</SuccessNotice>}
                </div>
            )}
            {canManage && changed.length > 0 && (
                <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur sm:px-5">
                    <span className="min-w-0 text-sm text-muted">{`${changed.length} unsaved ${changed.length === 1 ? 'change' : 'changes'}: ${changed.map(x => x.label).join(', ')}`}</span>
                    <div className="flex gap-2">
                        <Button variant="ghost" icon={<Undo2 />} onClick={() => setDraft(original)}>Discard</Button>
                        <Button icon={<Save />} disabled={update.isPending} onClick={() => update.mutate(Object.fromEntries(changed.map(field => [ field.key, fromInput(field, draft[field.key]!) ])))}>
                            Save
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
};

/**
 * One furniture definition, opened from the list: its furnidata fields in groups, Habbo's value
 * beside each the hotel holds otherwise (one at a time or all at once), and beside them where it
 * is sold, the bundle it is drawn from (to download or replace) and what Habbo's asset file said.
 */
export const FurnitureEditor = ({ id, canManage, onClose }: { id: number | null; canManage: boolean; onClose: () => void }) => {
    const { data: definition, error } = useFurnitureDefinition(id);
    const assets = useClientAssets();
    const shown = definition && definition.id === id ? definition : null;
    const icon = shown ? furniIconUrl(assets, shown.className) : null;
    const name = shown ? (JSON.parse(shown.item) as Item).name : null;

    return (
        <Modal
            open={id !== null}
            onClose={onClose}
            className="sm:max-w-5xl"
            title={shown
                ? (
                        <span className="flex min-w-0 items-center gap-2.5">
                            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-subtle">
                                {icon && <img src={icon} alt="" className="max-h-[85%] max-w-[85%] [image-rendering:pixelated]" />}
                            </span>
                            <span className="min-w-0 truncate font-mono">{shown.className}</span>
                            {typeof name === 'string' && name && <span className="truncate font-normal text-muted">{name}</span>}
                        </span>
                    )
                : 'Furniture'}
        >
            {error && <div className="p-5"><ErrorNotice error={error} /></div>}
            {!shown && !error && <Loading />}
            {shown && <EditorBody key={`${shown.id}:${shown.item}:${shown.tags.join()}`} definition={shown} canManage={canManage} />}
        </Modal>
    );
};

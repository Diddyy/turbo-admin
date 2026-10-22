import { CheckCircle2, PackagePlus, Send, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { catalogCalls, useCatalogEdit, useCatalogTree } from '#/api/catalog';
import { type FurnitureCreated, type FurnitureDraft, useCreateDefinitions, useFurnitureDraft, useLogicTypes } from '#/api/gamedata';
import { Modal } from '#/components/Modal';
import { toast, toastError } from '#/components/toast';
import { Button, Checkbox, ErrorNotice, Field, Kv, Labeled, Loading, Segmented, Switch, WarningNotice } from '#/components/ui';
import { PageSelect, type Price, PriceFields } from '#/pages/catalog/fields';

import { LogicSelect } from './LogicSelect';
import { FieldGroup } from './parts';

type Kind = 'floor' | 'wall';
type Values = Record<string, string | boolean>;

/** What the bundle's asset data said, as the server read it (FurnitureAssetInfo). */
interface BundleFile {
    logic: string | null;
    visualization: string | null;
    states: number;
    directions: number[];
    sizes: number[];
    layerCount: number | null;
}

const FLAGS: { key: string; label: string }[] = [
    { key: 'canstandon', label: 'Avatars may walk onto it' },
    { key: 'cansiton', label: 'Avatars sit on it' },
    { key: 'canlayon', label: 'Avatars lie on it' },
    { key: 'canputstuffon', label: 'Furniture stacks on it' },
];

const INTS = new Set([ 'xdim', 'ydim', 'states' ]);

/** The draft's fields as the form holds them: text for numbers and words, the flags as switches. */
const valuesOf = (draft: FurnitureDraft): Values => {
    const values: Values = { canstandon: false, cansiton: false, canlayon: false, canputstuffon: false };

    for (const [ key, value ] of Object.entries(JSON.parse(draft.fields) as Record<string, unknown>))
        values[key] = typeof value === 'boolean' ? value : String(value ?? '');

    return values;
};

/** The form's values as the server takes them: a wall item has no size, height or flags of the floor's. */
const fieldsOf = (values: Values, kind: Kind) => {
    const fields: Record<string, unknown> = {};

    for (const [ key, value ] of Object.entries(values)) {
        if (kind === 'wall' && (key === 'xdim' || key === 'ydim' || key === 'height' || FLAGS.some(x => x.key === key)))
            continue;

        fields[key] = typeof value === 'boolean' ? value : INTS.has(key) ? Number.parseInt(value, 10) : key === 'height' ? Number(value) : value;
    }

    return fields;
};

const Made = ({ made, onClose }: { made: FurnitureCreated; onClose: () => void }) => {
    const tree = useCatalogTree();
    const [ target, setTarget ] = useState<number | null>(null);
    const [ price, setPrice ] = useState<Price>({ costCredits: 3, costCurrency: 0, currencyTypeId: null });
    const [ added, setAdded ] = useState(false);
    const add = useCatalogEdit(catalogCalls.addFurni);
    const publish = useCatalogEdit(catalogCalls.publish);

    const submit = () => {
        if (!target)
            return;

        add.mutate([ target, { definitionIds: made.ids, ...price, clubLevel: 0, canGift: true, visible: true, sortBy: null } ], {
            onSuccess: (done) => {
                toast(`Added ${done.done} to the catalog. Publish to put them live.`);
                setAdded(true);
            },
            onError: toastError,
        });
    };

    return (
        <div className="flex flex-col gap-4 p-4 sm:p-5">
            <p className="inline-flex items-center gap-2 text-sm text-good">
                <CheckCircle2 className="size-4" />
                {made.ids.length === 1 ? `Made ${made.definition.className}.` : `Made ${made.definition.className} and ${made.ids.length - 1} colours of it.`}
                <Link to={`/gamedata/library/furniture?id=${made.ids[0]}`} onClick={onClose} className="font-medium text-accent hover:underline">Open it</Link>
            </p>

            <FieldGroup title="Add to the catalog">
                {tree.error && <ErrorNotice error={tree.error} />}
                {!tree.data && !tree.error && <Loading />}
                {tree.data && (
                    <div className="flex flex-col gap-3">
                        <p className="text-xs text-muted">{`An offer for each of the ${made.ids.length} on one page, at one price. Nothing reaches players until the catalog is published.`}</p>
                        <div className="flex flex-wrap items-center gap-2">
                            <PageSelect tree={tree.data} value={target} onChange={setTarget} className="flex-1 sm:w-64 sm:flex-none" />
                            <PriceFields tree={tree.data} value={price} onChange={setPrice} />
                            <Button icon={<PackagePlus />} disabled={!tree.data.canManage || !target || added || add.isPending || (price.costCurrency > 0 && !price.currencyTypeId)} onClick={submit}>
                                {add.isPending ? 'Adding…' : added ? 'Added' : 'Add to catalog'}
                            </Button>
                        </div>
                        {added && (
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="secondary"
                                    icon={<Send />}
                                    disabled={publish.isPending}
                                    onClick={() => publish.mutate([], { onSuccess: () => toast('The catalog is published.'), onError: toastError })}
                                >
                                    {publish.isPending ? 'Publishing…' : 'Publish the catalog'}
                                </Button>
                                <span className="text-xs text-muted">Publishes every change waiting in the catalog, not only these.</span>
                            </div>
                        )}
                    </div>
                )}
            </FieldGroup>

            <div className="flex justify-end">
                <Button variant="ghost" onClick={onClose}>Done</Button>
            </div>
        </div>
    );
};

const DraftForm = ({ draft, onMade }: { draft: FurnitureDraft; onMade: (made: FurnitureCreated) => void }) => {
    const [ kind, setKind ] = useState<Kind>(draft.productType === 1 ? 'wall' : 'floor');
    const [ values, setValues ] = useState<Values>(() => valuesOf(draft));
    const [ colors, setColors ] = useState<Set<number>>(() => new Set(draft.colors));
    const logics = useLogicTypes();
    const create = useCreateDefinitions();
    const file = JSON.parse(draft.file) as BundleFile;

    const set = (key: string, value: string | boolean) => setValues(current => ({ ...current, [key]: value }));
    const text = (key: string) => String(values[key] ?? '');
    const className = text('classname');

    const submit = () => create.mutate({ type: kind, fields: fieldsOf(values, kind), colors: [ ...colors ].sort((a, b) => a - b) }, { onSuccess: onMade });

    return (
        <div className="flex flex-col gap-4 p-4 sm:p-5">
            <p className="text-xs text-muted">
                Read from the bundle&apos;s own data: its size, height, states and logic. Whether it is a seat, a bed or a surface is not in a bundle: say so below.
            </p>

            {draft.existing.length > 0 && (
                <WarningNotice>
                    {`Already drawn from this bundle: ${draft.existing.map(x => x.className).join(', ')}. A classname a definition has is refused.`}
                </WarningNotice>
            )}

            <FieldGroup title="What the bundle says">
                <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
                    <Kv label="Logic" mono>{file.logic ?? 'none'}</Kv>
                    <Kv label="Visualization" mono>{file.visualization ?? 'none'}</Kv>
                    <Kv label="Directions">{file.directions.length ? file.directions.map(x => `${x}°`).join(', ') : 'none'}</Kv>
                    <Kv label="Sizes">{file.sizes.join(', ') || 'none'}</Kv>
                    <Kv label="States">{file.states}</Kv>
                    <Kv label="Colours">{draft.colors.length ? `plain and ${draft.colors.length} more` : 'plain only'}</Kv>
                </div>
            </FieldGroup>

            <FieldGroup title="Definition">
                <div className="flex flex-col gap-3">
                    <Segmented label="Kind" value={kind} onChange={value => setKind(value as Kind)} options={[ { value: 'floor', label: 'Floor item' }, { value: 'wall', label: 'Wall item' } ]} />
                    <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Classname" name="classname" value={text('classname')} onChange={event => set('classname', event.target.value)} hint="Its bundle and icon follow it." />
                        <Field label="Name" name="name" value={text('name')} onChange={event => set('name', event.target.value)} />
                        <Field label="Description" name="description" value={text('description')} onChange={event => set('description', event.target.value)} />
                        <Labeled label="Logic">
                            <LogicSelect value={text('logic')} logics={logics.data} onChange={value => set('logic', value)} />
                        </Labeled>
                        <Field label="States" name="states" type="number" min={0} value={text('states')} onChange={event => set('states', event.target.value)} />
                        {kind === 'floor' && (
                            <>
                                <Field label="Width (tiles)" name="xdim" type="number" min={1} value={text('xdim')} onChange={event => set('xdim', event.target.value)} />
                                <Field label="Length (tiles)" name="ydim" type="number" min={1} value={text('ydim')} onChange={event => set('ydim', event.target.value)} />
                                <Field label="Height" name="height" type="number" min={0} step={0.01} value={text('height')} onChange={event => set('height', event.target.value)} />
                            </>
                        )}
                    </div>
                    {kind === 'floor' && (
                        <div className="grid gap-2 sm:grid-cols-2">
                            {FLAGS.map(x => <Switch key={x.key} label={x.label} checked={values[x.key] === true} onChange={checked => set(x.key, checked)} />)}
                        </div>
                    )}
                </div>
            </FieldGroup>

            {draft.colors.length > 0 && (
                <FieldGroup title="Colours">
                    <div className="flex flex-col gap-2">
                        <p className="text-xs text-muted">Each colour chosen is a definition of its own, named classname*N, with the same fields.</p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                            {draft.colors.map(color => (
                                <Checkbox
                                    key={color}
                                    label={<span className="font-mono">{`${className}*${color}`}</span>}
                                    checked={colors.has(color)}
                                    onChange={checked => setColors((current) => {
                                        const next = new Set(current);

                                        if (checked)
                                            next.add(color);
                                        else
                                            next.delete(color);

                                        return next;
                                    })}
                                />
                            ))}
                        </div>
                    </div>
                </FieldGroup>
            )}

            {create.error && <ErrorNotice error={create.error} />}

            <div className="flex justify-end">
                <Button icon={<Sparkles />} disabled={create.isPending || !className.trim()} onClick={submit}>
                    {create.isPending ? 'Making…' : colors.size > 0 ? `Make ${colors.size + 1} definitions` : 'Make the definition'}
                </Button>
            </div>
        </div>
    );
};

/**
 * A furniture definition made from an uploaded bundle: the bundle's own data prefills it, staff
 * change what they like and make it (with a classname*N for each colour chosen), then add it to a
 * catalog page.
 */
export const NewFurnitureDialog = ({ bundle, onClose }: { bundle: string | null; onClose: () => void }) => {
    const draft = useFurnitureDraft(bundle);
    const [ made, setMade ] = useState<FurnitureCreated | null>(null);

    const close = () => {
        setMade(null);
        onClose();
    };

    return (
        <Modal open={bundle !== null} onClose={close} title={<span className="font-mono">{`New furniture from ${bundle ?? ''}`}</span>} className="sm:h-fit! sm:max-w-3xl">
            {made && <Made made={made} onClose={close} />}
            {!made && draft.error && <div className="p-5"><ErrorNotice error={draft.error} /></div>}
            {!made && !draft.data && !draft.error && <Loading />}
            {!made && draft.data && draft.data.bundle === bundle && <DraftForm key={bundle} draft={draft.data} onMade={setMade} />}
        </Modal>
    );
};

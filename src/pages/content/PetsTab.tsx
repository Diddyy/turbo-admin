import { Plus, Save, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { type PetBreed, type PetLine, useDeletePetLine, usePets, useSavePet } from '#/api/content';
import { ask } from '#/components/confirm';
import { Badge, Button, EmptyState, ErrorNotice, IconButton, Input, Loading, Panel, Select } from '#/components/ui';

/** A pet type by its number; the hotel's texts name them in the client. */
const typeName = (typeId: number | null) => (typeId === null ? 'Every type' : `Type ${typeId}`);

/** One palette: its body, rarity and whether the catalogue sells it, edited where it is listed. */
const BreedRow = ({ breed, canManage }: { breed: PetBreed; canManage: boolean }) => {
    const [ draft, setDraft ] = useState(breed);
    const save = useSavePet();
    const changed = JSON.stringify(draft) !== JSON.stringify(breed);
    // Each named beside it, where a touch screen can see what it is.
    const number = (field: 'breedId' | 'rarityLevel' | 'colorTag', label: string) => (
        <label className="flex items-center gap-1 text-xs text-muted">
            {label}
            <Input
                value={draft[field]}
                onChange={event => setDraft({ ...draft, [field]: Number(event.target.value.replace(/[^-\d]/g, '')) || 0 })}
                inputMode="numeric"
                className="h-10 w-16 text-ink sm:h-8"
                disabled={!canManage}
            />
        </label>
    );

    return (
        <li className="flex flex-wrap items-center gap-2 px-3 py-1.5 text-sm">
            <span className="w-20 font-mono text-xs">palette {breed.paletteId}</span>
            {number('breedId', 'Breed')}
            {number('rarityLevel', 'Rarity')}
            {number('colorTag', 'Colour tag')}
            <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={draft.sellable} onChange={event => setDraft({ ...draft, sellable: event.target.checked })} disabled={!canManage} /> sold</label>
            <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={draft.rare} onChange={event => setDraft({ ...draft, rare: event.target.checked })} disabled={!canManage} /> rare</label>
            {canManage && changed && <IconButton label="Save" icon={<Save />} disabled={save.isPending} onClick={() => save.mutate({ kind: 'breeds', id: breed.id, body: { ...draft } })} />}
            {save.error && <ErrorNotice error={save.error} />}
        </li>
    );
};

/** One line a pet type says, edited where it is listed. */
const LineRow = ({ line, canManage }: { line: PetLine; canManage: boolean }) => {
    const [ text, setText ] = useState(line.line);
    const save = useSavePet();
    const remove = useDeletePetLine();

    return (
        <li className="flex items-center gap-2 px-3 py-1.5">
            <Input value={text} onChange={event => setText(event.target.value)} className="h-8 min-w-0 flex-1 sm:h-8" disabled={!canManage} aria-label="Line" />
            {canManage && text !== line.line && <IconButton label="Save" icon={<Save />} disabled={save.isPending} onClick={() => save.mutate({ kind: 'speech', id: line.id, body: { line: text } })} />}
            {canManage && <IconButton label="Remove" icon={<Trash2 />} tone="bad" disabled={remove.isPending} onClick={() => ask({ title: 'Remove this line?', body: line.line, confirm: 'Remove' }, () => remove.mutate(line.id))} />}
        </li>
    );
};

/**
 * Pets: each type's palettes - the body each has, how rare it is in breeding, whether the
 * catalogue sells it - and the lines each type says. Pets in rooms use a change at once.
 */
export const PetsTab = ({ canManage }: { canManage: boolean }) => {
    const { data, error } = usePets();
    const save = useSavePet();
    const [ breed, setBreed ] = useState({ typeId: '', paletteId: '' });
    const [ line, setLine ] = useState({ typeId: '', text: '' });

    if (error) return <ErrorNotice error={error} />;
    if (!data) return <Loading />;

    const types = [ ...new Set(data.breeds.map(x => x.typeId)) ];
    const lineTypes = [ ...new Set(data.speech.map(x => x.typeId)) ];

    return (
        <div className="grid items-start gap-4 xl:grid-cols-2">
            <Panel title="Palettes" description="Breed is the body the info stand names; rarity weighs breeding; the catalogue sells only the sold ones." className="overflow-clip">
                {types.length === 0 && <EmptyState>No palettes.</EmptyState>}
                <div className="max-h-[70vh] overflow-y-auto">
                    {types.map(type => (
                        <section key={type}>
                            <h3 className="sticky top-0 border-b border-line bg-subtle px-3 py-1.5 font-mono text-[11px] tracking-wide text-muted uppercase">{typeName(type)}</h3>
                            <ul className="divide-y divide-line">
                                {data.breeds.filter(x => x.typeId === type).map(x => <BreedRow key={x.id} breed={x} canManage={canManage} />)}
                            </ul>
                        </section>
                    ))}
                </div>
                {canManage && (
                    <form
                        className="flex flex-wrap gap-2 border-t border-line p-3"
                        onSubmit={(event) => {
                            event.preventDefault();
                            save.mutate({ kind: 'breeds', id: null, body: { typeId: Number(breed.typeId), paletteId: Number(breed.paletteId), sellable: true } }, { onSuccess: () => setBreed({ typeId: '', paletteId: '' }) });
                        }}
                    >
                        <Input value={breed.typeId} onChange={event => setBreed({ ...breed, typeId: event.target.value.replace(/\D/g, '') })} placeholder="type" className="w-24" aria-label="Pet type" />
                        <Input value={breed.paletteId} onChange={event => setBreed({ ...breed, paletteId: event.target.value.replace(/\D/g, '') })} placeholder="palette" className="w-24" aria-label="Palette" />
                        <Button type="submit" variant="secondary" icon={<Plus />} disabled={!breed.typeId || !breed.paletteId || save.isPending}>Add palette</Button>
                    </form>
                )}
            </Panel>
            <Panel title="What pets say" description="A type with lines of its own says those; the rest say the lines for every type." className="overflow-clip">
                {lineTypes.length === 0 && <EmptyState>No lines.</EmptyState>}
                <div className="max-h-[70vh] overflow-y-auto">
                    {lineTypes.map(type => (
                        <section key={type ?? 'all'}>
                            <h3 className="sticky top-0 flex items-center gap-2 border-b border-line bg-subtle px-3 py-1.5 font-mono text-[11px] tracking-wide text-muted uppercase">
                                {typeName(type)}
                                {type === null && <Badge>shared</Badge>}
                            </h3>
                            <ul className="divide-y divide-line">
                                {data.speech.filter(x => x.typeId === type).map(x => <LineRow key={x.id} line={x} canManage={canManage} />)}
                            </ul>
                        </section>
                    ))}
                </div>
                {canManage && (
                    <form
                        className="flex flex-wrap gap-2 border-t border-line p-3"
                        onSubmit={(event) => {
                            event.preventDefault();
                            save.mutate({ kind: 'speech', id: null, body: { typeId: line.typeId === '' ? null : Number(line.typeId), line: line.text } }, { onSuccess: () => setLine({ ...line, text: '' }) });
                        }}
                    >
                        <Select value={line.typeId} onChange={event => setLine({ ...line, typeId: event.target.value })} aria-label="Pet type" className="w-36">
                            <option value="">Every type</option>
                            {[ ...new Set([ ...types, ...lineTypes.filter((x): x is number => x !== null) ]) ].sort((a, b) => a - b).map(type => <option key={type} value={type}>{typeName(type)}</option>)}
                        </Select>
                        <Input value={line.text} onChange={event => setLine({ ...line, text: event.target.value })} placeholder="Woof!" className="min-w-0 flex-1" aria-label="Line" />
                        <Button type="submit" variant="secondary" icon={<Plus />} disabled={!line.text.trim() || save.isPending}>Add line</Button>
                    </form>
                )}
                {save.error && <div className="p-3"><ErrorNotice error={save.error} /></div>}
            </Panel>
        </div>
    );
};

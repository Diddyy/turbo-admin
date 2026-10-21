import { LogOut, Save } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';

import { useMe, useRoom } from '#/api/queries';
import { roomCalls, type RoomPetItem, type RoomPetRequest, useRoomAction, useRoomPets } from '#/api/rooms';
import { ask } from '#/components/confirm';
import { Avatar, Badge, Button, EmptyState, ErrorNotice, Input, Labeled, Loading, PageBody, Panel, Switch } from '#/components/ui';
import { cx } from '#/lib/cx';

import { ActionOutcome, RoomHeader } from './RoomHeader';

const digits = (value: string) => Number(value.replace(/\D/g, '')) || 0;

/** Only what staff changed: the pet's energy and nutrition fall on their own, and what was read is not written back. */
const changesOf = (pet: RoomPetItem, draft: RoomPetItem): RoomPetRequest => {
    const changes: RoomPetRequest = {};

    if (draft.name !== pet.name) changes.name = draft.name;
    if (draft.level !== pet.level) changes.level = draft.level;
    if (draft.energy !== pet.energy) changes.energy = draft.energy;
    if (draft.nutrition !== pet.nutrition) changes.nutrition = draft.nutrition;
    if (draft.anyoneCanRide !== pet.anyoneCanRide) changes.anyoneCanRide = draft.anyoneCanRide;
    if (draft.hasBreedingPermission !== pet.hasBreedingPermission) changes.hasBreedingPermission = draft.hasBreedingPermission;

    return changes;
};

/** One pet in the room: its name, level, energy, nutrition and who may ride or breed it, saved through the room so those in it and its owner see it. */
const PetEditor = ({ roomId, pet, canManage, linked }: { roomId: number; pet: RoomPetItem; canManage: boolean; linked: boolean }) => {
    const [ draft, setDraft ] = useState(pet);
    const action = useRoomAction(roomId);
    const calls = roomCalls(roomId);
    const disabled = !canManage;
    const set = (change: Partial<RoomPetItem>) => setDraft(previous => ({ ...previous, ...change }));
    const changes = changesOf(pet, draft);

    return (
        <Panel
            title={pet.name}
            description={<>Type {pet.typeId}, palette {pet.paletteId}. Owned by {linked ? <Link to={`/players/${pet.ownerId}`} className="text-accent hover:underline">{pet.ownerName}</Link> : pet.ownerName}.</>}
            actions={canManage && (
                <Button
                    variant="ghost"
                    icon={<LogOut />}
                    disabled={action.isPending}
                    onClick={() => ask({ title: `Take ${pet.name} out of the room, back to ${pet.ownerName}'s inventory?`, confirm: 'Take out', danger: false }, () => action.mutate(() => calls.pickupPet(pet.id)))}
                >
                    Take out of the room
                </Button>
            )}
        >
            <form
                className="flex flex-col gap-3 p-4"
                onSubmit={(event) => {
                    event.preventDefault();
                    action.mutate(() => calls.savePet(pet.id, changes));
                }}
            >
                <div className="grid gap-3 sm:grid-cols-2">
                    <Labeled label="Name" hint="Not word-filtered: staff are trusted with it.">
                        <Input value={draft.name} onChange={event => set({ name: event.target.value })} disabled={disabled} />
                    </Labeled>
                    <Labeled label="Level" hint={pet.isMonsterplant ? 'A monsterplant grows with time.' : 'Its experience starts again where this level starts.'}>
                        <Input value={draft.level} onChange={event => set({ level: digits(event.target.value) })} inputMode="numeric" disabled={disabled || pet.isMonsterplant} />
                    </Labeled>
                    <Labeled label="Energy">
                        <Input value={draft.energy} onChange={event => set({ energy: digits(event.target.value) })} inputMode="numeric" disabled={disabled} />
                    </Labeled>
                    <Labeled label="Nutrition">
                        <Input value={draft.nutrition} onChange={event => set({ nutrition: digits(event.target.value) })} inputMode="numeric" disabled={disabled} />
                    </Labeled>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                    <Switch label="Anyone may ride it" checked={draft.anyoneCanRide} onChange={anyoneCanRide => set({ anyoneCanRide })} disabled={disabled} />
                    <Switch label="Others may breed with it" checked={draft.hasBreedingPermission} onChange={hasBreedingPermission => set({ hasBreedingPermission })} disabled={disabled} />
                </div>
                <p className="text-xs text-muted">Held to the hotel&apos;s limits when saved. Energy and nutrition are as last written: a loaded room writes them now and then.</p>
                {canManage && <div><Button type="submit" icon={<Save />} disabled={action.isPending || Object.keys(changes).length === 0}>Save</Button></div>}
                <ActionOutcome message={action.data?.message} error={action.error} />
            </form>
        </Panel>
    );
};

/**
 * The pets standing in a room, and each one's state: set, or taken back to its owner's inventory,
 * by staff who may change the room's settings.
 */
export const RoomPetsPage = () => {
    const id = Number(useParams().id);
    const { data: room } = useRoom(id);
    const { data: pets, error, isPending } = useRoomPets(id);
    const [ open, setOpen ] = useState<number | null>(null);
    const linked = useMe().data?.canViewPlayers ?? false;
    const canManage = room?.can.manageBotsAndPets ?? false;
    const selected = pets?.find(x => x.id === open) ?? pets?.[0] ?? null;

    return (
        <>
            <RoomHeader id={id} room={room} tab="pets" />
            <PageBody>
                {isPending && <Loading />}
                {error && <ErrorNotice error={error} />}
                {pets && pets.length === 0 && <Panel><EmptyState>No pet stands in this room.</EmptyState></Panel>}
                {pets && selected && (
                    <div className="grid items-start gap-4 lg:grid-cols-[20rem_minmax(0,1fr)] lg:gap-5">
                        <Panel title={`Pets (${pets.length})`} className="overflow-clip">
                            <ul>
                                {pets.map(pet => (
                                    <li key={pet.id} className="border-t border-line first:border-t-0">
                                        <button type="button" onClick={() => setOpen(pet.id)} className={cx('flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left hover:bg-subtle', selected.id === pet.id && 'bg-accent-soft/50')}>
                                            <Avatar id={pet.id} name={pet.name} />
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-sm font-medium">{pet.name}</span>
                                                <span className="block truncate text-xs text-muted">{pet.ownerName} · level {pet.level}</span>
                                            </span>
                                            {pet.isMonsterplant && <Badge>Plant</Badge>}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </Panel>
                        {/* Keyed by what was saved, so the form starts again from it. */}
                        <PetEditor key={JSON.stringify(selected)} roomId={id} pet={selected} canManage={canManage} linked={linked} />
                    </div>
                )}
            </PageBody>
        </>
    );
};

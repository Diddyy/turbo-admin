import { closestCenter, type CollisionDetection, DndContext, type DragEndEvent, KeyboardSensor, PointerSensor, pointerWithin, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowDownToLine, ArrowUpToLine, GripVertical, Lock, Plus, Save, Trash2, Users } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { type PublicCategory, type PublicRoom, usePublicPreview, usePublicTab, usePublicTabEdit } from '#/api/content';
import { useRoomSearch } from '#/api/queries';
import type { RoomSearchMode } from '#/api/types';
import { ask } from '#/components/confirm';
import { SearchInput } from '#/components/SearchInput';
import { Badge, Button, EmptyState, ErrorNotice, IconButton, Input, Labeled, Loading, Panel, Segmented, Select, Switch } from '#/components/ui';
import { cx } from '#/lib/cx';
import { useDebounced } from '#/lib/debounce';
import { plural } from '#/lib/plural';

/** The client titles the staff picks block "Staff Picks" when it has no name of its own. */
const titleOf = (category: Pick<PublicCategory, 'name' | 'kind'>) => category.name || (category.kind === 'staffpicks' ? 'Staff Picks' : '(no name)');

const categoryKey = (id: number) => `category-${id}`;
const roomKey = (id: number) => `room-${id}`;
const idOf = (key: string | number) => Number(String(key).split('-')[1]);
const isCategory = (key: string | number) => String(key).startsWith('category-');

// A room dragged over a category in the list lands in it; otherwise the nearest row is the spot.
const collision: CollisionDetection = (args) => {
    if (!isCategory(args.active.id)) {
        const onCategory = pointerWithin(args).filter(x => isCategory(x.id));

        if (onCategory.length)
            return onCategory;
    }

    return closestCenter({ ...args, droppableContainers: args.droppableContainers.filter(x => isCategory(x.id) === isCategory(args.active.id)) });
};

type Handle = Pick<ReturnType<typeof useSortable>, 'attributes' | 'listeners'>;

const Grip = ({ attributes, listeners, label }: Handle & { label: string }) => (
    <span {...attributes} {...listeners} aria-label={label} className="grid size-10 shrink-0 cursor-grab touch-none place-items-center rounded text-muted hover:bg-subtle hover:text-ink active:cursor-grabbing sm:size-7">
        <GripVertical className="size-4" />
    </span>
);

const CategoryRow = ({ category, selected, onSelect, canManage, dropping }: { category: PublicCategory; selected: boolean; onSelect: () => void; canManage: boolean; dropping: boolean }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: categoryKey(category.id), disabled: !canManage });

    return (
        <li
            ref={setNodeRef}
            style={{ transform: CSS.Transform.toString(transform), transition }}
            className={cx('flex items-center gap-1 pr-3', selected && 'bg-accent/10', dropping && 'ring-2 ring-accent ring-inset', isDragging && 'z-10 bg-surface shadow-lg')}
            data-category={category.id}
        >
            {canManage ? <Grip attributes={attributes} listeners={listeners} label={`Move ${titleOf(category)}`} /> : <span className="w-3" />}
            <button type="button" onClick={onSelect} aria-current={selected} className="flex min-w-0 flex-1 items-center gap-2 py-2.5 text-left">
                <span className="min-w-0 flex-1 truncate text-sm">{titleOf(category)}</span>
                <span className="text-xs text-muted">{category.kind === 'staffpicks' ? 'picked' : plural(category.rooms.length, 'room')}</span>
                {!category.visible && <Badge>Hidden</Badge>}
                {category.forceClosed && <Badge tone="amber">Opens closed</Badge>}
                {category.kind === 'staffpicks' && <Badge tone="accent">Staff picks</Badge>}
                {category.pluginKey && <Badge className="max-w-40 truncate">from plugin {category.pluginKey.split(':')[0]}</Badge>}
            </button>
        </li>
    );
};

const RoomRow = ({ room, index, category, others, canManage, onMove, onRemove }: {
    room: PublicRoom;
    index: number;
    category: PublicCategory;
    others: PublicCategory[];
    canManage: boolean;
    onMove: (toCategoryId: number) => void;
    onRemove: () => void;
}) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: roomKey(room.roomId), disabled: !canManage || category.kind === 'staffpicks' });
    const alsoIn = others.filter(x => x.kind === 'manual' && x.rooms.some(r => r.roomId === room.roomId));
    const movable = canManage && category.kind === 'manual';

    return (
        <li
            ref={setNodeRef}
            style={{ transform: CSS.Transform.toString(transform), transition }}
            className={cx('flex flex-wrap items-center gap-2 py-2 pr-3', !movable && 'pl-3', isDragging && 'z-10 bg-surface shadow-lg')}
            data-room={room.roomId}
        >
            {movable && <Grip attributes={attributes} listeners={listeners} label={`Move ${room.name}`} />}
            <span className="w-6 text-right font-mono text-xs text-muted">{index + 1}</span>
            <span className="min-w-0 flex-1">
                <Link to={`/rooms/${room.roomId}`} className="block truncate text-sm hover:text-accent hover:underline">{room.name}</Link>
                <span className="block truncate text-xs text-muted">#{room.roomId} by {room.ownerName}</span>
            </span>
            {alsoIn.map(x => <Badge key={x.id} className="max-w-32 truncate">also in {titleOf(x)}</Badge>)}
            {movable && (
                <>
                    <Select
                        value=""
                        onChange={event => event.target.value && onMove(Number(event.target.value))}
                        aria-label={`Move ${room.name} to another category`}
                        className="w-36"
                    >
                        <option value="">Move to…</option>
                        {others.filter(x => x.kind === 'manual' && !x.rooms.some(r => r.roomId === room.roomId)).map(x => <option key={x.id} value={x.id}>{titleOf(x)}</option>)}
                    </Select>
                    <IconButton label={`Take ${room.name} out`} icon={<Trash2 />} tone="bad" small onClick={onRemove} />
                </>
            )}
        </li>
    );
};

/** A category's name, whether it is shown, opens closed and lists or tiles its rooms. */
const CategoryEditor = ({ category, canManage, onRemoved }: { category: PublicCategory; canManage: boolean; onRemoved: () => void }) => {
    const [ draft, setDraft ] = useState({ name: category.name, visible: category.visible, forceClosed: category.forceClosed, viewMode: category.viewMode });
    const edit = usePublicTabEdit();
    const set = (change: Partial<typeof draft>) => setDraft(previous => ({ ...previous, ...change }));
    const dirty = draft.name !== category.name || draft.visible !== category.visible || draft.forceClosed !== category.forceClosed || draft.viewMode !== category.viewMode;

    return (
        <form
            className="flex flex-col gap-3 border-b border-line bg-subtle/40 p-4"
            onSubmit={(event) => {
                event.preventDefault();
                edit.mutate({ path: `/categories/${category.id}`, method: 'PUT', body: draft });
            }}
        >
            <div className="grid gap-3 sm:grid-cols-2">
                <Labeled label="Name" hint={category.kind === 'staffpicks' ? 'Empty: the client titles it "Staff Picks".' : 'The block\'s title: a name, or a text key such as ${navigator.official.games}.'}>
                    <Input value={draft.name} onChange={event => set({ name: event.target.value })} maxLength={100} disabled={!canManage} aria-label="Category name" />
                </Labeled>
                <Labeled label="Rooms shown as">
                    <Segmented label="Rooms shown as" value={String(draft.viewMode)} onChange={value => set({ viewMode: Number(value) })} options={[ { value: '1', label: 'Thumbnails' }, { value: '0', label: 'List' } ]} disabled={!canManage} />
                </Labeled>
                <Switch label="Shown" hint="Hidden: kept here, not sent to players." checked={draft.visible} onChange={visible => set({ visible })} disabled={!canManage} />
                <Switch label="Opens closed" hint="The block arrives collapsed every time; a click opens it." checked={draft.forceClosed} onChange={forceClosed => set({ forceClosed })} disabled={!canManage} />
            </div>
            {canManage && (
                <div className="flex flex-wrap items-center gap-2">
                    <Button type="submit" icon={<Save />} disabled={!dirty || edit.isPending || (category.kind === 'manual' && !draft.name.trim())}>Save</Button>
                    <span className="text-xs text-muted">Search code <span className="font-mono">{category.searchCode}</span></span>
                    <Button
                        variant="ghost"
                        icon={<Trash2 />}
                        className="ml-auto text-bad hover:text-bad"
                        disabled={edit.isPending}
                        onClick={() => ask({ title: `Remove the category ${titleOf(category)}?`, body: 'Its room list goes with it; the rooms stay.', confirm: 'Remove' }, () => edit.mutate({ path: `/categories/${category.id}`, method: 'DELETE' }, { onSuccess: onRemoved }))}
                    >
                        Remove
                    </Button>
                </div>
            )}
            {edit.error && <ErrorNotice error={edit.error} />}
        </form>
    );
};

/** Finds a room by name, owner or id and puts it in the category, first or last. */
const RoomFinder = ({ category }: { category: PublicCategory }) => {
    const [ text, setText ] = useState('');
    const [ by, setBy ] = useState<RoomSearchMode>('name');
    const query = useDebounced(text.trim());

    return (
        <div className="flex flex-col gap-2 border-t border-line p-3">
            <div className="flex flex-wrap gap-2">
                <SearchInput value={text} onValueChange={setText} placeholder="Add a room: search by name, owner or id" className="min-w-0 flex-1" />
                <Segmented label="Search by" value={by} onChange={value => setBy(value as RoomSearchMode)} options={[ { value: 'name', label: 'Name' }, { value: 'owner', label: 'Owner' }, { value: 'id', label: 'Id' } ]} />
            </div>
            {query && <RoomFinderResults category={category} text={query} by={by} />}
        </div>
    );
};

const RoomFinderResults = ({ category, text, by }: { category: PublicCategory; text: string; by: RoomSearchMode }) => {
    const { data, error } = useRoomSearch(text, by, 1, null);
    const edit = usePublicTabEdit();
    const add = (roomId: number, first: boolean) => edit.mutate({ path: `/categories/${category.id}/rooms`, method: 'POST', body: { roomId, first } });

    if (error) return <ErrorNotice error={error} />;
    if (!data) return <Loading />;
    if (data.rooms.length === 0) return <EmptyState>No room matches.</EmptyState>;

    return (
        <>
            <ul className="divide-y divide-line rounded-lg border border-line" aria-label="Rooms found">
                {data.rooms.slice(0, 8).map((room) => {
                    const inIt = category.rooms.some(x => x.roomId === room.id);

                    return (
                        <li key={room.id} className="flex items-center gap-2 px-3 py-1.5" data-found={room.id}>
                            <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm">{room.name}</span>
                                <span className="block truncate text-xs text-muted">#{room.id} by {room.ownerName}{room.population > 0 && ` · ${plural(room.population, 'user')} now`}</span>
                            </span>
                            {inIt
                                ? <Badge>In it</Badge>
                                : (
                                        <>
                                            <IconButton label={`Add ${room.name} first`} icon={<ArrowUpToLine />} small onClick={() => add(room.id, true)} disabled={edit.isPending} />
                                            <IconButton label={`Add ${room.name} last`} icon={<ArrowDownToLine />} small onClick={() => add(room.id, false)} disabled={edit.isPending} />
                                        </>
                                    )}
                        </li>
                    );
                })}
            </ul>
            {edit.error && <ErrorNotice error={edit.error} />}
        </>
    );
};

/** The Public tab as the navigator answers it now: what a player sees with their next search. */
const Preview = () => {
    const { data, error } = usePublicPreview();

    return (
        <Panel title="Public tab now" description="What players get with their next search, live user counts and a plugin's room order included." className="overflow-clip">
            {error && <div className="p-3"><ErrorNotice error={error} /></div>}
            {!data && !error && <Loading />}
            {data && data.blocks.length === 0 && <EmptyState>The Public tab is empty: no shown category has rooms.</EmptyState>}
            <ol className="divide-y divide-line" aria-label="Public tab preview">
                {data?.blocks.map(block => (
                    <li key={block.searchCode} className="px-4 py-2.5" data-block={block.searchCode}>
                        <div className="flex items-center gap-2">
                            <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{block.text || (block.searchCode === 'staffpicks' ? 'Staff Picks' : block.searchCode)}</span>
                            {block.forceClosed && <span className="text-xs text-muted">opens closed</span>}
                            <span className="text-xs text-muted">{block.viewMode === 1 ? 'thumbnails' : 'list'}</span>
                        </div>
                        <ol className="mt-1 flex flex-col gap-0.5">
                            {block.rooms.map(room => (
                                <li key={room.roomId} className="flex items-center gap-2 text-xs" data-preview-room={room.roomId}>
                                    <span className="min-w-0 flex-1 truncate">{room.name}</span>
                                    {room.doorMode !== 0 && <Lock aria-label="Not open" className="size-3 text-muted" />}
                                    <span className="flex items-center gap-1 text-muted"><Users className="size-3" />{room.users}/{room.maxUsers}</span>
                                </li>
                            ))}
                        </ol>
                    </li>
                ))}
            </ol>
        </Panel>
    );
};

/**
 * The navigator's Public tab: its categories, each one block of Habbo's official_view in this
 * order, and the rooms staff put in each in theirs. Drag a category to order the tab, a room to
 * order its category or onto another category to move it there. Players see a change with their
 * next search; Habbo sends none.
 */
export const PublicRoomsTab = () => {
    const { data, error } = usePublicTab();
    const edit = usePublicTabEdit();
    const [ picked, setPicked ] = useState<number | null>(null);
    const [ adding, setAdding ] = useState('');
    const [ over, setOver ] = useState<number | null>(null);
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

    if (error) return <ErrorNotice error={error} />;
    if (!data) return <Loading />;

    const { categories, canManage } = data;
    const category = categories.find(x => x.id === picked) ?? categories.find(x => x.kind === 'manual') ?? categories[0] ?? null;
    const others = categories.filter(x => x.id !== category?.id);

    const onDragEnd = ({ active, over: target }: DragEndEvent) => {
        setOver(null);

        if (!target || active.id === target.id)
            return;

        if (isCategory(active.id)) {
            const ids = categories.map(x => x.id);
            const order = arrayMove(ids, ids.indexOf(idOf(active.id)), ids.indexOf(idOf(target.id)));

            edit.mutate({ path: '/categories/order', method: 'PUT', body: { ids: order } });

            return;
        }

        if (!category)
            return;

        if (isCategory(target.id)) {
            const to = categories.find(x => x.id === idOf(target.id));

            if (to && to.id !== category.id && to.kind === 'manual')
                edit.mutate({ path: `/categories/${category.id}/rooms/${idOf(active.id)}/move`, method: 'POST', body: { toCategoryId: to.id, index: 0 } });

            return;
        }

        const ids = category.rooms.map(x => x.roomId);

        edit.mutate({ path: `/categories/${category.id}/rooms/order`, method: 'PUT', body: { ids: arrayMove(ids, ids.indexOf(idOf(active.id)), ids.indexOf(idOf(target.id))) } });
    };

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={collision}
            onDragOver={({ active, over: target }) => setOver(target && !isCategory(active.id) && isCategory(target.id) ? idOf(target.id) : null)}
            onDragEnd={onDragEnd}
            onDragCancel={() => setOver(null)}
        >
            <div className="grid gap-4 xl:grid-cols-[minmax(0,20rem)_minmax(0,1fr)_minmax(0,18rem)]">
                <Panel title="Categories" description="Each is one block of the Public tab, in this order. Drag to order; drop a room on one to move it there." className="overflow-clip">
                    <SortableContext items={categories.map(x => categoryKey(x.id))} strategy={verticalListSortingStrategy}>
                        <ul className="divide-y divide-line" aria-label="Public tab categories">
                            {categories.map(x => (
                                <CategoryRow key={x.id} category={x} selected={x.id === category?.id} onSelect={() => setPicked(x.id)} canManage={canManage} dropping={over === x.id && x.id !== category?.id && x.kind === 'manual'} />
                            ))}
                        </ul>
                    </SortableContext>
                    {categories.length === 0 && <EmptyState>No categories yet.</EmptyState>}
                    {canManage && (
                        <form
                            className="flex gap-2 border-t border-line p-3"
                            onSubmit={(event) => {
                                event.preventDefault();
                                edit.mutate({ path: '/categories', method: 'POST', body: { name: adding.trim() } }, {
                                    onSuccess: (saved) => {
                                        setAdding('');
                                        setPicked((saved as { id: number }).id);
                                    },
                                });
                            }}
                        >
                            <Input value={adding} onChange={event => setAdding(event.target.value)} maxLength={100} placeholder="New category" aria-label="New category name" className="min-w-0 flex-1" />
                            <Button type="submit" variant="secondary" icon={<Plus />} disabled={!adding.trim() || edit.isPending}>Add</Button>
                        </form>
                    )}
                    {edit.error && <div className="p-3"><ErrorNotice error={edit.error} /></div>}
                </Panel>
                {category
                    ? (
                            <Panel
                                title={titleOf(category)}
                                description={category.kind === 'staffpicks'
                                    ? 'The staff-picked rooms, newest pick first. Pick a room from its room info in the client or on its page here.'
                                    : 'Its rooms in the order the block lists them. Drag to order.'}
                                className="overflow-clip"
                            >
                                <CategoryEditor key={category.id} category={category} canManage={canManage} onRemoved={() => setPicked(null)} />
                                {category.rooms.length === 0 && <EmptyState>{category.kind === 'staffpicks' ? 'No room is picked.' : 'No rooms yet: an empty category is not sent.'}</EmptyState>}
                                <SortableContext items={category.rooms.map(x => roomKey(x.roomId))} strategy={verticalListSortingStrategy}>
                                    <ul className="divide-y divide-line" aria-label={`Rooms in ${titleOf(category)}`}>
                                        {category.rooms.map((room, i) => (
                                            <RoomRow
                                                key={room.roomId}
                                                room={room}
                                                index={i}
                                                category={category}
                                                others={others}
                                                canManage={canManage}
                                                onMove={toCategoryId => edit.mutate({ path: `/categories/${category.id}/rooms/${room.roomId}/move`, method: 'POST', body: { toCategoryId, index: 0 } })}
                                                onRemove={() => edit.mutate({ path: `/categories/${category.id}/rooms/${room.roomId}`, method: 'DELETE' })}
                                            />
                                        ))}
                                    </ul>
                                </SortableContext>
                                {canManage && category.kind === 'manual' && <RoomFinder category={category} />}
                            </Panel>
                        )
                    : <Panel title="Rooms"><EmptyState>Add a category to put rooms in.</EmptyState></Panel>}
                <Preview />
            </div>
        </DndContext>
    );
};

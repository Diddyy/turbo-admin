import { Eye, EyeOff, Plus, Save, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { type NavigatorFlatCategory, type NavigatorList, useDeleteNavigator, useNavigatorContent, useSaveNavigator } from '#/api/content';
import { ask } from '#/components/confirm';
import { Badge, Button, EmptyState, ErrorNotice, IconButton, Input, Labeled, Loading, Panel, Segmented, Switch } from '#/components/ui';
import { plural } from '#/lib/plural';

import { PublicRoomsTab } from './PublicRoomsTab';

/** A room category's fields as staff write them. */
const CategoryEditor = ({ category, onDone, canManage }: { category: NavigatorFlatCategory | null; onDone: () => void; canManage: boolean }) => {
    const [ draft, setDraft ] = useState(() => ({
        name: category?.name ?? '',
        visible: category?.visible ?? true,
        staffOnly: category?.staffOnly ?? false,
        minRank: category?.minRank ?? 1,
        requiredNode: category?.requiredNode ?? '',
        orderNum: category?.orderNum ?? 0,
    }));
    const save = useSaveNavigator();
    const remove = useDeleteNavigator();
    const set = (change: Partial<typeof draft>) => setDraft(previous => ({ ...previous, ...change }));

    return (
        <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
                event.preventDefault();
                save.mutate({ list: 'categories', id: category?.id ?? null, body: { ...draft, requiredNode: draft.requiredNode.trim() || null } }, { onSuccess: onDone });
            }}
        >
            <div className="grid gap-3 sm:grid-cols-3">
                <Labeled label="Name" hint="Also its search code: category__<name>. Often a text key, such as ${navigator.flatcategory.global.CHAT}.">
                    <Input value={draft.name} onChange={event => set({ name: event.target.value })} disabled={!canManage} autoFocus={!category} />
                </Labeled>
                <Labeled label="Order"><Input value={draft.orderNum} onChange={event => set({ orderNum: Number(event.target.value.replace(/[^-\d]/g, '')) || 0 })} inputMode="numeric" disabled={!canManage} /></Labeled>
                <Labeled label="Lowest rank" hint="1 is every player."><Input value={draft.minRank} onChange={event => set({ minRank: Math.max(1, Number(event.target.value.replace(/\D/g, '')) || 1) })} inputMode="numeric" disabled={!canManage} /></Labeled>
                <Labeled label="Needs the permission" hint="Empty: none.">
                    <Input value={draft.requiredNode} onChange={event => set({ requiredNode: event.target.value })} placeholder="navigator.category.events" className="font-mono text-xs" disabled={!canManage} />
                </Labeled>
                <Switch label="Shown" checked={draft.visible} onChange={visible => set({ visible })} disabled={!canManage} />
                <Switch label="Staff only" hint="Needs navigator.category.staff." checked={draft.staffOnly} onChange={staffOnly => set({ staffOnly })} disabled={!canManage} />
            </div>
            {canManage && (
                <div className="flex flex-wrap items-center gap-2">
                    <Button type="submit" icon={category ? <Save /> : <Plus />} disabled={!draft.name.trim() || save.isPending}>{category ? 'Save' : 'Add'}</Button>
                    <Button variant="ghost" icon={<X />} onClick={onDone}>Cancel</Button>
                    {category && (
                        <Button
                            variant="ghost"
                            icon={<Trash2 />}
                            className="ml-auto text-bad hover:text-bad"
                            disabled={remove.isPending}
                            onClick={() => ask({ title: `Remove the category ${category.name}?`, confirm: 'Remove' }, () => remove.mutate({ list: 'categories', id: category.id }, { onSuccess: onDone }))}
                        >
                            Remove
                        </Button>
                    )}
                </div>
            )}
            {(save.error || remove.error) && <ErrorNotice error={save.error ?? remove.error} />}
        </form>
    );
};

/** A list of names to add to, show or hide, and remove from: event categories or tabs. */
const SimpleList = ({ list, title, description, rows, placeholder, canManage }: {
    list: NavigatorList;
    title: string;
    description: string;
    rows: { id: number; name: string; visible: boolean; detail?: string; orderNum?: number }[];
    placeholder: string;
    canManage: boolean;
}) => {
    const [ adding, setAdding ] = useState('');
    const save = useSaveNavigator();
    const remove = useDeleteNavigator();
    const field = list === 'tabs' ? 'searchCode' : 'name';

    return (
        <Panel title={title} description={description} className="overflow-clip">
            {rows.length === 0 && <EmptyState>None yet.</EmptyState>}
            <ul className="divide-y divide-line">
                {rows.map(row => (
                    <li key={row.id} className="flex items-center gap-3 px-4 py-2">
                        <span className="min-w-0 flex-1 truncate font-mono text-[13px]">{row.name}</span>
                        {row.detail && <span className="text-xs text-muted">{row.detail}</span>}
                        {!row.visible && <Badge>Hidden</Badge>}
                        {canManage && (
                            <>
                                {list === 'tabs' && (
                                    <Input
                                        defaultValue={row.orderNum ?? 0}
                                        onBlur={event => Number(event.target.value) !== row.orderNum && save.mutate({ list, id: row.id, body: { [field]: row.name, orderNum: Number(event.target.value) || 0 } })}
                                        inputMode="numeric"
                                        aria-label={`Order of ${row.name}`}
                                        className="h-8 w-16 sm:h-8"
                                    />
                                )}
                                <IconButton label={row.visible ? 'Hide' : 'Show'} icon={row.visible ? <EyeOff /> : <Eye />} onClick={() => save.mutate({ list, id: row.id, body: { [field]: row.name, visible: !row.visible } })} />
                                <IconButton label="Remove" icon={<Trash2 />} tone="bad" onClick={() => ask({ title: `Remove ${row.name}?`, confirm: 'Remove' }, () => remove.mutate({ list, id: row.id }))} />
                            </>
                        )}
                    </li>
                ))}
            </ul>
            {canManage && (
                <form
                    className="flex gap-2 border-t border-line p-3"
                    onSubmit={(event) => {
                        event.preventDefault();
                        save.mutate({ list, id: null, body: { [field]: adding.trim(), visible: true } }, { onSuccess: () => setAdding('') });
                    }}
                >
                    <Input value={adding} onChange={event => setAdding(event.target.value)} placeholder={placeholder} className="min-w-0 flex-1 font-mono text-xs" />
                    <Button type="submit" variant="secondary" icon={<Plus />} disabled={!adding.trim() || save.isPending}>Add</Button>
                </form>
            )}
            {(save.error || remove.error) && <div className="p-3"><ErrorNotice error={save.error ?? remove.error} /></div>}
        </Panel>
    );
};

/**
 * The navigator: its room categories (who may see each and put rooms in it), its event
 * categories and the tabs along its top, or its Public tab (Public rooms). A change reaches
 * players the next time they open the navigator. Staff picks are set on each room's page.
 */
export const NavigatorTab = ({ canManage }: { canManage: boolean }) => {
    const [ params, setParams ] = useSearchParams();
    const view = params.get('view') === 'public' ? 'public' : 'lists';

    return (
        <div className="flex flex-col gap-4">
            <div className="self-start">
                <Segmented
                    label="Navigator part"
                    value={view}
                    onChange={value => setParams(value === 'public' ? { view: 'public' } : {}, { replace: true })}
                    options={[ { value: 'lists', label: 'Categories and tabs' }, { value: 'public', label: 'Public rooms' } ]}
                />
            </div>
            {view === 'public' ? <PublicRoomsTab /> : <NavigatorLists canManage={canManage} />}
        </div>
    );
};

/** The room categories, event categories and tabs. */
const NavigatorLists = ({ canManage }: { canManage: boolean }) => {
    const { data, error } = useNavigatorContent();
    const [ open, setOpen ] = useState<number | 'new' | null>(null);

    if (error) return <ErrorNotice error={error} />;
    if (!data) return <Loading />;

    return (
        <div className="flex flex-col gap-4">
            <Panel
                title="Room categories"
                description={<>What rooms are filed under and players browse by. A category rooms are in can't be removed until they move. Staff picks are set on <Link to="/rooms" className="text-accent hover:underline">each room</Link>.</>}
                actions={canManage && <Button variant="secondary" icon={<Plus />} onClick={() => setOpen('new')} disabled={open === 'new'}>New category</Button>}
                className="overflow-clip"
            >
                {open === 'new' && <div className="border-b border-line bg-subtle/40 p-4"><CategoryEditor category={null} onDone={() => setOpen(null)} canManage={canManage} /></div>}
                <ul className="divide-y divide-line">
                    {data.flatCategories.map(category => (
                        <li key={category.id}>
                            <button type="button" onClick={() => setOpen(open === category.id ? null : category.id)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-subtle">
                                <span className="w-8 text-right font-mono text-xs text-muted">{category.orderNum}</span>
                                <span className="min-w-0 flex-1 truncate text-sm">{category.name}</span>
                                <span className="text-xs text-muted">{plural(category.rooms, 'room')}</span>
                                {!category.visible && <Badge>Hidden</Badge>}
                                {category.staffOnly && <Badge tone="amber">Staff</Badge>}
                                {category.minRank > 1 && <Badge>Rank {category.minRank}+</Badge>}
                                {category.requiredNode && <Badge tone="accent" className="max-w-48 truncate">{category.requiredNode}</Badge>}
                            </button>
                            {open === category.id && <div className="border-t border-line bg-subtle/40 p-4"><CategoryEditor category={category} onDone={() => setOpen(null)} canManage={canManage} /></div>}
                        </li>
                    ))}
                </ul>
            </Panel>
            <div className="grid gap-4 lg:grid-cols-2">
                <SimpleList
                    list="event-categories"
                    title="Event categories"
                    description="What a room event is promoted under. One that events are in can be hidden, and removed once they are over."
                    rows={data.eventCategories.map(x => ({ id: x.id, name: x.name, visible: x.visible, detail: plural(x.events, 'event') }))}
                    placeholder="${roomevent_type_1}"
                    canManage={canManage}
                />
                <SimpleList
                    list="tabs"
                    title="Tabs"
                    description="The navigator's top tabs, by search code, in order; only shown ones are sent."
                    rows={data.contexts.map(x => ({ id: x.id, name: x.searchCode, visible: x.visible, orderNum: x.orderNum }))}
                    placeholder="hotel_view"
                    canManage={canManage}
                />
            </div>
        </div>
    );
};

import { type FormEvent, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { useMe, useRoomSearch } from '#/api/queries';
import type { RoomSearchMode } from '#/api/types';
import { ListToolbar } from '#/components/ListToolbar';
import { SearchInput } from '#/components/SearchInput';
import { Badge, type BadgeTone, Button, EmptyState, ErrorNotice, Loading, PageBody, PageHeader, Panel, Select, Td, Th } from '#/components/ui';
import { cx } from '#/lib/cx';
import { fromNow } from '#/lib/time';

import { doorModeLabel, formatDateTime } from './labels';

const DOOR_TONES: Record<string, BadgeTone> = { Locked: 'amber', Password: 'amber', Invisible: 'neutral' };

/** How a room lets players in: quiet for an open door, a tag for one that isn't. */
const DoorMode = ({ mode }: { mode: string }) =>
    mode === 'Open'
        ? <span className="text-muted">Open</span>
        : <Badge tone={DOOR_TONES[mode] ?? 'neutral'}>{doorModeLabel(mode)}</Badge>;

const MODES: { value: RoomSearchMode; label: string; placeholder: string }[] = [
    { value: 'name', label: 'Room name', placeholder: 'Part of the room\'s name' },
    { value: 'owner', label: 'Owner', placeholder: 'The owner\'s name, or how it starts' },
    { value: 'id', label: 'Room id', placeholder: 'e.g. 1234' },
    { value: 'ownerId', label: 'Owner id', placeholder: 'The owner\'s player id' },
];

const modeOf = (value: string | null): RoomSearchMode =>
    MODES.some(x => x.value === value) ? (value as RoomSearchMode) : 'name';

/**
 * Every room, invisible ones too, by name, owner or id. The search lives in the address, so a
 * search can be shared, and Back from a room returns to it.
 */
export const RoomsPage = () => {
    const [ params, setParams ] = useSearchParams();
    const text = params.get('q') ?? '';
    const by = modeOf(params.get('by'));
    const page = Math.max(1, Number(params.get('page')) || 1);
    const [ draft, setDraft ] = useState(text);
    const [ draftBy, setDraftBy ] = useState(by);
    const search = useRoomSearch(text, by, page);
    const canViewPlayers = useMe().data?.canViewPlayers ?? false;

    const go = (next: { q?: string; by?: RoomSearchMode; page?: number }) =>
        setParams({ q: next.q ?? text, by: next.by ?? by, page: String(next.page ?? page) });

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();
        go({ q: draft.trim(), by: draftBy, page: 1 });
    };

    return (
        <>
            <PageHeader
                title="Rooms"
                description={search.data
                    ? `${search.data.total.toLocaleString()} ${search.data.total === 1 ? 'room' : 'rooms'}${text ? ` matching "${text}"` : ', most recently active first'}`
                    : 'Every room, invisible ones too'}
            />
            <PageBody>
                <Panel className="overflow-clip">
                    <ListToolbar
                        watch={[ text, by, page ]}
                        page={{
                            offset: (page - 1) * (search.data?.pageSize ?? 1),
                            limit: search.data?.pageSize ?? 1,
                            total: search.data?.total,
                            onChange: offset => go({ page: Math.floor(offset / (search.data?.pageSize ?? 1)) + 1 }),
                        }}
                    >
                        <form onSubmit={handleSubmit} className="flex min-w-0 flex-1 flex-wrap gap-2">
                            <Select value={draftBy} onChange={event => setDraftBy(modeOf(event.target.value))} aria-label="Search by">
                                {MODES.map(mode => <option key={mode.value} value={mode.value}>{mode.label}</option>)}
                            </Select>
                            <SearchInput
                                value={draft}
                                onValueChange={setDraft}
                                placeholder={MODES.find(x => x.value === draftBy)?.placeholder}
                                aria-label="Search"
                                inputMode={draftBy === 'id' ? 'numeric' : undefined}
                                className="min-w-48 flex-1 sm:max-w-80"
                            />
                            <Button type="submit">Search</Button>
                        </form>
                    </ListToolbar>

                    {search.error && <div className="p-4"><ErrorNotice error={search.error} /></div>}
                    {search.isPending && <Loading />}
                    {search.data && (
                        <>
                            {search.data.rooms.length === 0
                                ? <EmptyState>No room matches.</EmptyState>
                                : (
                                        <div className={cx('transition-opacity', search.isFetching && 'opacity-60')}>
                                            {/* A phone: one tappable row per room. */}
                                            <ul className="sm:hidden">
                                                {search.data.rooms.map(room => (
                                                    <li key={room.id} className="border-t border-line first:border-t-0">
                                                        <Link to={`/rooms/${room.id}`} className="flex min-h-16 items-center gap-3 px-4 py-2.5 active:bg-subtle">
                                                            <div className="min-w-0 flex-1">
                                                                <div className="truncate font-medium">{room.name}</div>
                                                                <div className="truncate font-mono text-[11px] text-muted">#{room.id} · {room.ownerName} · {doorModeLabel(room.doorMode).toLowerCase()}</div>
                                                            </div>
                                                            {room.isLoaded
                                                                ? <span className="shrink-0 font-mono text-sm text-good tabular-nums">{room.population}<span className="text-muted">/{room.playersMax}</span></span>
                                                                : <span className="shrink-0 font-mono text-[11px] text-muted">OFF</span>}
                                                        </Link>
                                                    </li>
                                                ))}
                                            </ul>
                                            <div className="hidden overflow-x-auto sm:block">
                                                <table className="w-full text-sm">
                                                    <thead>
                                                        <tr>
                                                            <Th>Room</Th>
                                                            <Th>Owner</Th>
                                                            <Th>Access</Th>
                                                            <Th className="text-right">Players</Th>
                                                            <Th>Last active</Th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="[&>tr:last-child>td]:border-b-0">
                                                        {search.data.rooms.map(room => (
                                                            <tr key={room.id} className="hover:bg-subtle/60">
                                                                <Td>
                                                                    <Link to={`/rooms/${room.id}`} className="font-medium hover:text-accent">{room.name}</Link>
                                                                    <span className="ml-2 font-mono text-[11px] text-muted">#{room.id}</span>
                                                                    {room.categoryName && <div className="text-xs text-muted">{room.categoryName}</div>}
                                                                </Td>
                                                                <Td>
                                                                    {canViewPlayers
                                                                        ? <Link to={`/players/${room.ownerId}`} className="text-muted hover:text-accent">{room.ownerName}</Link>
                                                                        : <span className="text-muted">{room.ownerName}</span>}
                                                                </Td>
                                                                <Td><DoorMode mode={room.doorMode} /></Td>
                                                                <Td className="text-right font-mono tabular-nums">
                                                                    {room.isLoaded
                                                                        ? <>{room.population}<span className="text-muted"> / {room.playersMax}</span></>
                                                                        : <span className="font-sans text-xs text-muted">not loaded</span>}
                                                                </Td>
                                                                <Td className="text-muted"><span title={formatDateTime(room.lastActiveUtc)}>{fromNow(room.lastActiveUtc)}</span></Td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                        </>
                    )}
                </Panel>
            </PageBody>
        </>
    );
};

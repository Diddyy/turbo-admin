import { X } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { useMe } from '#/api/queries';
import { type RoomVisitEntry, type RoomVisitsFilter, useRoomVisits } from '#/api/roomVisits';
import { ListToolbar } from '#/components/ListToolbar';
import { LogFilters } from '#/components/LogFilters';
import { PhoneLabel, Row, RowList } from '#/components/RowList';
import { SearchInput } from '#/components/SearchInput';
import { Button, EmptyState, ErrorNotice, Input, Loading, PageBody, PageHeader, Panel } from '#/components/ui';
import { useHubTabs } from '#/layout/nav';
import { cx } from '#/lib/cx';
import { type ListOrder, listQuery, orderOf, pageOf, type Sorting } from '#/lib/sort';
import { fromNow } from '#/lib/time';
import { formatDateTime } from '#/pages/rooms/labels';

const filterOf = (params: URLSearchParams): RoomVisitsFilter => ({
    player: params.get('player') ?? '',
    room: params.get('room') ?? '',
});

/**
 * Who went in, with a way to their page (this log is for staff who may look at players); a player
 * who is gone has no page, so only their id.
 */
const Who = ({ entry }: { entry: RoomVisitEntry }) => (
    <span className="truncate">
        {entry.playerName
            ? <Link to={`/players/${entry.playerId}`} className="font-medium hover:text-accent">{entry.playerName}</Link>
            : <span className="text-muted">player #{entry.playerId}</span>}
    </span>
);

/** Where they went: the room's page when you may look at rooms and it is still there. */
const Where = ({ entry, linked }: { entry: RoomVisitEntry; linked: boolean }) => (
    <span className="min-w-0 truncate">
        <PhoneLabel>went into </PhoneLabel>
        {!entry.roomName
            ? <span className="text-muted">a room that is gone</span>
            : linked
                ? <Link to={`/rooms/${entry.roomId}`} className="hover:text-accent">{entry.roomName}</Link>
                : entry.roomName}
    </span>
);

/**
 * Who went into which room, newest first (or oldest, or by room id), from the entry log the
 * navigator's history keeps: narrowed to a player (name or id) or a room (id). The filter, the page
 * and the order live in the address, so a player's and a room's page can link straight to their
 * visits.
 */
export const RoomVisitsPage = () => {
    const tabs = useHubTabs('logs');
    const canViewRooms = useMe().data?.canViewRooms ?? false;
    const [ params, setParams ] = useSearchParams();
    const filter = filterOf(params);
    const page = pageOf(params);
    const order = orderOf(params);
    const [ draft, setDraft ] = useState(filter);
    const log = useRoomVisits(filter, page, order);
    const filtered = Object.values(filter).some(x => x !== '');
    const entries = log.data?.entries ?? [];
    const pageSize = log.data?.pageSize ?? 1;

    /** Another filter, page or order. */
    const go = (next: RoomVisitsFilter, nextPage = 1, nextOrder: ListOrder | null = order) =>
        setParams(listQuery(next, nextPage, nextOrder));

    const sorting: Sorting = { order: order ?? log.data?.order, onSort: next => go(filter, 1, next) };

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();
        go({ player: draft.player.trim(), room: draft.room.trim() });
    };

    const clear = () => {
        setDraft({ player: '', room: '' });
        go({ player: '', room: '' });
    };

    return (
        <>
            <PageHeader title="Logs" tabs={tabs} description="Who went into which room, and when" />
            <PageBody>
                <Panel className="overflow-clip">
                    <ListToolbar
                        watch={[ filter.player, filter.room, page, order ]}
                        page={{
                            offset: (page - 1) * pageSize,
                            limit: pageSize,
                            total: log.data?.total,
                            capped: log.data?.totalCapped,
                            onChange: offset => go(filter, Math.floor(offset / pageSize) + 1),
                        }}
                    >
                        <form onSubmit={handleSubmit} className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                            <SearchInput
                                value={draft.player}
                                onValueChange={player => setDraft({ ...draft, player })}
                                placeholder="Player name or id"
                                aria-label="Player"
                                className="min-w-40 flex-1 sm:max-w-56"
                            />
                            <LogFilters active={filter.room !== '' ? 1 : 0}>
                                <Input
                                    type="search"
                                    inputMode="numeric"
                                    value={draft.room}
                                    onChange={event => setDraft({ ...draft, room: event.target.value.replace(/\D/g, '') })}
                                    placeholder="Room id"
                                    aria-label="Room id"
                                    className="w-28 flex-[1_1_6rem] font-mono sm:flex-none"
                                />
                                <Button type="submit">Search</Button>
                                {filtered && <Button type="button" variant="ghost" icon={<X />} onClick={clear}>Clear</Button>}
                            </LogFilters>
                        </form>
                    </ListToolbar>

                    {log.error && <div className="p-4"><ErrorNotice error={log.error} /></div>}
                    {log.isPending && <Loading />}
                    {log.data && (
                        entries.length === 0
                            ? <EmptyState>{filtered ? 'No visit matches.' : 'Nobody has gone into a room yet.'}</EmptyState>
                            : (
                                    <div className={cx('transition-opacity', log.isFetching && 'opacity-60')}>
                                        <RowList
                                            columns="max-content minmax(0,12rem) minmax(0,1fr) max-content"
                                            headers={[ { label: 'When', sort: 'when', first: 'desc' }, { label: 'Who' }, { label: 'Room' }, { label: 'Room id', className: 'text-right', sort: 'room' } ]}
                                            sorting={sorting}
                                        >
                                            {entries.map(entry => (
                                                <Row key={entry.id}>
                                                    <span className="text-xs whitespace-nowrap text-muted sm:text-sm" title={formatDateTime(entry.atUtc)}>
                                                        {fromNow(entry.atUtc)}
                                                    </span>
                                                    <Who entry={entry} />
                                                    <Where entry={entry} linked={canViewRooms} />
                                                    <span className="font-mono text-[11px] text-muted max-sm:ml-auto sm:text-right">#{entry.roomId}</span>
                                                </Row>
                                            ))}
                                        </RowList>
                                    </div>
                                )
                    )}
                </Panel>
            </PageBody>
        </>
    );
};

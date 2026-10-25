import { UserPlus } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { type PlayerListItem, type PlayerSearchMode, usePlayerAbilities, usePlayerSearch } from '#/api/players';
import { ListToolbar } from '#/components/ListToolbar';
import { SearchInput } from '#/components/SearchInput';
import { PhoneSort } from '#/components/SortHeader';
import { Avatar, Badge, Button, EmptyState, ErrorNotice, LiveBadge, Loading, PageBody, PageHeader, Panel, Select, Switch, Td, Th } from '#/components/ui';
import { cx } from '#/lib/cx';
import { type ListOrder, orderOf, orderParams, pageOf, type Sorting } from '#/lib/sort';
import { fromNow } from '#/lib/time';

import { NewPlayerPanel } from './NewPlayerPanel';

const MODES: { value: PlayerSearchMode; label: string; placeholder: string }[] = [
    { value: 'name', label: 'Name', placeholder: 'Part of the player\'s name' },
    { value: 'id', label: 'Player id', placeholder: 'e.g. 1234' },
    { value: 'discord', label: 'Discord', placeholder: 'Discord username or id' },
];

const modeOf = (value: string | null): PlayerSearchMode =>
    MODES.some(x => x.value === value) ? (value as PlayerSearchMode) : 'name';

/** Online now, or when they were last: never, for someone who has not logged in. */
const Seen = ({ player }: { player: PlayerListItem }) =>
    player.isOnline
        ? <LiveBadge live>ONLINE</LiveBadge>
        : <span className="text-xs text-muted">{player.lastLoginUtc ? fromNow(player.lastLoginUtc) : 'never'}</span>;

/** The columns the list sorts by, as the server names them. */
const SORT_COLUMNS = [
    { label: 'Player', sort: 'name' },
    { label: 'Seen', sort: 'seen', first: 'desc' },
    { label: 'Rooms', sort: 'rooms', first: 'desc' },
    { label: 'Joined', sort: 'joined', first: 'desc' },
] as const;

/**
 * Every player, by part of their name or by id, most recently logged in first unless sorted
 * otherwise, the online ones alone when asked. The search and its order live in the address, so a
 * search can be shared, and Back from a player returns to it.
 */
export const PlayersPage = () => {
    const [ params, setParams ] = useSearchParams();
    const text = params.get('q') ?? '';
    const by = modeOf(params.get('by'));
    const online = params.get('online') === 'true';
    const page = pageOf(params);
    const order = orderOf(params);
    const [ draft, setDraft ] = useState(text);
    const [ draftBy, setDraftBy ] = useState(by);
    const search = usePlayerSearch(text, by, online, page, order);
    const canCreate = usePlayerAbilities().data?.createPlayers ?? false;
    const [ creating, setCreating ] = useState(false);

    const go = (next: { q?: string; by?: PlayerSearchMode; online?: boolean; page?: number }, nextOrder: ListOrder | null = order) =>
        setParams({ q: next.q ?? text, by: next.by ?? by, online: String(next.online ?? online), page: String(next.page ?? page), ...orderParams(nextOrder) });

    const sorting: Sorting = { order: order ?? search.data?.order, onSort: next => go({ page: 1 }, next) };

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();
        go({ q: draft.trim(), by: draftBy, page: 1 });
    };

    const pageSize = search.data?.pageSize ?? 1;

    return (
        <>
            <PageHeader
                title="Players"
                description={search.data
                    ? `${search.data.total.toLocaleString()} ${search.data.total === 1 ? 'player' : 'players'}${text ? ` matching "${text}"` : ''} · ${search.data.onlineNow.toLocaleString()} online now`
                    : 'Everyone in the hotel'}
            >
                {canCreate && !creating && <Button icon={<UserPlus />} onClick={() => setCreating(true)}>New player</Button>}
            </PageHeader>
            <PageBody className="flex flex-col gap-4 lg:gap-5">
                {creating && <NewPlayerPanel onClose={() => setCreating(false)} />}
                <Panel className="overflow-clip">
                    <ListToolbar
                        watch={[ text, by, online, page, order ]}
                        page={{
                            offset: (page - 1) * pageSize,
                            limit: pageSize,
                            total: search.data?.total,
                            onChange: offset => go({ page: Math.floor(offset / pageSize) + 1 }),
                        }}
                    >
                        <form onSubmit={handleSubmit} className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
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
                            <Switch label="Online only" checked={online} onChange={value => go({ online: value, page: 1 })} className="min-h-9 gap-3 sm:ml-2" />
                        </form>
                    </ListToolbar>

                    {search.error && <div className="p-4"><ErrorNotice error={search.error} /></div>}
                    {search.isPending && <Loading />}
                    {search.data && (
                        search.data.players.length === 0
                            ? <EmptyState>{online ? 'Nobody matching is online.' : 'No player matches.'}</EmptyState>
                            : (
                                    <div className={cx('transition-opacity', search.isFetching && 'opacity-60')}>
                                        {/* A phone: one tappable row per player. */}
                                        <PhoneSort columns={[ ...SORT_COLUMNS ]} sorting={sorting} />
                                        <ul className="sm:hidden">
                                            {search.data.players.map(player => (
                                                <li key={player.id} className="border-t border-line first:border-t-0">
                                                    <Link to={`/players/${player.id}`} className="flex min-h-16 items-center gap-3 px-4 py-2.5 active:bg-subtle">
                                                        <Avatar id={player.id} name={player.name} figure={player.figure} />
                                                        <div className="min-w-0 flex-1">
                                                            <div className="truncate font-medium">{player.name}</div>
                                                            <div className="truncate font-mono text-[11px] text-muted">#{player.id}{player.discordUsername ? ` · @${player.discordUsername}` : player.motto ? ` · ${player.motto}` : ''}</div>
                                                        </div>
                                                        <Seen player={player} />
                                                    </Link>
                                                </li>
                                            ))}
                                        </ul>
                                        <div className="hidden overflow-x-auto sm:block">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr>
                                                        <Th sort="name" sorting={sorting}>Player</Th>
                                                        <Th sort="seen" first="desc" sorting={sorting}>Seen</Th>
                                                        <Th className="text-right" sort="rooms" first="desc" sorting={sorting}>Rooms</Th>
                                                        <Th sort="joined" first="desc" sorting={sorting}>Joined</Th>
                                                    </tr>
                                                </thead>
                                                <tbody className="[&>tr:last-child>td]:border-b-0">
                                                    {search.data.players.map(player => (
                                                        <tr key={player.id} className="hover:bg-subtle/60">
                                                            <Td>
                                                                <Link to={`/players/${player.id}`} className="flex items-center gap-3">
                                                                    <Avatar id={player.id} name={player.name} figure={player.figure} />
                                                                    <span className="min-w-0">
                                                                        <span className="block font-medium hover:text-accent">
                                                                            {player.name}
                                                                            <span className="ml-2 font-mono text-[11px] font-normal text-muted">#{player.id}</span>
                                                                            {player.discordUsername && <Badge tone="accent" className="ml-2">discord</Badge>}
                                                                        </span>
                                                                        {player.motto && <span className="block max-w-80 truncate text-xs text-muted">{player.motto}</span>}
                                                                    </span>
                                                                </Link>
                                                            </Td>
                                                            <Td><Seen player={player} /></Td>
                                                            <Td className="text-right font-mono tabular-nums">{player.roomsOwned}</Td>
                                                            <Td className="text-xs text-muted">{fromNow(player.joinedUtc)}</Td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )
                    )}
                </Panel>
            </PageBody>
        </>
    );
};

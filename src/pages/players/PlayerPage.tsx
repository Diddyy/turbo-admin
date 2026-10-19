import { ChevronRight, DoorOpen, House, KeyRound, MessagesSquare, ScrollText } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router';

import { type PlayerDetailResponse, type PlayerSanctionItem, usePlayer, usePlayerAbilities } from '#/api/players';
import { useMe } from '#/api/queries';
import { Avatar, Badge, ErrorNotice, HeaderLink, Kv, Label, LiveBadge, Loading, PageBody, PageHeader, Panel } from '#/components/ui';
import { useRememberRecent } from '#/lib/recent';
import { usePathTab } from '#/lib/tabs';
import { fromNow } from '#/lib/time';
import { formatDateTime } from '#/pages/rooms/labels';

import { CurrenciesPanel } from './CurrenciesPanel';
import { DiscordCard } from './DiscordCard';
import { InventoryTab } from './InventoryTab';
import { LoginTicketCard } from './LoginTicketCard';
import { PlayerActions } from './PlayerActions';
import { restrictionLabel } from './restrictions';

const TABS = [ 'overview', 'inventory' ] as const;

const TAB_LABELS: Record<(typeof TABS)[number], string> = {
    overview: 'Overview',
    inventory: 'Inventory',
};

/** The ban that holds on them now, if any. */
const activeBan = (player: PlayerDetailResponse) => player.sanctions.find(x => x.isActive && x.kind === 'Ban');

/**
 * A player's look, as the parts it is made of (a part's type, its id and colours), with the raw
 * string under a disclosure for copying.
 */
const Figure = ({ figure }: { figure: string }) => (
    <details className="group border-t border-line px-4 py-3">
        <summary className="flex min-h-8 cursor-pointer list-none items-center justify-between gap-2 [&::-webkit-details-marker]:hidden">
            <Label>Figure</Label>
            <span className="text-xs text-muted group-open:hidden">Show</span>
            <span className="hidden text-xs text-muted group-open:inline">Hide</span>
        </summary>
        <ul className="mt-2 flex flex-wrap gap-1.5">
            {figure.split('.').filter(part => part !== '').map((part, index) => (
                <li key={index}><Badge className="normal-case!">{part}</Badge></li>
            ))}
        </ul>
        <p className="mt-2 font-mono text-[11px] break-all text-muted select-all">{figure}</p>
    </details>
);

/**
 * Who the player is at a glance, on every tab: their face, motto and what holds on them now, with
 * the actions on them along its bottom.
 */
const PlayerCard = ({ player }: { player: PlayerDetailResponse }) => {
    const ban = activeBan(player);

    return (
        <section aria-label={player.name} className="overflow-clip rounded-xl border border-line bg-surface">
            <div className="flex items-center gap-4 px-4 py-4">
                <Avatar id={player.id} name={player.name} figure={player.figure} large className="size-16 rounded-xl text-base sm:size-16" />
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <h2 className="truncate text-lg font-semibold tracking-tight">{player.name}</h2>
                        {ban && <Badge tone="red">banned</Badge>}
                        {player.silenced && <Badge tone="amber">muted</Badge>}
                        {player.tradeLocked && <Badge tone="amber">trade locked</Badge>}
                    </div>
                    <p className="truncate text-sm text-muted">{player.motto ?? 'No motto'}</p>
                    <p className="mt-1 truncate font-mono text-[11px] text-muted">
                        {player.isOnline
                            ? player.currentRoom ? `in ${player.currentRoom.name}` : 'online, in no room'
                            : player.lastLoginUtc ? `last seen ${fromNow(player.lastLoginUtc)}` : 'never logged in'}
                        {` · ${player.respectPoints.toLocaleString()} respect`}
                    </p>
                </div>
            </div>
            <PlayerActions key={player.id} player={player} />
        </section>
    );
};

/** Whether a sanction still holds, and if not why not. */
const SanctionState = ({ sanction }: { sanction: PlayerSanctionItem }) =>
    sanction.isActive
        ? <Badge tone="red">active</Badge>
        : sanction.revokedUtc
            ? <Badge>lifted</Badge>
            : <Badge>ended</Badge>;

/** What holds on them now (a ban, a mute, a trade lock), and their bans and cautions, newest first. */
const Standing = ({ player }: { player: PlayerDetailResponse }) => {
    const ban = activeBan(player);
    const none = <span className="text-muted">none</span>;

    return (
        <Panel title="Standing">
            <dl>
                <Kv label="Ban">{ban ? <span className="text-bad">{ban.expiresUtc ? `ends ${fromNow(ban.expiresUtc)}` : 'for good'}</span> : none}</Kv>
                <Kv label="Mute">{player.silenced ? <span className="text-warn">{restrictionLabel(player.silenced)}</span> : none}</Kv>
                <Kv label="Trade lock">{player.tradeLocked ? <span className="text-warn">{restrictionLabel(player.tradeLocked)}</span> : none}</Kv>
            </dl>
            <div className="border-t border-line px-4 pt-3 pb-1">
                <Label as="h3">Sanctions ({player.sanctions.length})</Label>
            </div>
            {player.sanctions.length === 0
                ? <p className="px-4 pb-3 text-sm text-muted">No sanctions, ever.</p>
                : (
                        <ul>
                            {player.sanctions.map((sanction, index) => (
                                <li key={index} className="flex flex-col gap-1.5 border-t border-line px-4 py-3 first:border-t-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Badge tone="amber">{sanction.kind}</Badge>
                                        <SanctionState sanction={sanction} />
                                        <span className="ml-auto font-mono text-[11px] text-muted">{formatDateTime(sanction.issuedUtc)}</span>
                                    </div>
                                    <p className="text-sm">{sanction.reason}</p>
                                    <p className="font-mono text-[11px] text-muted">
                                        by {sanction.issuerName ?? 'the console'}
                                        {sanction.expiresUtc ? ` · until ${formatDateTime(sanction.expiresUtc)}` : ' · permanent'}
                                        {sanction.revokedUtc && ` · lifted ${formatDateTime(sanction.revokedUtc)}${sanction.revokedByName ? ` by ${sanction.revokedByName}` : ''}`}
                                    </p>
                                </li>
                            ))}
                        </ul>
                    )}
        </Panel>
    );
};

/** A way to another page of the panel, narrowed to this player. */
const LinkRow = ({ to, icon, label, detail }: { to: string; icon: ReactNode; label: string; detail: string }) => (
    <li className="border-t border-line first:border-t-0">
        <Link to={to} className="flex min-h-12 items-center gap-3 px-4 py-2 hover:bg-subtle/60 [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-muted">
            {icon}
            <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{label}</span>
                <span className="block truncate text-xs text-muted">{detail}</span>
            </span>
            <ChevronRight />
        </Link>
    </li>
);

/** Their rooms and their logs, each on its own page narrowed to them, for staff who may see it. */
const Links = ({ player }: { player: PlayerDetailResponse }) => {
    const me = useMe().data;
    const who = String(player.id);

    if (!me)
        return null;

    return (
        <Panel title="Rooms and logs">
            <ul>
                {me.canViewRooms && (
                    <LinkRow
                        to={`/rooms?${new URLSearchParams({ q: who, by: 'ownerId', page: '1' })}`}
                        icon={<House />}
                        label={`Rooms (${player.roomsOwned.toLocaleString()})`}
                        detail="The rooms they own"
                    />
                )}
                {me.canViewPlayers && (
                    <LinkRow to={`/room-visits?${new URLSearchParams({ player: who })}`} icon={<DoorOpen />} label="Room visits" detail="The rooms they went into" />
                )}
                {me.canViewChatlog && (
                    <LinkRow to={`/chatlog?${new URLSearchParams({ player: who })}`} icon={<MessagesSquare />} label="Chat log" detail="What they said, and what was whispered to them" />
                )}
                {me.canViewCommandLog && (
                    <LinkRow to={`/command-log?${new URLSearchParams({ player: who })}`} icon={<ScrollText />} label="Command log" detail="The commands they ran" />
                )}
            </ul>
        </Panel>
    );
};

/** Their balances, profile and standing, and beside them their rooms and logs and their accounts. */
const Overview = ({ player }: { player: PlayerDetailResponse }) => {
    const canViewRooms = useMe().data?.canViewRooms ?? false;
    const abilities = usePlayerAbilities().data;

    return (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(18rem,2fr)] lg:gap-5">
            <div className="flex min-w-0 flex-col gap-4 lg:gap-5">
                <CurrenciesPanel player={player} />
                <Panel title="Profile">
                    <dl>
                        <Kv label="Status"><span className={player.isOnline ? 'text-good' : 'text-muted'}>{player.isOnline ? 'online' : 'offline'}</span></Kv>
                        {player.currentRoom && (
                            <Kv label="In room">
                                {canViewRooms
                                    ? <Link to={`/rooms/${player.currentRoom.id}`} className="text-accent hover:underline">{player.currentRoom.name}</Link>
                                    : player.currentRoom.name}
                            </Kv>
                        )}
                        <Kv label="Last login">{player.lastLoginUtc ? <span title={formatDateTime(player.lastLoginUtc)}>{fromNow(player.lastLoginUtc)}</span> : 'never'}</Kv>
                        <Kv label="Joined">{formatDateTime(player.joinedUtc)}</Kv>
                        <Kv label="Gender">{player.gender.toLowerCase()}</Kv>
                        <Kv label="Respect" mono>{player.respectPoints.toLocaleString()}</Kv>
                        <Kv label="Rooms owned" mono>{player.roomsOwned.toLocaleString()}</Kv>
                    </dl>
                    <Figure figure={player.figure} />
                </Panel>
                <Standing player={player} />
            </div>
            <div className="flex min-w-0 flex-col gap-4 lg:gap-5">
                <Links player={player} />
                {abilities?.issueTickets && <LoginTicketCard key={`ticket-${player.id}`} playerId={player.id} playerName={player.name} />}
                {player.discord && <DiscordCard playerId={player.id} playerName={player.name} discord={player.discord} canManage={abilities?.manageAccounts ?? false} />}
            </div>
        </div>
    );
};

/**
 * One player as staff look them up. Their card heads both tabs, with the actions on them (alert,
 * sanction, mute, trade lock, disconnect). The overview holds their balances (given and taken
 * here), profile and standing, with ways to their rooms and their chat and command logs; the
 * inventory holds their furniture and badges, with adding either. Each tab is in the path:
 * `/players/5/inventory`.
 */
export const PlayerPage = () => {
    const id = Number(useParams().id);
    const [ tab, toTab ] = usePathTab(TABS);
    const { data: player, error, isPending } = usePlayer(id);
    const me = useMe().data;

    useRememberRecent('player', id, player?.name);

    if (toTab)
        return toTab;

    return (
        <>
            <PageHeader
                title={player?.name ?? `Player #${id}`}
                back={{ to: '/players', label: 'Players' }}
                description={player && `#${player.id} · joined ${fromNow(player.joinedUtc)}`}
                tabs={{ items: TABS.map(value => ({ value, label: TAB_LABELS[value], to: `/players/${id}/${value}` })), value: tab }}
            >
                {player && (
                    <LiveBadge live={player.isOnline}>
                        {player.isOnline
                            ? player.currentRoom ? `ONLINE · ${player.currentRoom.name}` : 'ONLINE'
                            : player.lastLoginUtc ? `SEEN ${fromNow(player.lastLoginUtc).toUpperCase()}` : 'NEVER LOGGED IN'}
                    </LiveBadge>
                )}
                {player && me?.canViewPermissions && (
                    <HeaderLink to={`/permissions/players/${player.id}`} icon={<KeyRound />}>Permissions</HeaderLink>
                )}
            </PageHeader>
            <PageBody className="flex flex-col gap-4 lg:gap-5">
                {isPending && <Loading />}
                {error && <ErrorNotice error={error} />}
                {player && (
                    <>
                        <PlayerCard player={player} />
                        {tab === 'overview' && <Overview player={player} />}
                        {tab === 'inventory' && <InventoryTab player={player} />}
                    </>
                )}
            </PageBody>
        </>
    );
};

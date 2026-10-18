import { Ban, DoorOpen, Ellipsis, Gavel, Megaphone, MessagesSquare, MicOff, Power, Trash2, UserX } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Link, useParams } from 'react-router';

import { useLive } from '#/api/live';
import { useMe, useRoom } from '#/api/queries';
import { type RoomActionResponse, roomCalls, useRoomAction, useRoomVisitors } from '#/api/rooms';
import type { RoomDetailResponse, RoomPlayerRef } from '#/api/types';
import { ask, type Question } from '#/components/confirm';
import { Sheet, SheetItem } from '#/components/Sheet';
import { TabbedPanel } from '#/components/TabbedPanel';
import { Avatar, Badge, Button, EmptyState, ErrorNotice, HeaderLink, IconButton, Input, Kv, Label, Loading, PageBody, Panel, Segmented, Select, Stat, Switch, Textarea, TextLink } from '#/components/ui';
import { fromNow } from '#/lib/time';

import { doorModeLabel, formatDateTime, tradeModeLabel, whoLabel } from './labels';
import { ActionOutcome, RoomHeader } from './RoomHeader';

const MUTE_MINUTES = [
    { value: '5', label: '5 min' },
    { value: '10', label: '10 min' },
    { value: '30', label: '30 min' },
    { value: '60', label: '1 hour' },
];

const BAN_DURATIONS = [
    { value: 'Hour', label: 'An hour' },
    { value: 'Day', label: 'A day' },
    { value: 'Permanent', label: 'For good' },
];

/** Runs an action on the room, after a confirmation when it asks for one. */
type Run = (action: () => Promise<RoomActionResponse>, question?: Question, then?: () => void) => void;

type Role = 'owner' | 'rights' | 'visitor';

const roleOf = (room: RoomDetailResponse, player: RoomPlayerRef): Role =>
    player.id === room.ownerId ? 'owner' : room.rightsHolders.some(x => x.id === player.id) ? 'rights' : 'visitor';

/** Everything staff may do to one player in the room: in a sheet, on a phone and from the row's buttons alike. */
const PersonSheet = ({ room, player, run, onClose }: { room: RoomDetailResponse; player: RoomPlayerRef | null; run: Run; onClose: () => void }) => {
    const calls = roomCalls(room.id);
    const [ minutes, setMinutes ] = useState('5');
    const [ duration, setDuration ] = useState('Hour');

    const act = (action: () => Promise<RoomActionResponse>, question?: Question) => {
        run(action, question);
        onClose();
    };

    return (
        <Sheet title={player ? `${player.name} · #${player.id}` : ''} open={player !== null} onClose={onClose}>
            {player && (
                <>
                    <SheetItem icon={<UserX />} onClick={() => act(() => calls.kick(player.id), { title: `Kick ${player.name} out of the room?`, confirm: 'Kick' })}>Kick out of the room</SheetItem>
                    <div className="flex flex-col gap-2 border-t border-line px-3 py-3">
                        <Label>Mute</Label>
                        <Segmented label="How long to mute" value={minutes} onChange={setMinutes} options={MUTE_MINUTES} />
                        <Button variant="secondary" icon={<MicOff />} onClick={() => act(() => calls.mute(player.id, Number(minutes)))}>Mute {player.name}</Button>
                    </div>
                    <div className="flex flex-col gap-2 border-t border-line px-3 py-3">
                        <Label>Ban from the room</Label>
                        <Segmented label="How long to ban" value={duration} onChange={setDuration} options={BAN_DURATIONS} />
                        <Button variant="danger" icon={<Ban />} onClick={() => act(() => calls.ban({ playerId: player.id }, duration), { title: `Ban ${player.name} from the room?`, confirm: 'Ban' })}>Ban {player.name}</Button>
                    </div>
                </>
            )}
        </Sheet>
    );
};

/** A player in the room: who they are here, and the actions on them. */
const InsideRow = ({ room, player, run, busy, onMore, linked }: { room: RoomDetailResponse; player: RoomPlayerRef; run: Run; busy: boolean; onMore: () => void; linked: boolean }) => {
    const role = roleOf(room, player);
    const calls = roomCalls(room.id);
    const actionable = room.can.moderate && role !== 'owner';

    return (
        <li className="group flex min-h-14 items-center gap-3 border-t border-line px-4 py-2 first:border-t-0">
            <Avatar id={player.id} name={player.name} figure={player.figure} />
            <div className="min-w-0 flex-1">
                {/* The role beside the name, where it lines up whether or not the row has actions; a visitor is the rest, untagged. */}
                <div className="flex min-w-0 items-center gap-2">
                    {linked
                        ? <Link to={`/players/${player.id}`} className="truncate text-sm font-medium hover:text-accent">{player.name}</Link>
                        : <span className="truncate text-sm font-medium">{player.name}</span>}
                    {role !== 'visitor' && <Badge tone={role === 'owner' ? 'accent' : 'neutral'}>{role}</Badge>}
                </div>
                <div className="font-mono text-[11px] text-muted">#{player.id}</div>
            </div>
            {actionable && (
                <>
                    {/* Kick asks, then acts; muting and banning need a length, so they open the sheet with every action. With a mouse, they show on the row it is over. */}
                    <div className="row-actions hidden gap-1 sm:flex">
                        <Button
                            variant="ghost"
                            icon={<UserX />}
                            disabled={busy}
                            aria-label={`Kick ${player.name}`}
                            onClick={() => run(() => calls.kick(player.id), { title: `Kick ${player.name} out of the room?`, confirm: 'Kick' })}
                            className="px-2.5"
                        >
                            Kick
                        </Button>
                        <Button variant="ghost" icon={<Gavel />} disabled={busy} aria-label={`Mute or ban ${player.name}`} onClick={onMore} className="px-2.5">
                            Mute or ban
                        </Button>
                    </div>
                    <IconButton label={`Actions for ${player.name}`} icon={<Ellipsis />} className="sm:hidden" onClick={onMore} />
                </>
            )}
        </li>
    );
};

/** The room as a whole: its switches, a pop-up for everyone in it, and what clears or closes it. */
const RoomControls = ({ room, run, busy }: { room: RoomDetailResponse; run: Run; busy: boolean }) => {
    const calls = roomCalls(room.id);
    const [ alert, setAlert ] = useState('');
    const { can } = room;

    if (!can.staffPick && !can.muteRoom && !can.kickAll && !can.unload && !can.alert)
        return null;

    const handleAlert = (event: FormEvent) => {
        event.preventDefault();
        run(() => calls.alert(alert.trim()), undefined, () => setAlert(''));
    };

    return (
        <Panel title="Room controls" description={room.isLoaded ? undefined : 'Actions on the people inside need the room loaded.'}>
            {(can.muteRoom || can.staffPick) && (
                <div className="divide-y divide-line px-4">
                    {can.muteRoom && <Switch label="Mute everyone" checked={room.isMuted ?? false} disabled={busy || !room.isLoaded} onChange={checked => run(() => calls.setMuted(checked))} />}
                    {can.staffPick && <Switch label="Staff pick" checked={room.staffPick} disabled={busy} onChange={checked => run(() => calls.setStaffPick(checked))} />}
                </div>
            )}
            {can.alert && (
                <form onSubmit={handleAlert} className="flex flex-col gap-2 border-t border-line px-4 py-3">
                    <Label>Room alert</Label>
                    <Textarea
                        value={alert}
                        onChange={event => setAlert(event.target.value)}
                        placeholder="A pop-up for everyone in the room"
                        aria-label="Room alert"
                        rows={2}
                        disabled={!room.isLoaded}
                    />
                    <Button type="submit" variant="secondary" icon={<Megaphone />} disabled={busy || !room.isLoaded || alert.trim() === ''}>Send alert</Button>
                </form>
            )}
            {(can.kickAll || can.unload) && (
                <div className="flex flex-col gap-2 border-t border-line px-4 py-3">
                    <Label className="text-bad">Danger zone</Label>
                    <div className="grid grid-cols-2 gap-2">
                        {can.kickAll && (
                            <Button variant="danger" icon={<DoorOpen />} disabled={busy || !room.isLoaded} onClick={() => run(calls.kickAll, { title: 'Send everyone out of the room?', body: 'Its owner and staff stay.', confirm: 'Send everyone out', danger: true })}>
                                Kick everyone
                            </Button>
                        )}
                        {can.unload && (
                            <Button variant="danger" icon={<Power />} disabled={busy || !room.isLoaded} onClick={() => run(calls.unload, { title: 'Send everyone out and unload the room?', confirm: 'Unload', danger: true })}>
                                Unload
                            </Button>
                        )}
                    </div>
                </div>
            )}
        </Panel>
    );
};

const Rights = ({ room, run, busy }: { room: RoomDetailResponse; run: Run; busy: boolean }) => {
    const calls = roomCalls(room.id);

    if (room.rightsHolders.length === 0)
        return <EmptyState>Nobody has rights besides the owner.</EmptyState>;

    return (
        <>
            <ul>
                {room.rightsHolders.map(player => (
                    <li key={player.id} className="group flex min-h-14 items-center gap-3 border-t border-line px-4 py-2 first:border-t-0">
                        <Avatar id={player.id} name={player.name} figure={player.figure} />
                        <div className="min-w-0 flex-1 truncate text-sm">
                            {player.name}
                            <span className="ml-2 font-mono text-[11px] text-muted">#{player.id}</span>
                        </div>
                        {room.can.manageRights && <Button variant="ghost" icon={<Trash2 />} className="row-actions" disabled={busy} onClick={() => run(() => calls.removeRights(player.id))}>Remove</Button>}
                    </li>
                ))}
            </ul>
            {room.can.manageRights && (
                <div className="border-t border-line p-4">
                    <Button variant="danger" disabled={busy} onClick={() => run(calls.removeAllRights, { title: 'Take everyone\'s rights in this room away?', confirm: 'Remove rights' })}>Remove everyone&apos;s rights</Button>
                </div>
            )}
        </>
    );
};

/** Who went into the room lately, newest first; asked for only when the tab is opened. */
const Visitors = ({ roomId, linked }: { roomId: number; linked: boolean }) => {
    const { data: visits, error, isPending } = useRoomVisitors(roomId);

    if (isPending)
        return <Loading />;

    if (error)
        return <div className="p-4"><ErrorNotice error={error} /></div>;

    if (visits.length === 0)
        return <EmptyState>Nobody has gone into the room lately.</EmptyState>;

    return (
        <ul>
            {visits.map((visit, index) => (
                <li key={index} className="flex min-h-14 items-center gap-3 border-t border-line px-4 py-2 first:border-t-0">
                    <Avatar id={visit.playerId} name={visit.playerName || `#${visit.playerId}`} />
                    <div className="min-w-0 flex-1 truncate text-sm">
                        {linked
                            ? <Link to={`/players/${visit.playerId}`} className="font-medium hover:underline">{visit.playerName || `#${visit.playerId}`}</Link>
                            : <span className="font-medium">{visit.playerName || `#${visit.playerId}`}</span>}
                    </div>
                    <span className="text-xs text-muted" title={formatDateTime(visit.enteredUtc)}>{fromNow(visit.enteredUtc)}</span>
                </li>
            ))}
        </ul>
    );
};

const Bans = ({ room, run, busy }: { room: RoomDetailResponse; run: Run; busy: boolean }) => {
    const calls = roomCalls(room.id);
    const [ name, setName ] = useState('');
    const [ duration, setDuration ] = useState('Hour');

    const handleBan = (event: FormEvent) => {
        event.preventDefault();
        run(() => calls.ban({ name: name.trim() }, duration), { title: `Ban ${name.trim()} from the room?`, confirm: 'Ban' }, () => setName(''));
    };

    return (
        <>
            {room.bans.length === 0
                ? <EmptyState>Nobody is banned.</EmptyState>
                : (
                        <ul>
                            {room.bans.map(ban => (
                                <li key={ban.playerId} className="group flex min-h-14 items-center gap-3 border-t border-line px-4 py-2 first:border-t-0">
                                    <Avatar id={ban.playerId} name={ban.name} figure={ban.figure} />
                                    <div className="min-w-0 flex-1">
                                        <div className="truncate text-sm">{ban.name}</div>
                                        <div className="font-mono text-[11px] text-warn">until {formatDateTime(ban.expiresAtUtc)}</div>
                                    </div>
                                    {room.can.moderate && <Button variant="ghost" className="row-actions" disabled={busy} onClick={() => run(() => calls.unban(ban.playerId))}>Lift</Button>}
                                </li>
                            ))}
                        </ul>
                    )}
            {room.can.moderate && (
                <form onSubmit={handleBan} className="flex flex-wrap gap-2 border-t border-line p-4">
                    <Input value={name} onChange={event => setName(event.target.value)} placeholder="Player name" aria-label="Player to ban" className="min-w-0 flex-[1_1_10rem]" />
                    <Select value={duration} onChange={event => setDuration(event.target.value)} aria-label="How long" className="flex-[1_1_7rem]">
                        {BAN_DURATIONS.map(x => <option key={x.value} value={x.value}>{x.label}</option>)}
                    </Select>
                    <Button type="submit" variant="secondary" icon={<Gavel />} disabled={busy || name.trim() === ''} className="flex-[1_1_6rem]">Ban</Button>
                </form>
            )}
        </>
    );
};

/**
 * One room as it stands, and what staff may do to it: the numbers that matter, who is in it now
 * (with kick, mute and ban), the room as a whole, who holds rights or a ban, who visited lately,
 * and its settings at a glance. On a phone the room's controls come first, a thumb away.
 */
export const RoomPage = () => {
    const id = Number(useParams().id);
    const { data: room, error, isPending } = useRoom(id);
    const action = useRoomAction(id);
    const [ person, setPerson ] = useState<RoomPlayerRef | null>(null);
    const me = useMe().data;
    const canViewPlayers = me?.canViewPlayers ?? false;
    const live = useLive(state => state.connected);

    const run: Run = (fn, question, then) => {
        const go = () => {
            action.mutate(fn);
            then?.();
        };

        if (question)
            ask(question, go);
        else
            go();
    };

    return (
        <>
            <RoomHeader id={id} room={room} tab="overview">
                {me?.canViewChatlog && (
                    <HeaderLink to={`/chatlog?${new URLSearchParams({ room: String(id) })}`} icon={<MessagesSquare />}>Chat</HeaderLink>
                )}
            </RoomHeader>
            <PageBody className="flex flex-col gap-4 lg:gap-5">
                {isPending && <Loading />}
                {error && <ErrorNotice error={error} />}
                <ActionOutcome message={action.data?.message} error={action.error} />
                {room && (
                    <>
                        <section aria-label="At a glance" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                            <Stat
                                label="Occupancy"
                                value={(
                                    <>
                                        {room.playersInside.length}
                                        <span className="text-base text-muted"> / {room.playersMax}</span>
                                    </>
                                )}
                                meter={room.playersMax > 0 ? room.playersInside.length / room.playersMax : 0}
                            />
                            <Stat label="Rights holders" value={room.rightsHolders.length} />
                            <Stat label="Active bans" value={room.bans.length} tone={room.bans.length > 0 ? 'warn' : undefined} />
                            <Stat label="Score" value={room.score} />
                        </section>

                        <div className="flex flex-wrap items-start gap-4 lg:gap-5">
                            <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-4 lg:gap-5">
                                <Panel title={`In the room now (${room.playersInside.length})`} actions={room.isLoaded && !live ? <Label>refreshes every 10 s</Label> : undefined}>
                                    {room.playersInside.length === 0
                                        ? <EmptyState>{room.isLoaded ? 'Nobody is in the room.' : 'The room is not loaded, so nobody is in it.'}</EmptyState>
                                        : (
                                                <ul>
                                                    {room.playersInside.map(player => (
                                                        <InsideRow key={player.id} room={room} player={player} run={run} busy={action.isPending} onMore={() => setPerson(player)} linked={canViewPlayers} />
                                                    ))}
                                                </ul>
                                            )}
                                </Panel>
                                <TabbedPanel
                                    tabs={[
                                        { id: 'rights', label: 'Rights', count: room.rightsHolders.length, content: <Rights room={room} run={run} busy={action.isPending} /> },
                                        { id: 'bans', label: 'Bans', count: room.bans.length, content: <Bans room={room} run={run} busy={action.isPending} /> },
                                        { id: 'visitors', label: 'Visitors', content: <Visitors roomId={room.id} linked={canViewPlayers} /> },
                                    ]}
                                />
                            </div>

                            <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-4 max-lg:order-first lg:gap-5">
                                <RoomControls room={room} run={run} busy={action.isPending} />
                                {/* Only what bears on the people in the room now; everything else is on the Settings tab. */}
                                <Panel title="Who may do what" actions={room.can.editSettings ? <TextLink to={`/rooms/${id}/settings`}>All settings</TextLink> : undefined}>
                                    <dl>
                                        <Kv label="Door">{doorModeLabel(room.doorMode).toLowerCase()}{room.hasPassword ? ' · password set' : ''}</Kv>
                                        <Kv label="Trading">{tradeModeLabel(room.tradeMode).toLowerCase()}</Kv>
                                        <Kv label="Mute · kick · ban">{[ room.whoCanMute, room.whoCanKick, room.whoCanBan ].map(x => whoLabel(x).toLowerCase()).join(' · ')}</Kv>
                                        <Kv label="Last active"><span title={formatDateTime(room.lastActiveUtc)}>{fromNow(room.lastActiveUtc)}</span></Kv>
                                    </dl>
                                </Panel>
                            </div>
                        </div>
                        <PersonSheet room={room} player={person} run={run} onClose={() => setPerson(null)} />
                    </>
                )}
            </PageBody>
        </>
    );
};

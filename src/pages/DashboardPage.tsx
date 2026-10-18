import { ChevronRight, SlidersHorizontal } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';

import { useCommandLog } from '#/api/commandLog';
import { useLive } from '#/api/live';
import { useDashboard, useHotelAbilities, useMe } from '#/api/queries';
import type { AvailabilityPhase } from '#/api/types';
import { Badge, Button, EmptyState, ErrorNotice, Label, LiveBadge, Loading, PageBody, PageHeader, Panel, Stat, TextLink } from '#/components/ui';
import { phaseOf } from '#/layout/availability';
import { useHotelSheet } from '#/layout/hotelSheet';
import { useHubTabs } from '#/layout/nav';
import { fromNow } from '#/lib/time';

import { Outcome } from './CommandLogPage';
import { HotelControls } from './HotelControls';

const TONES = { good: 'green', warn: 'amber', bad: 'red' } as const;

const formatUptime = (startedAtUtc: string, now: number) => {
    const minutes = Math.max(0, Math.floor((now - new Date(startedAtUtc).getTime()) / 60_000));
    const days = Math.floor(minutes / 1440);
    const hours = Math.floor((minutes % 1440) / 60);

    return days > 0 ? `${days}d ${hours}h` : `${hours}h ${minutes % 60}m`;
};

/** The time now, moved on every minute, so a figure counted from it (the uptime) keeps up without a refresh. */
const useMinuteClock = () => {
    const [ now, setNow ] = useState(() => Date.now());

    useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), 60_000);

        return () => window.clearInterval(timer);
    }, []);

    return now;
};

const atTime = (atUtc: string) => new Date(atUtc).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const AvailabilityBadge = ({ phase, atUtc }: { phase: AvailabilityPhase; atUtc: string | null }) => {
    const known = phaseOf(phase);

    return (
        <Badge tone={TONES[known.tone]}>
            <span className="size-1.5 rounded-full bg-current" />
            {known.label}
            {atUtc && <span className="font-normal">at {atTime(atUtc)}</span>}
        </Badge>
    );
};

/** Whether the viewer may do anything to the hotel: send an alert, start maintenance or a shutdown, or set the welcome message. */
const useCanControlHotel = () => {
    const { data: can } = useHotelAbilities();

    return !!can && (can.alert || can.maintenance || can.shutdown || can.welcomeMessage);
};

/**
 * The hotel's state in a compact card, below a laptop's width where the controls are not beside
 * the rooms: whether it is open, and the button that opens the controls in their sheet.
 */
const HotelCard = ({ phase, atUtc }: { phase: AvailabilityPhase; atUtc: string | null }) => {
    const openHotel = useHotelSheet(state => state.setOpen);
    const known = phaseOf(phase);

    return (
        <Panel className="lg:hidden">
            <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                    <Label>Hotel</Label>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                        <AvailabilityBadge phase={phase} atUtc={atUtc} />
                        {known.tone === 'good' && <span className="text-muted">Players can log in.</span>}
                    </div>
                </div>
                <Button variant="secondary" icon={<SlidersHorizontal />} onClick={() => openHotel(true)} className="max-sm:w-full">
                    Hotel controls
                    <ChevronRight className="size-4 text-muted" />
                </Button>
            </div>
        </Panel>
    );
};

const NO_FILTER = { player: '', command: '', outcome: '', source: '' };

/** The last few commands staff and the console ran, newest first: what has been done lately, a click from the whole log. */
const RecentCommands = () => {
    const { data, error } = useCommandLog(NO_FILTER, 1);
    const canViewPlayers = useMe().data?.canViewPlayers ?? false;
    const entries = data?.entries.slice(0, 6);

    return (
        <Panel
            title="Recent commands"
            className="overflow-clip"
            actions={<TextLink to="/command-log">The whole log <ChevronRight /></TextLink>}
        >
            {error && <div className="p-4"><ErrorNotice error={error} /></div>}
            {!data && !error && <Loading />}
            {entries?.length === 0 && <EmptyState>No commands yet.</EmptyState>}
            {entries && entries.length > 0 && (
                <ul>
                    {entries.map(entry => (
                        <li key={entry.id} className="flex min-h-12 items-center gap-3 border-t border-line px-4 py-2 first:border-t-0">
                            <span className="w-24 shrink-0 truncate text-sm font-medium">
                                {entry.playerId === 0
                                    ? <span className="font-normal text-muted">console</span>
                                    : canViewPlayers
                                        ? <Link to={`/players/${entry.playerId}`} className="hover:text-accent">{entry.playerName ?? `#${entry.playerId}`}</Link>
                                        : entry.playerName ?? `#${entry.playerId}`}
                            </span>
                            <span className="min-w-0 flex-1 truncate font-mono text-[13px]">
                                :{entry.command}
                                {entry.arguments && <span className="text-muted"> {entry.arguments}</span>}
                            </span>
                            {/* Most go through: only those that didn't are marked. */}
                            {entry.outcome !== 'completed' && <span className="shrink-0 max-sm:hidden"><Outcome outcome={entry.outcome} /></span>}
                            <span className="shrink-0 text-xs text-muted" title={new Date(entry.atUtc).toLocaleString()}>{fromNow(entry.atUtc)}</span>
                        </li>
                    ))}
                </ul>
            )}
        </Panel>
    );
};

/**
 * The hotel at a glance, where the panel opens: who is on, how many rooms are running, how long the
 * server has been up and what it holds, the busiest rooms, and the hotel's controls for those who
 * may use them (beside the rooms from a laptop up, a button to their sheet below it).
 */
export const DashboardPage = () => {
    const tabs = useHubTabs('overview');
    const { data, error, isPending, dataUpdatedAt } = useDashboard();
    const canViewRooms = useMe().data?.canViewRooms ?? false;
    const canViewCommandLog = useMe().data?.canViewCommandLog ?? false;
    const canControl = useCanControlHotel();
    const live = useLive(state => state.connected);
    const now = useMinuteClock();

    return (
        <>
            <PageHeader
                title="Overview"
                tabs={tabs}
                description={data ? `Turbo ${data.version} · updated ${new Date(dataUpdatedAt).toLocaleTimeString()}` : 'The hotel right now'}
            >
                <span className="max-sm:hidden"><LiveBadge live={live}>{live ? 'LIVE' : 'EVERY 10S'}</LiveBadge></span>
            </PageHeader>
            <PageBody className="flex flex-col gap-4 lg:gap-5">
                {error && <ErrorNotice error={error} />}
                {isPending && <Loading />}
                {data && (
                    <>
                        <section aria-label="At a glance" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                            <Stat label="Players online" value={data.playersOnline.toLocaleString()} />
                            <Stat label="Rooms loaded" value={data.roomsLoaded.toLocaleString()} />
                            <Stat label="Uptime" value={formatUptime(data.startedAtUtc, Math.max(now, dataUpdatedAt))} detail={`since ${new Date(data.startedAtUtc).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}`} />
                            <Stat
                                label="Memory"
                                value={`${data.workingSetMb.toLocaleString()} MB`}
                                detail={`${data.managedMb.toLocaleString()} MB managed · ${data.silosActive}/${data.silosTotal} silos`}
                            />
                        </section>
                        {canControl && <HotelCard phase={data.availability} atUtc={data.availabilityAtUtc} />}
                        <div className="flex flex-wrap items-start gap-4 lg:gap-5">
                            <div className="flex min-w-0 flex-[999_1_480px] flex-col gap-4 lg:gap-5">
                                <Panel title="Busiest rooms">
                                    {data.busiestRooms.length === 0
                                        ? <EmptyState>Nobody is in a room right now.</EmptyState>
                                        : (
                                                <ul>
                                                    {data.busiestRooms.map(room => (
                                                        <li key={room.id} className="flex min-h-14 items-center gap-3 border-t border-line px-4 py-2.5 first:border-t-0">
                                                            <div className="min-w-0 flex-1">
                                                                {canViewRooms
                                                                    ? <Link to={`/rooms/${room.id}`} className="block truncate font-medium hover:text-accent">{room.name}</Link>
                                                                    : <span className="block truncate font-medium">{room.name}</span>}
                                                                <span className="block truncate font-mono text-[11px] text-muted">#{room.id} · {room.ownerName}</span>
                                                            </div>
                                                            <span className="shrink-0 font-mono text-sm tabular-nums">
                                                                {room.population}
                                                                <span className="text-muted">/{room.playersMax}</span>
                                                            </span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                </Panel>
                                {canViewCommandLog && <RecentCommands />}
                            </div>
                            {canControl && (
                                <div className="min-w-0 flex-[1_1_380px] max-lg:hidden">
                                    <HotelControls phase={data.availability} atUtc={data.availabilityAtUtc} />
                                </div>
                            )}
                        </div>
                    </>
                )}
            </PageBody>
        </>
    );
};

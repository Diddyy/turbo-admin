import { House, UserRound } from 'lucide-react';
import { Link, useParams } from 'react-router';

import { type ClientLagRow, type ClientLatencyRow, type ClientPerformanceRow, useClientTelemetryPlayer, useClientTelemetryRoom } from '#/api/telemetry';
import { Row, RowList } from '#/components/RowList';
import { EmptyState, ErrorNotice, HeaderLink, Loading, PageBody, PageHeader, Panel } from '#/components/ui';

import { dayPoints, fps, LOGIN_STEPS, megabytes, ms, NO_PERFORMANCE_HINT, NO_ROOM_FPS_HINT, number, SERIES_1, SERIES_2, useDayRange, when } from './format';
import { DayChartCard, Figure, RangePicker } from './shared';

/** Who sent a report, a link to their client reports; where from, a link to the room's. */
const Who = ({ playerId, playerName, params }: { playerId: number; playerName: string | null; params: string }) => (
    <Link to={`/client-health/players/${playerId}?${params}`} className="truncate hover:underline">{playerName ?? `Player ${playerId}`}</Link>
);

const Where = ({ roomId, roomName, params }: { roomId: number | null; roomName: string | null; params: string }) => (
    roomId == null
        ? <span className="text-muted">-</span>
        : <Link to={`/client-health/rooms/${roomId}?${params}`} className="truncate hover:underline">{roomName ?? `Room ${roomId}`}</Link>
);

const PERFORMANCE_COLUMNS = [
    { label: 'When' },
    { label: 'Who' },
    { label: 'Where' },
    { label: 'Browser' },
    { label: 'FPS', className: 'text-right' },
    { label: 'Memory', className: 'text-right' },
    { label: 'Slow frames', className: 'text-right' },
];

const PerformanceRows = ({ rows, params }: { rows: ClientPerformanceRow[]; params: string }) => (
    rows.length === 0
        ? <EmptyState>{NO_PERFORMANCE_HINT}</EmptyState>
        : (
                <RowList columns="auto minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) repeat(3,auto)" headers={PERFORMANCE_COLUMNS}>
                    {rows.map((x, index) => (
                        <Row key={`${x.at}-${index}`}>
                            <span className="font-mono text-[12px] text-muted">{when(x.at)}</span>
                            <Who playerId={x.playerId} playerName={x.playerName} params={params} />
                            <Where roomId={x.roomId} roomName={x.roomName} params={params} />
                            <span className="truncate" title={x.userAgent}>{`${x.browser}, ${x.os}, ${x.device}`}</span>
                            <Figure label="FPS">{x.fps ? fps(x.fps) : '-'}</Figure>
                            <Figure label="Memory">{x.memoryMb < 0 ? '-' : megabytes(x.memoryMb)}</Figure>
                            <Figure label="Slow frames">{number(x.slowUpdates)}</Figure>
                        </Row>
                    ))}
                </RowList>
            )
);

const LATENCY_COLUMNS = [ { label: 'When' }, { label: 'Who' }, { label: 'Where' }, { label: 'Average', className: 'text-right' }, { label: 'Without spikes', className: 'text-right' }, { label: 'Pings', className: 'text-right' } ];

const LatencyRows = ({ rows, params }: { rows: ClientLatencyRow[]; params: string }) => (
    rows.length === 0
        ? <EmptyState>No latency reports in this range.</EmptyState>
        : (
                <RowList columns="auto minmax(0,1fr) minmax(0,1fr) repeat(3,auto)" headers={LATENCY_COLUMNS}>
                    {rows.map((x, index) => (
                        <Row key={`${x.at}-${index}`}>
                            <span className="font-mono text-[12px] text-muted">{when(x.at)}</span>
                            <Who playerId={x.playerId} playerName={x.playerName} params={params} />
                            <Where roomId={x.roomId} roomName={x.roomName} params={params} />
                            <Figure label="Average">{ms(x.averageMs)}</Figure>
                            <Figure label="Without spikes">{ms(x.validAverageMs)}</Figure>
                            <Figure label="Pings">{number(x.pings)}</Figure>
                        </Row>
                    ))}
                </RowList>
            )
);

const LAG_COLUMNS = [ { label: 'When' }, { label: 'Who' }, { label: 'Where' }, { label: 'Warnings', className: 'text-right' } ];

const LagRows = ({ rows, params }: { rows: ClientLagRow[]; params: string }) => (
    rows.length === 0
        ? <EmptyState>No chat lag in this range.</EmptyState>
        : (
                <RowList columns="auto minmax(0,1fr) minmax(0,1fr) auto" headers={LAG_COLUMNS}>
                    {rows.map((x, index) => (
                        <Row key={`${x.at}-${index}`}>
                            <span className="font-mono text-[12px] text-muted">{when(x.at)}</span>
                            <Who playerId={x.playerId} playerName={x.playerName} params={params} />
                            <Where roomId={x.roomId} roomName={x.roomName} params={params} />
                            <Figure label="Warnings">{number(x.warnings)}</Figure>
                        </Row>
                    ))}
                </RowList>
            )
);

/** One room's client health: frame rate, latency and chat lag per day, and the reports sent in it. */
export const TelemetryRoomPage = () => {
    const roomId = Number(useParams().id);
    const { range, days, setDays, params } = useDayRange();
    const { data, error, isPending } = useClientTelemetryRoom(roomId, range);

    return (
        <>
            <PageHeader
                title={data?.roomName ?? `Room ${roomId}`}
                description="How clients ran in this room"
                back={{ to: `/client-health?${params}`, label: 'Client health' }}
            >
                <HeaderLink to={`/rooms/${roomId}`} icon={<House />}>Open the room</HeaderLink>
            </PageHeader>
            <PageBody className="flex flex-col gap-4 lg:gap-5">
                <div className="flex"><RangePicker days={days} setDays={setDays} /></div>
                {error && <ErrorNotice error={error} />}
                {isPending && <Loading />}
                {data && (
                    <>
                        <div className="grid gap-4 lg:grid-cols-2 lg:gap-5">
                            <DayChartCard
                                title="Frame rate"
                                description="From performance reports and frame rate events sent in the room."
                                series={[ { name: 'Median', color: SERIES_1 }, { name: 'p95', color: SERIES_2 } ]}
                                points={dayPoints(data.days, x => x.fpsP50 > 0 || x.fpsP95 > 0, x => x.fpsP50, x => x.fpsP95)}
                                format={fps}
                                dimmed={false}
                                empty={NO_ROOM_FPS_HINT}
                            />
                            <DayChartCard
                                title="Chat lag warnings"
                                description="Chat lines that came back late in the room."
                                series={[ { name: 'Warnings', color: SERIES_1 } ]}
                                points={dayPoints(data.days, () => true, x => x.lagWarnings)}
                                format={number}
                                dimmed={false}
                            />
                        </div>
                        <Panel title="Chat lag"><LagRows rows={data.lag} params={params} /></Panel>
                        <Panel title="Latency"><LatencyRows rows={data.latency} params={params} /></Panel>
                        <Panel title="Performance"><PerformanceRows rows={data.performance} params={params} /></Panel>
                    </>
                )}
            </PageBody>
        </>
    );
};

const EVENT_COLUMNS = [ { label: 'When' }, { label: 'Event' }, { label: 'Where' }, { label: 'Extra' } ];
const LOGIN_COLUMNS = [ { label: 'When' }, { label: 'Step' }, { label: 'After connecting', className: 'text-right' } ];

/** One player's client reports: how their client ran, the events it logged, their logins. */
export const TelemetryPlayerPage = () => {
    const playerId = Number(useParams().id);
    const { range, days, setDays, params } = useDayRange();
    const { data, error, isPending } = useClientTelemetryPlayer(playerId, range);

    return (
        <>
            <PageHeader
                title={data?.playerName ?? `Player ${playerId}`}
                description="This player's client reports"
                back={{ to: `/client-health?${params}`, label: 'Client health' }}
            >
                <HeaderLink to={`/players/${playerId}`} icon={<UserRound />}>Open the player</HeaderLink>
            </PageHeader>
            <PageBody className="flex flex-col gap-4 lg:gap-5">
                <div className="flex"><RangePicker days={days} setDays={setDays} /></div>
                {error && <ErrorNotice error={error} />}
                {isPending && <Loading />}
                {data && (
                    <>
                        <Panel title="Performance"><PerformanceRows rows={data.performance} params={params} /></Panel>
                        <div className="grid gap-4 lg:grid-cols-2 lg:gap-5">
                            <Panel title="Latency"><LatencyRows rows={data.latency} params={params} /></Panel>
                            <Panel title="Chat lag"><LagRows rows={data.lag} params={params} /></Panel>
                        </div>
                        <Panel title="Events">
                            {data.events.length === 0
                                ? <EmptyState>No events in this range.</EmptyState>
                                : (
                                        <RowList columns="auto minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)" headers={EVENT_COLUMNS}>
                                            {data.events.map((x, index) => (
                                                <Row key={`${x.at}-${index}`}>
                                                    <span className="font-mono text-[12px] text-muted">{when(x.at)}</span>
                                                    <div className="min-w-0">
                                                        <div className="truncate font-medium">{x.action || x.type}</div>
                                                        <div className="truncate font-mono text-[11px] text-muted">{[ x.category, x.type ].filter(Boolean).join(' / ')}</div>
                                                    </div>
                                                    <Where roomId={x.roomId} roomName={x.roomName} params={params} />
                                                    <span className="truncate font-mono text-[12px]">{[ x.extraString, x.extraInt ? String(x.extraInt) : '' ].filter(Boolean).join(', ') || '-'}</span>
                                                </Row>
                                            ))}
                                        </RowList>
                                    )}
                        </Panel>
                        <Panel title="Logins">
                            {data.logins.length === 0
                                ? <EmptyState>No logins in this range.</EmptyState>
                                : (
                                        <RowList columns="auto minmax(0,1fr) auto" headers={LOGIN_COLUMNS}>
                                            {data.logins.map((x, index) => (
                                                <Row key={`${x.at}-${index}`}>
                                                    <span className="font-mono text-[12px] text-muted">{when(x.at)}</span>
                                                    <span>{LOGIN_STEPS[x.step] ?? x.step}</span>
                                                    <Figure label="After connecting">{ms(x.msSinceConnect)}</Figure>
                                                </Row>
                                            ))}
                                        </RowList>
                                    )}
                        </Panel>
                    </>
                )}
            </PageBody>
        </>
    );
};

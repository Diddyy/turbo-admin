import { type ReactNode, useState } from 'react';

import { type PerformancePoint, type PerformanceStage, usePerformance } from '#/api/performance';
import { type ChartPoint, type ChartSeries, ChartTable, LineChart } from '#/components/LineChart';
import { PhoneLabel, Row, SortedRowList } from '#/components/RowList';
import { EmptyState, ErrorNotice, Loading, PageBody, PageHeader, Panel, Segmented, Stat } from '#/components/ui';
import { useHubTabs } from '#/layout/nav';
import type { SortKeys } from '#/lib/sort';

const RANGES = [
    { value: '1', label: '1 hour' },
    { value: '6', label: '6 hours' },
    { value: '24', label: '24 hours' },
];

const SERIES_1 = 'var(--color-series-1)';
const SERIES_2 = 'var(--color-series-2)';

const number = (value: number) => Math.round(value).toLocaleString();
const percent = (value: number) => `${value.toLocaleString(undefined, { maximumFractionDigits: value < 10 ? 1 : 0 })}%`;
const megabytes = (value: number) => `${Math.round(value).toLocaleString()} MB`;
const ms = (value: number) => (value >= 1000 ? `${(value / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} s` : `${Math.round(value).toLocaleString()} ms`);

/** What each measured operation is, in words; the code stays beside it. */
const STAGES: Record<string, string> = {
    'room.entry.direct': 'Entering a room, start to finish',
    'room.entry.navigator': 'Room info for the navigator',
    'room.entry.access': 'Entry: checking access',
    'room.entry.prepare_player': 'Entry: preparing the player',
    'room.entry.view': 'Entry: the room as the player sees it',
    'room.entry.queue_initial_packets': 'Entry: queueing the first packets',
    'room.entry.membership': 'Entry: joining the room',
    'room.entry.subscribe': 'Entry: subscribing to room updates',
    'room.entry.avatar': 'Entry: placing the avatar',
    'room.entry.player_summary': 'Entry: the player\'s summary',
    'room.activate': 'Starting a room',
    'room.hydrate': 'Loading a room',
    'room.load.map': 'Loading: the floor plan',
    'room.load.furniture': 'Loading: furniture',
    'room.load.pets': 'Loading: pets',
    'room.load.bots': 'Loading: bots',
    'room.load.permissions': 'Loading: rights',
    'room.stream.delivery': 'Room updates reaching players',
    'command.execute': 'Chat commands',
};

const VIEWS = [
    { value: 'chart', label: 'Chart' },
    { value: 'table', label: 'Table' },
];

/** One chart in a card, with a switch to the same figures as a table. */
const ChartCard = ({ title, description, series, points, format, max, dimmed }: {
    title: string;
    description: ReactNode;
    series: ChartSeries[];
    points: ChartPoint[];
    format: (value: number) => string;
    max?: number;
    dimmed: boolean;
}) => {
    const [ table, setTable ] = useState(false);

    return (
        <Panel
            title={title}
            description={description}
            actions={(
                <Segmented label={`Show ${title} as`} value={table ? 'table' : 'chart'} onChange={value => setTable(value === 'table')} options={VIEWS} />
            )}
        >
            {points.length === 0
                ? <EmptyState>No figures yet: the first come 10 seconds after the server starts.</EmptyState>
                : table
                    ? <ChartTable label={title} series={series} points={points} format={format} />
                    : <div className="pb-2"><LineChart label={title} series={series} points={points} format={format} max={max} dimmed={dimmed} /></div>}
        </Panel>
    );
};

const pointsOf = (points: PerformancePoint[], ...pick: ((point: PerformancePoint) => number | null)[]): ChartPoint[] =>
    points.map(point => ({ at: new Date(point.atUtc).getTime(), values: pick.map(f => f(point)) }));

const STAGE_COLUMNS = [
    { label: 'Operation', sort: 'operation' },
    { label: 'Times', className: 'text-right', sort: 'times', first: 'desc' as const },
    { label: 'Median', className: 'text-right', sort: 'median', first: 'desc' as const },
    { label: 'p95', className: 'text-right', sort: 'p95', first: 'desc' as const },
    { label: 'Longest', className: 'text-right', sort: 'longest', first: 'desc' as const },
];

const STAGE_KEYS: SortKeys<PerformanceStage> = {
    operation: x => STAGES[x.stage] ?? x.stage,
    times: x => x.count,
    median: x => x.p50Ms,
    p95: x => x.p95Ms,
    longest: x => x.maxMs,
};

/** One figure of an operation: a column of the table from a tablet up, a labelled figure in its row on a phone. */
const StageFigure = ({ label, children }: { label: string; children: ReactNode }) => (
    <span className="font-mono text-[13px] tabular-nums sm:text-right sm:text-sm">
        <PhoneLabel>{`${label} `}</PhoneLabel>
        {children}
    </span>
);

/** The timings of every measured operation over the range, the most frequent first. */
const StageTable = ({ stages }: { stages: PerformanceStage[] }) => (
    stages.length === 0
        ? <EmptyState>Nothing has been measured in this range yet.</EmptyState>
        : (
                <SortedRowList columns="minmax(0,1fr) repeat(4,auto)" headers={STAGE_COLUMNS} rows={stages} keys={STAGE_KEYS} initial={{ sort: 'times', dir: 'desc' }}>
                    {stage => (
                        <Row key={stage.stage}>
                            <div>
                                <div className="font-medium">{STAGES[stage.stage] ?? stage.stage}</div>
                                <div className="truncate font-mono text-[11px] text-muted">{stage.stage}</div>
                            </div>
                            <StageFigure label="Times">{stage.count.toLocaleString()}</StageFigure>
                            <StageFigure label="Median">{ms(stage.p50Ms)}</StageFigure>
                            <StageFigure label="p95">{ms(stage.p95Ms)}</StageFigure>
                            <StageFigure label="Longest">{ms(stage.maxMs)}</StageFigure>
                        </Row>
                    )}
                </SortedRowList>
            )
);

/**
 * How this server has been running: CPU, memory, garbage collection and the thread pool, who is
 * online, and how long rooms take to open and their updates to reach players, over the last hour,
 * six hours or day, and every timed room operation in a table. The server keeps the figures in
 * memory, so they start again when it restarts.
 */
export const PerformancePage = () => {
    const tabs = useHubTabs('overview');
    const [ hours, setHours ] = useState('1');
    const { data, error, isPending, isFetching, isPlaceholderData } = usePerformance(Number(hours));
    const points = data?.points ?? [];
    const latest = points[points.length - 1];
    const dimmed = isFetching && isPlaceholderData;
    const every = data && (data.pointSeconds >= 60 ? `${Math.round(data.pointSeconds / 60)} min` : `${data.pointSeconds} s`);

    return (
        <>
            <PageHeader
                title="Overview"
                tabs={tabs}
                description={data?.recordingSinceUtc
                    ? `This server, sampled every ${data.sampleSeconds} s since ${new Date(data.recordingSinceUtc).toLocaleString()}`
                    : 'How this server is running'}
            />
            <PageBody className="flex flex-col gap-4 lg:gap-5">
                <div className="flex flex-wrap items-center gap-3">
                    <Segmented label="Range" value={hours} onChange={setHours} options={RANGES} />
                    {every && <span className="text-xs text-muted">each point is {every}</span>}
                </div>
                {error && <ErrorNotice error={error} />}
                {isPending && <Loading />}
                {data && (
                    <>
                        <section aria-label="Now" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                            <Stat label="CPU" value={latest ? percent(latest.cpuPercent) : '-'} meter={latest ? latest.cpuPercent / 100 : undefined} tone={latest && latest.cpuPercent >= 85 ? 'bad' : latest && latest.cpuPercent >= 60 ? 'warn' : undefined} />
                            <Stat label="Memory" value={latest ? megabytes(latest.workingSetMb) : '-'} detail={latest && `${megabytes(latest.heapMb)} .NET heap`} />
                            <Stat label="Players online" value={latest ? number(latest.playersOnline) : '-'} detail={latest && `${number(latest.roomsLoaded)} rooms loaded`} />
                            <Stat
                                label="Room entry, p95"
                                value={latest?.roomEntryP95Ms != null ? ms(latest.roomEntryP95Ms) : '-'}
                                detail={latest ? `${number(latest.roomEntries)} entries in the last point` : undefined}
                            />
                        </section>

                        <div className="grid gap-4 lg:grid-cols-2 lg:gap-5">
                            <ChartCard title="CPU" description="Of every core, averaged over each point." series={[ { name: 'CPU', color: SERIES_1 } ]} points={pointsOf(points, x => x.cpuPercent)} format={percent} max={100} dimmed={dimmed} />
                            <ChartCard
                                title="Memory"
                                description="What the process holds, and the part of it that is the .NET heap."
                                series={[ { name: 'Process', color: SERIES_1 }, { name: '.NET heap', color: SERIES_2 } ]}
                                points={pointsOf(points, x => x.workingSetMb, x => x.heapMb)}
                                format={megabytes}
                                dimmed={dimmed}
                            />
                            <ChartCard title="Players online" description="Open sessions on this server." series={[ { name: 'Players', color: SERIES_1 } ]} points={pointsOf(points, x => x.playersOnline)} format={number} dimmed={dimmed} />
                            <ChartCard title="Rooms loaded" description="Rooms running in the hotel." series={[ { name: 'Rooms', color: SERIES_1 } ]} points={pointsOf(points, x => x.roomsLoaded)} format={number} dimmed={dimmed} />
                            <ChartCard
                                title="Room entry time"
                                description="From asking to enter a room to being in it, on the server."
                                series={[ { name: 'Median', color: SERIES_1 }, { name: 'p95', color: SERIES_2 } ]}
                                points={pointsOf(points, x => x.roomEntryP50Ms, x => x.roomEntryP95Ms)}
                                format={ms}
                                dimmed={dimmed}
                            />
                            <ChartCard title="Room updates reaching players" description="From a room publishing an update to a player's session getting it, p95." series={[ { name: 'p95', color: SERIES_1 } ]} points={pointsOf(points, x => x.streamDelayP95Ms)} format={ms} dimmed={dimmed} />
                            <ChartCard title="Thread pool queue" description="Work waiting for a thread. A queue that stays up means the server is behind." series={[ { name: 'Waiting', color: SERIES_1 } ]} points={pointsOf(points, x => x.threadPoolQueue)} format={number} dimmed={dimmed} />
                            <ChartCard title="Garbage collection pauses" description="Share of the time the process was paused to collect garbage." series={[ { name: 'Paused', color: SERIES_1 } ]} points={pointsOf(points, x => x.gcPausePercent)} format={percent} dimmed={dimmed} />
                        </div>

                        <Panel title="Room operations" description={`Every timed operation over the last ${RANGES.find(x => x.value === hours)?.label}. Medians and p95 come from a sample when there were many.`}>
                            <StageTable stages={data.stages} />
                        </Panel>
                    </>
                )}
            </PageBody>
        </>
    );
};

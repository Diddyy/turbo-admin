import { Link, useSearchParams } from 'react-router';

import { type ClientHealthFilter, useClientHealth } from '#/api/telemetry';
import { Row, RowList } from '#/components/RowList';
import { EmptyState, ErrorNotice, Input, Loading, PageBody, PageHeader, Panel, Select, Stat } from '#/components/ui';
import { useHubTabs } from '#/layout/nav';

import { dayPoints, fps, LOGIN_STEPS, megabytes, ms, NO_LAG_HINT, NO_LATENCY_HINT, NO_PERFORMANCE_HINT, NO_ROOM_FPS_HINT, number, SERIES_1, SERIES_2, useDayRange } from './format';
import { DayChartCard, Figure, RangePicker } from './shared';

const DEVICE_COLUMNS = [
    { label: 'Browser' },
    { label: 'Reports', className: 'text-right' },
    { label: 'FPS median', className: 'text-right' },
    { label: 'FPS p95', className: 'text-right' },
    { label: 'Memory', className: 'text-right' },
    { label: 'Latency', className: 'text-right' },
    { label: 'Slow frames', className: 'text-right' },
];

const ROOM_COLUMNS = [
    { label: 'Room' },
    { label: 'Chat lag', className: 'text-right' },
    { label: 'FPS median', className: 'text-right' },
    { label: 'Latency', className: 'text-right' },
    { label: 'Player days', className: 'text-right' },
];

const LOGIN_COLUMNS = [
    { label: 'Step' },
    { label: 'Logins', className: 'text-right' },
    { label: 'Of the first', className: 'text-right' },
    { label: 'Median', className: 'text-right' },
    { label: 'p95', className: 'text-right' },
];

/** A drop-down of what was reported, "every ..." first. */
const FilterSelect = ({ label, value, values, onChange }: { label: string; value: string; values: string[]; onChange: (value: string) => void }) => (
    <Select aria-label={label} value={value} onChange={event => onChange(event.target.value)}>
        <option value="">{`Every ${label.toLowerCase()}`}</option>
        {values.map(x => <option key={x} value={x}>{x}</option>)}
    </Select>
);

/**
 * How the players' clients run, from what they report with Habbo's own messages: frame rate, memory
 * and latency per day, per browser and device, the rooms with the most chat lag, and how long logins
 * take and where they stop. Filters by browser, system, device and room; a room or a player opens
 * their own reports.
 */
export const ClientHealthPage = () => {
    const tabs = useHubTabs('overview');
    const { range, days, setDays, params } = useDayRange();
    const [ search, setSearch ] = useSearchParams();
    const filter: ClientHealthFilter = {
        ...range,
        browser: search.get('browser') ?? undefined,
        os: search.get('os') ?? undefined,
        device: search.get('device') ?? undefined,
        room: Number(search.get('room')) || undefined,
    };
    const { data, error, isPending, isFetching, isPlaceholderData } = useClientHealth(filter);
    const dimmed = isFetching && isPlaceholderData;
    const set = (key: string, value: string) => setSearch((prev) => {
        const next = new URLSearchParams(prev);

        if (value)
            next.set(key, value);
        else
            next.delete(key);

        return next;
    }, { replace: true });
    const totals = data && {
        reports: data.days.reduce((sum, day) => sum + day.reports, 0),
        lag: data.days.reduce((sum, day) => sum + day.lagWarnings, 0),
        latest: [ ...data.days ].reverse().find(day => day.reports > 0 || day.latencyReports > 0),
    };
    const firstStep = data?.login[0]?.sessions ?? 0;

    return (
        <>
            <PageHeader title="Overview" tabs={tabs} description="How the players' clients run, from what they report" />
            <PageBody className="flex flex-col gap-4 lg:gap-5">
                <div className="flex flex-wrap items-center gap-2">
                    <RangePicker days={days} setDays={setDays} />
                    {data && (
                        <>
                            <FilterSelect label="Browser" value={filter.browser ?? ''} values={data.filters.browsers} onChange={value => set('browser', value)} />
                            <FilterSelect label="System" value={filter.os ?? ''} values={data.filters.oses} onChange={value => set('os', value)} />
                            <FilterSelect label="Device" value={filter.device ?? ''} values={data.filters.devices} onChange={value => set('device', value)} />
                        </>
                    )}
                    <Input
                        aria-label="Room id"
                        placeholder="Room id"
                        inputMode="numeric"
                        className="w-28"
                        defaultValue={filter.room ?? ''}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter')
                                set('room', event.currentTarget.value.replace(/\D/g, ''));
                        }}
                        onBlur={event => set('room', event.currentTarget.value.replace(/\D/g, ''))}
                    />
                </div>
                {error && <ErrorNotice error={error} />}
                {isPending && <Loading />}
                {data && totals && (
                    <>
                        <section aria-label="Over the range" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                            <Stat label="Frame rate, median" value={totals.latest?.fpsP50 ? fps(totals.latest.fpsP50) : '-'} detail={totals.latest && `p95 ${fps(totals.latest.fpsP95)}, latest day`} />
                            <Stat label="Latency, median" value={totals.latest?.latencyP50Ms ? ms(totals.latest.latencyP50Ms) : '-'} detail={totals.latest && `p95 ${ms(totals.latest.latencyP95Ms)}, latest day`} />
                            <Stat label="Performance reports" value={number(totals.reports)} detail={`${data.devices.length} browser and device kinds`} />
                            <Stat label="Chat lag warnings" value={number(totals.lag)} tone={totals.lag > 0 ? 'warn' : undefined} detail={`in ${data.rooms.filter(x => x.lagWarnings > 0).length} rooms`} />
                        </section>

                        <div className="grid gap-4 lg:grid-cols-2 lg:gap-5">
                            <DayChartCard
                                title="Frame rate"
                                description={filter.room ? 'In this room, from performance reports and frame rate events.' : 'Frames per second, from performance reports.'}
                                series={[ { name: 'Median', color: SERIES_1 }, { name: 'p95', color: SERIES_2 } ]}
                                points={dayPoints(data.days, x => x.fpsP50 > 0 || x.fpsP95 > 0, x => x.fpsP50, x => x.fpsP95)}
                                format={fps}
                                dimmed={dimmed}
                                empty={filter.room ? NO_ROOM_FPS_HINT : NO_PERFORMANCE_HINT}
                            />
                            <DayChartCard
                                title="Latency"
                                description="The average ping of each latency test."
                                series={[ { name: 'Median', color: SERIES_1 }, { name: 'p95', color: SERIES_2 } ]}
                                points={dayPoints(data.days, x => x.latencyReports > 0, x => x.latencyP50Ms, x => x.latencyP95Ms)}
                                format={ms}
                                dimmed={dimmed}
                                empty={NO_LATENCY_HINT}
                            />
                            {!filter.room && (
                                <DayChartCard
                                    title="Client memory"
                                    description="What the client holds, where the browser says."
                                    series={[ { name: 'Median', color: SERIES_1 }, { name: 'p95', color: SERIES_2 } ]}
                                    points={dayPoints(data.days, x => x.reports > 0, x => x.memoryP50Mb, x => x.memoryP95Mb)}
                                    format={megabytes}
                                    dimmed={dimmed}
                                    empty={NO_PERFORMANCE_HINT}
                                />
                            )}
                            <DayChartCard
                                title="Chat lag warnings"
                                description="Chat lines that came back to their sender late, every browser."
                                series={[ { name: 'Warnings', color: SERIES_1 } ]}
                                points={dayPoints(data.days, () => totals.lag > 0, x => x.lagWarnings)}
                                format={number}
                                dimmed={dimmed}
                                empty={NO_LAG_HINT}
                            />
                        </div>

                        <Panel title="Browsers and devices" description="Read from each report's user agent. Percentiles over several days weight each day by its reports.">
                            {data.devices.length === 0
                                ? <EmptyState>{NO_PERFORMANCE_HINT}</EmptyState>
                                : (
                                        <RowList columns="minmax(0,1fr) repeat(6,auto)" headers={DEVICE_COLUMNS}>
                                            {data.devices.map(x => (
                                                <Row key={`${x.browser}/${x.os}/${x.device}`}>
                                                    <div>
                                                        <div className="font-medium">{x.browser}</div>
                                                        <div className="truncate text-[11px] text-muted">{`${x.os}, ${x.device}`}</div>
                                                    </div>
                                                    <Figure label="Reports">{number(x.reports)}</Figure>
                                                    <Figure label="FPS median">{x.fpsP50 ? fps(x.fpsP50) : '-'}</Figure>
                                                    <Figure label="FPS p95">{x.fpsP95 ? fps(x.fpsP95) : '-'}</Figure>
                                                    <Figure label="Memory">{x.reports ? megabytes(x.memoryP50Mb) : '-'}</Figure>
                                                    <Figure label="Latency">{x.latencyReports ? ms(x.latencyP50Ms) : '-'}</Figure>
                                                    <Figure label="Slow frames">{number(x.slowUpdates)}</Figure>
                                                </Row>
                                            ))}
                                        </RowList>
                                    )}
                        </Panel>

                        <div className="grid gap-4 lg:grid-cols-2 lg:gap-5">
                            <Panel title="Rooms" description="The most chat lag first. A room opens its own reports.">
                                {data.rooms.length === 0
                                    ? <EmptyState>No room reported anything in this range.</EmptyState>
                                    : (
                                            <RowList columns="minmax(0,1fr) repeat(4,auto)" headers={ROOM_COLUMNS}>
                                                {data.rooms.map(x => (
                                                    <Row key={x.roomId}>
                                                        <Link to={`/client-health/rooms/${x.roomId}?${params}`} className="min-w-0 hover:underline">
                                                            <div className="truncate font-medium">{x.roomName ?? `Room ${x.roomId}`}</div>
                                                            <div className="font-mono text-[11px] text-muted">{x.roomId}</div>
                                                        </Link>
                                                        <Figure label="Chat lag">{number(x.lagWarnings)}</Figure>
                                                        <Figure label="FPS median">{x.fpsSamples ? fps(x.fpsP50) : '-'}</Figure>
                                                        <Figure label="Latency">{x.latencyReports ? ms(x.latencyP50Ms) : '-'}</Figure>
                                                        <Figure label="Player days">{number(x.playerDays)}</Figure>
                                                    </Row>
                                                ))}
                                            </RowList>
                                        )}
                            </Panel>
                            <Panel title="Logins, as the server sees them" description="How many connections reached each step, and how long after the socket opened. Habbo's client tells its own steps only to its web page, so these are the server's.">
                                {firstStep === 0
                                    ? <EmptyState>No logins in this range.</EmptyState>
                                    : (
                                            <RowList columns="minmax(0,1fr) repeat(4,auto)" headers={LOGIN_COLUMNS}>
                                                {data.login.map(x => (
                                                    <Row key={x.step}>
                                                        <div>
                                                            <div className="font-medium">{LOGIN_STEPS[x.step] ?? x.step}</div>
                                                            <div className="truncate font-mono text-[11px] text-muted">{x.step}</div>
                                                        </div>
                                                        <Figure label="Logins">{number(x.sessions)}</Figure>
                                                        <Figure label="Of the first">{`${Math.round((x.sessions / firstStep) * 100)}%`}</Figure>
                                                        <Figure label="Median">{x.sessions ? ms(x.p50Ms) : '-'}</Figure>
                                                        <Figure label="p95">{x.sessions ? ms(x.p95Ms) : '-'}</Figure>
                                                    </Row>
                                                ))}
                                            </RowList>
                                        )}
                            </Panel>
                        </div>
                        <p className="text-xs text-muted">
                            {`Raw reports are kept ${data.rawRetentionDays || 'every'} days; a room's or a player's reports reach back that far, the daily figures further.`}
                        </p>
                    </>
                )}
            </PageBody>
        </>
    );
};

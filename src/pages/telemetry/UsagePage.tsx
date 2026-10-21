import { useState } from 'react';

import { useClientFunnel, useClientUsage } from '#/api/telemetry';
import { Row, RowList } from '#/components/RowList';
import { Button, Chip, EmptyState, ErrorNotice, Loading, PageBody, PageHeader, Panel, Stat } from '#/components/ui';
import { useHubTabs } from '#/layout/nav';

import { dayPoints, number, SERIES_1, SERIES_2, useDayRange } from './format';
import { DayChartCard, Figure, RangePicker } from './shared';

const EVENT_COLUMNS = [
    { label: 'Event' },
    { label: 'Times', className: 'text-right' },
    { label: 'Player days', className: 'text-right' },
    { label: '' },
];

const FUNNEL_COLUMNS = [
    { label: 'Step' },
    { label: 'Players', className: 'text-right' },
    { label: 'Of the first', className: 'text-right' },
];

const keyOf = (x: { category: string; type: string; action: string }) => `${x.category}|${x.type}|${x.action}`;

const nameOf = (key: string) => key.split('|').filter(part => part && part !== '*').join(' / ');

/**
 * What players use, from the events their clients log with Habbo's own EventLog: events per day,
 * the most logged and their categories, and a funnel of up to six events: how many players logged
 * each one and every one before it.
 */
export const UsagePage = () => {
    const tabs = useHubTabs('overview');
    const { range, days, setDays } = useDayRange();
    const [ category, setCategory ] = useState('');
    const [ steps, setSteps ] = useState<string[]>([]);
    const { data, error, isPending, isFetching, isPlaceholderData } = useClientUsage(range, category);
    const funnel = useClientFunnel(range, steps);
    const dimmed = isFetching && isPlaceholderData;
    const total = data?.days.reduce((sum, day) => sum + day.events, 0) ?? 0;
    const firstStep = funnel.data?.[0]?.players ?? 0;

    return (
        <>
            <PageHeader title="Overview" tabs={tabs} description="What players use, from the events their clients log" />
            <PageBody className="flex flex-col gap-4 lg:gap-5">
                <div className="flex flex-wrap items-center gap-2">
                    <RangePicker days={days} setDays={setDays} />
                </div>
                {error && <ErrorNotice error={error} />}
                {isPending && <Loading />}
                {data && (
                    <>
                        <section aria-label="Over the range" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                            <Stat label="Events" value={number(total)} detail={category ? `in ${category}` : 'every category'} />
                            <Stat label="Kinds of event" value={number(data.top.length)} detail="the 50 most logged are listed" />
                            <Stat label="Categories" value={number(data.categories.length)} />
                            <Stat compact label="Most logged" value={data.top[0] ? nameOf(keyOf(data.top[0])) : '-'} detail={data.top[0] && `${number(data.top[0].count)} times`} />
                        </section>

                        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Category">
                            <Chip active={category === ''} onClick={() => setCategory('')}>Every category</Chip>
                            {data.categories.map(x => (
                                <Chip key={x.category} active={category === x.category} onClick={() => setCategory(x.category)}>
                                    {`${x.category} ${number(x.count)}`}
                                </Chip>
                            ))}
                        </div>

                        <DayChartCard
                            title="Events per day"
                            description="Every event clients logged, and the most players of any one event that day."
                            series={[ { name: 'Events', color: SERIES_1 }, { name: 'Players', color: SERIES_2 } ]}
                            points={dayPoints(data.days, () => true, x => x.events, x => x.players)}
                            format={number}
                            dimmed={dimmed}
                        />

                        <div className="grid gap-4 lg:grid-cols-2 lg:gap-5">
                            <Panel title="Most logged events" description="Add an event to the funnel to see how many players went on to the next.">
                                {data.top.length === 0
                                    ? <EmptyState>No events in this range.</EmptyState>
                                    : (
                                            <RowList columns="minmax(0,1fr) repeat(3,auto)" headers={EVENT_COLUMNS}>
                                                {data.top.map((x) => {
                                                    const key = keyOf(x);

                                                    return (
                                                        <Row key={key}>
                                                            <div className="min-w-0">
                                                                <div className="truncate font-medium">{x.action || x.type || '-'}</div>
                                                                <div className="truncate font-mono text-[11px] text-muted">{[ x.category, x.type ].filter(Boolean).join(' / ')}</div>
                                                            </div>
                                                            <Figure label="Times">{number(x.count)}</Figure>
                                                            <Figure label="Player days">{number(x.playerDays)}</Figure>
                                                            <Button
                                                                variant="secondary"
                                                                disabled={steps.includes(key) || steps.length >= 6}
                                                                onClick={() => setSteps([ ...steps, key ])}
                                                            >
                                                                Add to funnel
                                                            </Button>
                                                        </Row>
                                                    );
                                                })}
                                            </RowList>
                                        )}
                            </Panel>
                            <Panel
                                title="Funnel"
                                description="Players who logged each event and every one before it, in the range."
                                actions={steps.length > 0 && <Button variant="secondary" onClick={() => setSteps([])}>Clear</Button>}
                            >
                                {steps.length === 0
                                    ? <EmptyState>Add events from the list to build a funnel.</EmptyState>
                                    : funnel.error
                                        ? <ErrorNotice error={funnel.error} />
                                        : (
                                                <RowList columns="minmax(0,1fr) repeat(2,auto)" headers={FUNNEL_COLUMNS}>
                                                    {(funnel.data ?? []).map((x, index) => (
                                                        <Row key={`${index}-${keyOf(x)}`}>
                                                            <div className="min-w-0 truncate font-medium">{`${index + 1}. ${nameOf(keyOf(x))}`}</div>
                                                            <Figure label="Players">{number(x.players)}</Figure>
                                                            <Figure label="Of the first">{firstStep ? `${Math.round((x.players / firstStep) * 100)}%` : '-'}</Figure>
                                                        </Row>
                                                    ))}
                                                </RowList>
                                            )}
                            </Panel>
                        </div>
                        <p className="text-xs text-muted">{`Funnels read the raw events, kept ${data.rawRetentionDays || 'every'} days.`}</p>
                    </>
                )}
            </PageBody>
        </>
    );
};

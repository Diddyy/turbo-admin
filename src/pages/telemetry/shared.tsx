import { type ReactNode, useState } from 'react';

import { type ChartPoint, type ChartSeries, ChartTable, LineChart } from '#/components/LineChart';
import { EmptyState, Panel, Segmented } from '#/components/ui';

import { dateOf, RANGES } from './format';

export const RangePicker = ({ days, setDays }: { days: string; setDays: (days: string) => void }) => (
    <Segmented label="Range" value={days} onChange={setDays} options={RANGES} />
);

const VIEWS = [
    { value: 'chart', label: 'Chart' },
    { value: 'table', label: 'Table' },
];

/** One chart of days in a card, with a switch to the same figures as a table. */
export const DayChartCard = ({ title, description, series, points, format, dimmed }: {
    title: string;
    description: ReactNode;
    series: ChartSeries[];
    points: ChartPoint[];
    format: (value: number) => string;
    dimmed: boolean;
}) => {
    const [ table, setTable ] = useState(false);
    const empty = points.every(point => point.values.every(value => value === null));

    return (
        <Panel
            title={title}
            description={description}
            actions={<Segmented label={`Show ${title} as`} value={table ? 'table' : 'chart'} onChange={value => setTable(value === 'table')} options={VIEWS} />}
        >
            {empty
                ? <EmptyState>Nothing reported in this range.</EmptyState>
                : table
                    ? <ChartTable label={title} series={series} points={points} format={format} timeFormat={dateOf} />
                    : <div className="pb-2"><LineChart label={title} series={series} points={points} format={format} dimmed={dimmed} timeFormat={dateOf} /></div>}
        </Panel>
    );
};

/** One figure of a row: a column of the table from a tablet up, a labelled figure in its row on a phone. */
export const Figure = ({ label, children }: { label: string; children: ReactNode }) => (
    <span className="font-mono text-[13px] tabular-nums sm:text-right sm:text-sm">
        <span className="text-muted sm:hidden">{`${label} `}</span>
        {children}
    </span>
);

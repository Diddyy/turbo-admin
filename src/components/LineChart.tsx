import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { cx } from '#/lib/cx';

/** One line: its name (for the legend, tooltip and table) and its colour token. */
export interface ChartSeries {
    name: string;
    color: string;
}

/** One x position: its time, and a value per series (null where nothing was measured). */
export interface ChartPoint {
    at: number;
    values: (number | null)[];
}

const HEIGHT = 168;
const AXIS_TEXT = { fill: 'var(--color-muted)', fontSize: 10, fontFamily: 'var(--font-mono)' };

const timeOf = (at: number) => new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/** The series' keys in a row of chart data. */
const keyOf = (index: number) => `s${index}`;

/** One readout for every series at the time under the pointer: value first, then whose it is. */
const Readout = ({ active, payload, label, series, format, timeFormat }: {
    active?: boolean;
    payload?: readonly { payload?: unknown }[];
    label?: string | number;
    series: ChartSeries[];
    format: (value: number) => string;
    timeFormat: (at: number) => string;
}) => {
    if (!active || !payload?.length)
        return null;

    const row = payload[0]!.payload as Record<string, number | null>;

    return (
        <div className="min-w-36 rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg">
            <div className="mb-1 font-mono text-[11px] text-muted">{timeFormat(Number(label))}</div>
            {series.map((s, index) => {
                const value = row[keyOf(index)];

                return (
                    <div key={s.name} className="flex items-center gap-2">
                        <span className="h-0.5 w-3 shrink-0 rounded-full" style={{ background: s.color }} />
                        <span className="font-mono font-semibold text-ink tabular-nums">{value == null ? '-' : format(value)}</span>
                        {series.length > 1 && <span className="text-muted">{s.name}</span>}
                    </div>
                );
            })}
        </div>
    );
};

/**
 * A line chart of values over time: 2px lines on hairline gridlines, one y axis from 0 (`max`
 * fixes its top, as for a percentage), a 10% wash under a lone series with its latest value
 * labelled at the end. The crosshair snaps to the nearest time under the pointer, or to the one
 * the arrow keys pick once the chart has focus, and one readout lists every series there. Two or
 * more series get a legend. `format` writes a value with its unit; {@link ChartTable} shows the
 * same figures as a table.
 */
export const LineChart = ({ label, series, points, format, max, dimmed = false, timeFormat = timeOf }: {
    label: string;
    series: ChartSeries[];
    points: ChartPoint[];
    format: (value: number) => string;
    max?: number;
    dimmed?: boolean;
    /** How an x position is written: a time of day unless given (a date, for points a day apart). */
    timeFormat?: (at: number) => string;
}) => {
    const data = points.map(point => Object.fromEntries([ [ 'at', point.at ], ...point.values.map((value, index) => [ keyOf(index), value ]) ]));
    const last = points.length - 1;
    const lone = series.length === 1 ? series[0] : undefined;

    return (
        <div role="figure" aria-label={label} className={cx('transition-opacity', dimmed && 'opacity-60')}>
            {series.length > 1 && (
                <ul className="flex flex-wrap gap-x-4 gap-y-1 px-4 pt-3 text-xs text-muted">
                    {series.map(s => (
                        <li key={s.name} className="flex items-center gap-1.5">
                            <span className="h-0.5 w-3.5 rounded-full" style={{ background: s.color }} />
                            {s.name}
                        </li>
                    ))}
                </ul>
            )}
            <ResponsiveContainer width="100%" height={HEIGHT}>
                <ComposedChart data={data} margin={{ top: 12, right: 56, bottom: 0, left: 0 }} accessibilityLayer>
                    <CartesianGrid vertical={false} stroke="var(--color-line)" />
                    <XAxis
                        dataKey="at"
                        type="number"
                        scale="time"
                        domain={[ 'dataMin', 'dataMax' ]}
                        tickFormatter={timeFormat}
                        tick={AXIS_TEXT}
                        axisLine={false}
                        tickLine={false}
                        minTickGap={48}
                    />
                    <YAxis
                        domain={[ 0, max ?? 'auto' ]}
                        tickFormatter={format}
                        tick={AXIS_TEXT}
                        axisLine={false}
                        tickLine={false}
                        tickCount={5}
                        width={56}
                        allowDecimals={false}
                    />
                    <Tooltip
                        content={props => <Readout {...props} series={series} format={format} timeFormat={timeFormat} />}
                        cursor={{ stroke: 'var(--color-muted)', strokeWidth: 1 }}
                        isAnimationActive={false}
                    />
                    {lone && <Area dataKey={keyOf(0)} type="linear" stroke="none" fill={lone.color} fillOpacity={0.1} isAnimationActive={false} activeDot={false} />}
                    {series.map((s, index) => (
                        <Line
                            key={s.name}
                            dataKey={keyOf(index)}
                            name={s.name}
                            type="linear"
                            stroke={s.color}
                            strokeWidth={2}
                            strokeLinejoin="round"
                            strokeLinecap="round"
                            connectNulls={false}
                            isAnimationActive={false}
                            activeDot={{ r: 4, fill: s.color, stroke: 'var(--color-surface)', strokeWidth: 2 }}
                            // The latest value of a lone series: a dot and its value at the end.
                            dot={lone
                                ? ({ cx, cy, index }) => (index === last && cy != null
                                        ? <circle key="end" cx={cx} cy={cy} r={4} fill={s.color} stroke="var(--color-surface)" strokeWidth={2} />
                                        : <g key={index} />)
                                : false}
                            label={lone
                                ? ({ x, y, index, value }) => (index === last && value != null
                                        ? <text key="end" x={Number(x) + 8} y={Number(y)} dy="0.32em" fill="var(--color-ink)" fontSize={11} fontFamily="var(--font-mono)" fontWeight={500}>{format(Number(value))}</text>
                                        : <g key={index} />)
                                : false}
                        />
                    ))}
                </ComposedChart>
            </ResponsiveContainer>
        </div>
    );
};

/** The chart's figures as a table, newest first, for reading without the chart. */
export const ChartTable = ({ label, series, points, format, timeFormat = timeOf }: { label: string; series: ChartSeries[]; points: ChartPoint[]; format: (value: number) => string; timeFormat?: (at: number) => string }) => (
    <div className="max-h-[168px] overflow-y-auto">
        <table className="w-full text-xs">
            <caption className="sr-only">{label}</caption>
            <thead className="sticky top-0 bg-surface text-muted">
                <tr>
                    <th scope="col" className="px-4 py-1.5 text-left font-medium">Time</th>
                    {series.map(s => <th key={s.name} scope="col" className="px-4 py-1.5 text-right font-medium">{s.name}</th>)}
                </tr>
            </thead>
            <tbody className="font-mono tabular-nums">
                {[ ...points ].reverse().map(point => (
                    <tr key={point.at} className="border-t border-line">
                        <td className="px-4 py-1">{timeFormat(point.at)}</td>
                        {point.values.map((value, i) => <td key={i} className="px-4 py-1 text-right">{value === null ? '-' : format(value)}</td>)}
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);

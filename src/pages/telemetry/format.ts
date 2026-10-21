import { useSearchParams } from 'react-router';

import type { DayRange } from '#/api/telemetry';
import type { ChartPoint } from '#/components/LineChart';

export const SERIES_1 = 'var(--color-series-1)';
export const SERIES_2 = 'var(--color-series-2)';

export const RANGES = [
    { value: '1', label: 'Today' },
    { value: '7', label: '7 days' },
    { value: '30', label: '30 days' },
    { value: '90', label: '90 days' },
    { value: '365', label: '1 year' },
];

/** A UTC day as the API writes it. */
const dayOf = (date: Date) => date.toISOString().slice(0, 10);

/**
 * The range of days the page shows, kept in the address (`?days=7`) so a room's or a player's
 * page opened from it shows the same days, and a link says what was looked at.
 */
export const useDayRange = (): { range: DayRange; days: string; setDays: (days: string) => void; params: string } => {
    const [ search, setSearch ] = useSearchParams();
    const days = RANGES.some(x => x.value === search.get('days')) ? search.get('days')! : '7';
    const to = new Date();
    const from = new Date(to.getTime() - (Number(days) - 1) * 86_400_000);

    return {
        range: { from: dayOf(from), to: dayOf(to) },
        days,
        setDays: value => setSearch((prev) => {
            const next = new URLSearchParams(prev);
            next.set('days', value);
            return next;
        }, { replace: true }),
        params: `days=${days}`,
    };
};

export const number = (value: number) => Math.round(value).toLocaleString();
export const fps = (value: number) => `${Math.round(value)} fps`;
export const megabytes = (value: number) => `${Math.round(value).toLocaleString()} MB`;
export const ms = (value: number) => (value >= 1000 ? `${(value / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} s` : `${Math.round(value).toLocaleString()} ms`);

/** A day on a chart's axis and in its readout. */
export const dateOf = (at: number) => new Date(at).toLocaleDateString([], { day: 'numeric', month: 'short', timeZone: 'UTC' });

export const when = (iso: string) => new Date(iso).toLocaleString();

/** Days as chart points, a value per series; a day nothing was reported on is a gap, not a zero. */
export const dayPoints = <T extends { day: string }>(days: T[], has: (day: T) => boolean, ...pick: ((day: T) => number)[]): ChartPoint[] =>
    days.map(day => ({ at: Date.parse(`${day.day}T00:00:00Z`), values: pick.map(f => (has(day) ? f(day) : null)) }));

/** What each login step Habbo's client names is, in words; the step stays beside it. */
export const LOGIN_STEPS: Record<string, string> = {
    'client.init.socket.ok': 'Connected',
    'client.init.handshake.start': 'Handshake started',
    'client.init.handshake.ok': 'Handshake done',
    'client.init.auth.ok': 'Logged in',
    'client.init.room.enter': 'First room entered',
    'client.init.auth.fail': 'Ticket refused',
};

/**
 * Why a client reports nothing, when it does not: Habbo's own external variables never send a
 * performance report (performancetest.interval and tracking.framerate.reportInterval.seconds are
 * 2147483647), so a hotel turns them on in its variables.
 */
export const NO_PERFORMANCE_HINT = 'No performance reports in this range. Clients send them only when the hotel\'s external variables set performancetest.interval (seconds between reports, 300 for example; Habbo\'s own is 2147483647, never), up to performancetest.reportlimit times.';

export const NO_ROOM_FPS_HINT = 'No frame rate in this range. Clients send a room\'s frame rate when the hotel\'s external variables set tracking.framerate.reportInterval.seconds (300 for example; Habbo\'s own is 2147483647, never), or with performance reports (performancetest.interval).';

export const NO_LAG_HINT = 'No chat lag in this range. Clients report chat lines that come back late only when the hotel\'s external variables set lagWarningLog.enabled=1 (Habbo\'s own does), at most every lagWarningLog.interval.seconds (10 by default).';

export const NO_LATENCY_HINT = 'No latency reports in this range. Clients test their ping every latencytest.interval ms (20000, the default and Habbo\'s own; below 1 turns it off) and report after latencytest.report.index pings (Habbo\'s own: 3, the default 100).';

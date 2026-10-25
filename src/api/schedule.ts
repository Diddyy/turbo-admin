import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, post } from './client';

/** How a scheduled task's run ended. `Lost`: its server went away while it ran. */
export type ScheduledTaskOutcome = 'Succeeded' | 'Failed' | 'Cancelled' | 'Lost';

/** One plugin's scheduled task (turbo-cloud `docs/plugin-scheduler.md`). Times are UTC. */
export interface ScheduledTask {
    /** `<plugin key>.<name>`. */
    key: string;
    plugin: string;
    /** As written (`0 18 * * MON`, `00:05:00`); null for a task that runs only on Run now. */
    schedule: string | null;
    /** The schedule in words ("Mondays 18:00"). */
    description: string | null;
    /** Why the schedule can't be read; the task then runs only on Run now. */
    scheduleError: string | null;
    nextRunAt: string | null;
    lastRunAt: string | null;
    lastDurationMs: number | null;
    lastOutcome: ScheduledTaskOutcome | null;
    lastError: string | null;
    lastManual: boolean;
    /** When the run in progress started; null when none is. */
    runningSince: string | null;
    /** Runs skipped since the server started because the one before was still going. */
    skipped: number;
    /** How many servers have its plugin loaded. */
    servers: number;
}

export interface ScheduledTasksResponse {
    tasks: ScheduledTask[];
    /** Holds `admin.plugins.manage`: may run a task now. */
    canManage: boolean;
}

const SCHEDULE_KEY = [ 'plugins', 'schedule' ];

/** The scheduled tasks, read again every 5 seconds while the page is open (runs come and go). */
export const useScheduledTasks = () => useQuery({
    queryKey: SCHEDULE_KEY,
    queryFn: () => api<ScheduledTasksResponse>('/plugins/schedule'),
    refetchInterval: 5000,
});

/** Runs a task now; its schedule stays as it was. A refusal is thrown with why. */
export const useRunScheduledTask = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (key: string) => post<{ ok: boolean; message: string }>(`/plugins/schedule/${encodeURIComponent(key)}/run`),
        onSettled: () => void queryClient.invalidateQueries({ queryKey: SCHEDULE_KEY }),
    });
};

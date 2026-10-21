import { useQuery } from '@tanstack/react-query';

import { api, post, remove } from './client';

/** A restart of the server from the panel: `ServerRestartStatus`. */
export interface ServerRestartStatus {
    /** Whether you hold `admin.server.restart`. */
    canRestart: boolean;
    /** A restart is counting down, to `atUtc`. */
    scheduled: boolean;
    /** The countdown ran out: the server is stopping for its host to start it again. */
    restarting: boolean;
    atUtc: string | null;
    /** What players were told; empty for none. */
    reason: string;
    /** What the process exits with, for the host (Supervisor, systemd) to start it again. */
    exitCode: number;
    /** The longest countdown allowed, in minutes. */
    maxMinutes: number;
    /** Whether players see a countdown notice while a restart counts down (`Turbo:Operations:RestartNotice`). */
    notice: boolean;
    /** Where the notice links to: the restart's own link while one counts down, else the hotel's default; empty for nowhere. */
    noticeLink: string;
}

/** Asked again every few seconds while a restart is under way, so the panel sees it go and come back. */
export const useServerRestart = () => useQuery({
    queryKey: [ 'server-restart' ],
    queryFn: () => api<ServerRestartStatus>('/server/restart'),
    refetchInterval: query => (query.state.data?.scheduled || query.state.data?.restarting ? 5_000 : false),
});

/** How a restart stands, in words (at a time of day in hours and minutes); null when none is under way. */
export const restartState = (status: ServerRestartStatus | undefined) =>
    status?.restarting
        ? 'Restarting'
        : status?.scheduled && status.atUtc
            ? `Restarts at ${new Date(status.atUtc).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
            : null;

/** `link`: where the countdown notice links to (a web address or a client link); left out, the hotel's default. */
export const restartServer = (minutes: number, message?: string, link?: string) => post<ServerRestartStatus>('/server/restart', { minutes, message, link });

export const cancelRestart = () => remove<ServerRestartStatus>('/server/restart');

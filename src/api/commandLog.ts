import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { type ListOrder, listQuery } from '#/lib/sort';

import { api } from './client';

/** Where a logged command came from; `null` is a command typed in a room's chat. */
export type CommandSource = 'console' | 'player' | 'panel' | null;

export interface CommandLogEntry {
    id: number;
    atUtc: string;
    /** 0 for the console. */
    playerId: number;
    /** Null for the console, or a player who is gone. */
    playerName: string | null;
    /** 0 when it was not typed in a room. */
    roomId: number;
    roomName: string | null;
    command: string;
    arguments: string;
    outcome: string;
    source: CommandSource;
}

export interface CommandLogResponse {
    total: number;
    page: number;
    pageSize: number;
    order: ListOrder;
    entries: CommandLogEntry[];
}

export interface CommandLogFilter {
    player: string;
    command: string;
    outcome: string;
    /** `chat` asks for commands typed in a room's chat. */
    source: string;
}

/** How often the log is asked again while open: commands typed in rooms are written in batches. */
const REFRESH_MS = 30_000;

export const useCommandLog = (filter: CommandLogFilter, page: number, order: ListOrder | null) => useQuery({
    queryKey: [ 'command-log', filter, page, order ],
    queryFn: () => api<CommandLogResponse>(`/command-log?${listQuery(filter, page, order)}`),
    placeholderData: keepPreviousData,
    refetchInterval: REFRESH_MS,
});

import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { api } from './client';

export interface RoomVisitEntry {
    id: number;
    atUtc: string;
    playerId: number;
    /** Null for a player who is gone. */
    playerName: string | null;
    roomId: number;
    /** Null for a room that is gone. */
    roomName: string | null;
}

/** A run of the log, newest first. Paged by visit, not counted: there is no total. */
export interface RoomVisitsResponse {
    pageSize: number;
    hasOlder: boolean;
    hasNewer: boolean;
    entries: RoomVisitEntry[];
}

export interface RoomVisitsFilter {
    /** A name or an id. */
    player: string;
    /** A room id. */
    room: string;
}

/** Where a run starts: visits older than `before`, newer than `after`, or the newest. */
export interface RoomVisitsCursor {
    before?: number;
    after?: number;
}

/** How often the newest visits are asked again while open. */
const REFRESH_MS = 30_000;

export const useRoomVisits = (filter: RoomVisitsFilter, cursor: RoomVisitsCursor) => {
    const query = new URLSearchParams();

    for (const [ key, value ] of Object.entries(filter))
        if (value)
            query.set(key, value);

    if (cursor.before)
        query.set('before', String(cursor.before));

    if (cursor.after)
        query.set('after', String(cursor.after));

    return useQuery({
        queryKey: [ 'room-visits', filter, cursor ],
        queryFn: () => api<RoomVisitsResponse>(`/room-visits?${query}`),
        placeholderData: keepPreviousData,
        // Only the newest visits change.
        refetchInterval: cursor.before || cursor.after ? false : REFRESH_MS,
    });
};

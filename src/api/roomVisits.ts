import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { type ListOrder, listQuery } from '#/lib/sort';

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

/** A page of the log in `order`, counted only so far, as the chat log is. */
export interface RoomVisitsResponse {
    total: number;
    /** The server stopped counting at `total` (10,000): there are more. */
    totalCapped: boolean;
    page: number;
    pageSize: number;
    order: ListOrder;
    entries: RoomVisitEntry[];
}

export interface RoomVisitsFilter {
    /** A name or an id. */
    player: string;
    /** A room id. */
    room: string;
}

/** How often the first page is asked again while open. */
const REFRESH_MS = 30_000;

export const useRoomVisits = (filter: RoomVisitsFilter, page: number, order: ListOrder | null) => useQuery({
    queryKey: [ 'room-visits', filter, page, order ],
    queryFn: () => api<RoomVisitsResponse>(`/room-visits?${listQuery(filter, page, order)}`),
    placeholderData: keepPreviousData,
    refetchInterval: page === 1 ? REFRESH_MS : false,
});

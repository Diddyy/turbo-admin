import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { type ListOrder, listQuery } from '#/lib/sort';

import { api } from './client';

export interface ChatlogEntry {
    id: number;
    atUtc: string;
    playerId: number;
    /** Null for a player who is gone. */
    playerName: string | null;
    roomId: number;
    roomName: string | null;
    /** Who a whisper was to; null for a line said to the room. */
    targetPlayerId: number | null;
    targetPlayerName: string | null;
    message: string;
}

/**
 * A page of the log in `order`. The log grows with every word said, so the server counts it only
 * so far: `total` stops at 10,000, with `totalCapped` when there are more.
 */
export interface ChatlogResponse {
    total: number;
    totalCapped: boolean;
    page: number;
    pageSize: number;
    order: ListOrder;
    entries: ChatlogEntry[];
}

/** The lines around one line in its room, newest first. */
export interface ChatlogContextResponse {
    hasOlder: boolean;
    hasNewer: boolean;
    entries: ChatlogEntry[];
}

export interface ChatlogFilter {
    /** A name or an id: what they said, and what was whispered to them. */
    player: string;
    /** A room id. */
    room: string;
    /** Words in the line. */
    text: string;
}

/** How often the first page is asked again while open: rooms write chat in batches. */
const REFRESH_MS = 30_000;

export const useChatlog = (filter: ChatlogFilter, page: number, order: ListOrder | null) => useQuery({
    queryKey: [ 'chatlog', filter, page, order ],
    queryFn: () => api<ChatlogResponse>(`/chatlog?${listQuery(filter, page, order)}`),
    placeholderData: keepPreviousData,
    refetchInterval: page === 1 ? REFRESH_MS : false,
});

/** The lines around one line in its room. */
export const useChatlogContext = (id: number) => useQuery({
    queryKey: [ 'chatlog', 'context', id ],
    queryFn: () => api<ChatlogContextResponse>(`/chatlog/${id}/context`),
});

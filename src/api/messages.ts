import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { type ListOrder, listQuery } from '#/lib/sort';

import { api } from './client';

/** A private message. A Habbicon sent instead of text has no message and its id. Names are null for a player who is gone. */
export interface MessageLogEntry {
    id: number;
    atUtc: string;
    senderId: number;
    senderName: string | null;
    receiverId: number;
    receiverName: string | null;
    message: string;
    habbiconId: number;
    /** False while it waits for the friend to log in. */
    delivered: boolean;
}

/** A page of the log in `order`, counted only so far, as the chat log is. */
export interface MessageLogResponse {
    total: number;
    /** The server stopped counting at `total` (10,000): there are more. */
    totalCapped: boolean;
    page: number;
    pageSize: number;
    order: ListOrder;
    entries: MessageLogEntry[];
}

export interface MessageLogFilter {
    /** A name or an id: what they sent and what was sent to them. */
    player: string;
    /** With `player`, the conversation between the two. */
    with: string;
    /** Words in the message. */
    text: string;
}

export const useMessageLog = (filter: MessageLogFilter, page: number, order: ListOrder | null) => useQuery({
    queryKey: [ 'messages', filter, page, order ],
    queryFn: () => api<MessageLogResponse>(`/messages?${listQuery(filter, page, order)}`),
    placeholderData: keepPreviousData,
});

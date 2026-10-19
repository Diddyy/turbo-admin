import { keepPreviousData, useQuery } from '@tanstack/react-query';

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

/** A run of the log, newest first. Paged by message, not counted: there is no total. */
export interface MessageLogResponse {
    pageSize: number;
    hasOlder: boolean;
    hasNewer: boolean;
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

export interface MessageLogCursor {
    before?: number;
    after?: number;
}

export const useMessageLog = (filter: MessageLogFilter, cursor: MessageLogCursor) => {
    const query = new URLSearchParams();

    for (const [ key, value ] of Object.entries(filter))
        if (value)
            query.set(key, value);

    if (cursor.before)
        query.set('before', String(cursor.before));

    if (cursor.after)
        query.set('after', String(cursor.after));

    return useQuery({
        queryKey: [ 'messages', filter, cursor ],
        queryFn: () => api<MessageLogResponse>(`/messages?${query}`),
        placeholderData: keepPreviousData,
    });
};

import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { api } from './client';

/**
 * A change to a wallet. `amount` is negative when it left. `other` is the other side of the move:
 * `none` (made or spent), `wallet` (another player's), `offer` (a marketplace offer), `chest` (a
 * wired chest). Names are null for a player who is gone; the actor is null for the server.
 */
export interface CurrencyLogEntry {
    id: number;
    atUtc: string;
    playerId: number;
    playerName: string | null;
    currency: string;
    amount: number;
    cause: string;
    causeRef: string | null;
    actorId: number | null;
    actorName: string | null;
    other: 'none' | 'wallet' | 'offer' | 'chest' | (string & {});
    otherPlayerId: number | null;
    otherPlayerName: string | null;
    otherPlaceId: number | null;
}

export interface CurrencyLogResponse {
    pageSize: number;
    hasOlder: boolean;
    hasNewer: boolean;
    /** Whether the ledger is being kept now: movements recorded, and the ledger on. */
    recording: boolean;
    currencies: { typeId: number; name: string }[];
    entries: CurrencyLogEntry[];
    /** For one player: what came in and went out per currency, across the filter. */
    totals: { currency: string; in: number; out: number }[] | null;
}

export interface CurrencyLogFilter {
    player: string;
    /** A currency type id. */
    currency: string;
    /** A cause, or the start of one: `market` takes in every marketplace cause. */
    cause: string;
}

export interface CurrencyLogCursor {
    before?: number;
    after?: number;
}

export const useCurrencyLog = (filter: CurrencyLogFilter, cursor: CurrencyLogCursor) => {
    const query = new URLSearchParams();

    for (const [ key, value ] of Object.entries(filter))
        if (value)
            query.set(key, value);

    if (cursor.before)
        query.set('before', String(cursor.before));

    if (cursor.after)
        query.set('after', String(cursor.after));

    return useQuery({
        queryKey: [ 'currency-log', filter, cursor ],
        queryFn: () => api<CurrencyLogResponse>(`/currency-log?${query}`),
        placeholderData: keepPreviousData,
    });
};

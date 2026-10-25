import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { type ListOrder, listQuery } from '#/lib/sort';

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

/** A page of the log in `order`, counted only so far, as the chat log is. */
export interface CurrencyLogResponse {
    total: number;
    /** The server stopped counting at `total` (10,000): there are more. */
    totalCapped: boolean;
    page: number;
    pageSize: number;
    order: ListOrder;
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

export const useCurrencyLog = (filter: CurrencyLogFilter, page: number, order: ListOrder | null) => useQuery({
    queryKey: [ 'currency-log', filter, page, order ],
    queryFn: () => api<CurrencyLogResponse>(`/currency-log?${listQuery(filter, page, order)}`),
    placeholderData: keepPreviousData,
});

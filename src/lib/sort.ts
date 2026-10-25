import { useMemo, useState } from 'react';

/** Which way a column reads: up from the smallest or first (`asc`), or down from the largest. */
export type SortDir = 'asc' | 'desc';

/**
 * The order a list is in: a column's key and which way. A list the server sorts sends back the
 * order it took (`order`), its own default when none was asked for, so the header marks it either
 * way.
 */
export interface ListOrder {
    sort: string;
    dir: SortDir;
}

/** A list's order and how to change it, for the headers that sort it. */
export interface Sorting {
    order: ListOrder | undefined;
    onSort: (order: ListOrder) => void;
}

/** The order asked for in the address (`sort` and `dir`), or null for the list's own. */
export const orderOf = (params: URLSearchParams): ListOrder | null => {
    const sort = params.get('sort');

    return sort ? { sort, dir: params.get('dir') === 'asc' ? 'asc' : 'desc' } : null;
};

/** An order as the address and the server take it: nothing for the list's own. */
export const orderParams = (order: ListOrder | null | undefined): Record<string, string> =>
    order ? { sort: order.sort, dir: order.dir } : {};

/**
 * A list's query, as the server and the address both take it: the parts of its filter that are
 * given, its page past the first, and its order when it is not the list's own.
 */
export const listQuery = (filter: object, page: number, order: ListOrder | null | undefined) => {
    const query = new URLSearchParams();

    for (const [ key, value ] of Object.entries(filter))
        if (value !== '' && value !== undefined && value !== null && value !== false)
            query.set(key, String(value));

    if (page > 1)
        query.set('page', String(page));

    for (const [ key, value ] of Object.entries(orderParams(order)))
        query.set(key, value);

    return query;
};

/** The page asked for in the address, from 1. */
export const pageOf = (params: URLSearchParams) => Math.max(1, Number(params.get('page')) || 1);

/**
 * What a click on a column's header asks for: the other way round when the list is sorted by it
 * already, and the column's first way (`first`: newest or largest first for times and counts)
 * when it is not.
 */
export const nextOrder = (current: ListOrder | undefined, sort: string, first: SortDir = 'asc'): ListOrder =>
    current?.sort === sort
        ? { sort, dir: current.dir === 'asc' ? 'desc' : 'asc' }
        : { sort, dir: first };

type SortValue = string | number | boolean | Date | null | undefined;

/** What each column of a list the panel holds whole sorts its rows by. */
export type SortKeys<T> = Record<string, (row: T) => SortValue>;

const COLLATOR = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

const compare = (a: SortValue, b: SortValue) =>
    typeof a === 'string' && typeof b === 'string'
        ? COLLATOR.compare(a, b)
        : Number(a) - Number(b);

/**
 * Rows in an order: by the column's key, words as people read them (2 before 10, case ignored),
 * rows with no value last either way, and rows that tie in the order they came.
 */
export const sortRows = <T>(rows: readonly T[], order: ListOrder, keys: SortKeys<T>): T[] => {
    const key = keys[order.sort];

    if (!key)
        return [ ...rows ];

    const sign = order.dir === 'asc' ? 1 : -1;

    return rows
        .map((row, index) => ({ row, index, value: key(row) }))
        .sort((a, b) => {
            const aNone = a.value === null || a.value === undefined || a.value === '';
            const bNone = b.value === null || b.value === undefined || b.value === '';

            if (aNone || bNone)
                return aNone === bNone ? a.index - b.index : aNone ? 1 : -1;

            return compare(a.value, b.value) * sign || a.index - b.index;
        })
        .map(x => x.row);
};

/**
 * A list the panel holds whole, sorted in the browser: in `initial` (the order it came in, named
 * as the column it is by) until a header asks for another. A list whose order is no column's (a
 * set order of its own) has no `initial`, and keeps that order until a header is clicked.
 */
export const useSortedRows = <T>(rows: readonly T[] | undefined, keys: SortKeys<T>, initial?: ListOrder) => {
    const [ order, setOrder ] = useState<ListOrder | undefined>(initial);
    const sorted = useMemo(() => (order ? sortRows(rows ?? [], order, keys) : [ ...rows ?? [] ]), [ rows, order, keys ]);
    const sorting: Sorting = { order, onSort: setOrder };

    return [ sorted, sorting ] as const;
};

import type { CSSProperties, ReactNode } from 'react';

import { cx } from '#/lib/cx';
import { type ListOrder, type Sorting, type SortKeys, useSortedRows } from '#/lib/sort';

import { PhoneSort, SortButton, type SortColumn } from './SortHeader';

/** A column's header; with `sort`, a key the list sorts by, it sorts the list when clicked. */
export interface RowListColumn extends SortColumn {
    className?: string;
}

/**
 * A list that reads as a table from the small breakpoint up, its columns sized by
 * <c>columns</c> (a grid template) across every row at once through subgrid, and on a phone as
 * stacked rows: each row's first cell on a line of its own, the rest flowing after it, so
 * nothing scrolls sideways. With <c>sorting</c>, the headers of the columns that have a `sort`
 * sort it, and a phone, which has no headers, says the order above the rows.
 */
export const RowList = ({ columns, headers, sorting, children }: { columns: string; headers: RowListColumn[]; sorting?: Sorting; children: ReactNode }) => (
    <div style={{ '--row-cols': columns } as CSSProperties} className="text-sm sm:grid sm:grid-cols-(--row-cols) sm:gap-x-4">
        {sorting && <PhoneSort columns={headers} sorting={sorting} />}
        <div className="hidden border-b border-line px-4 py-2 font-mono text-[11px] font-medium tracking-[0.08em] text-muted uppercase sm:col-span-full sm:grid sm:grid-cols-subgrid">
            {headers.map((header, index) => (
                <span key={index} className={header.className}>
                    {header.sort && sorting
                        ? <SortButton label={header.label} sort={header.sort} first={header.first} sorting={sorting} />
                        : header.label}
                </span>
            ))}
        </div>
        <ul className="divide-y divide-line sm:col-span-full sm:grid sm:grid-cols-subgrid">{children}</ul>
    </div>
);

/**
 * A <c>RowList</c> of rows the panel holds whole, sorted in the browser: in `initial`, the column
 * the server sent them in (none for a set order of the list's own), until a header asks for another. `keys` says what each column with a
 * `sort` sorts by, and `children` draws a row (its index is its place in the sorted rows).
 */
export const SortedRowList = <T extends object>({ rows, keys, initial, children, ...list }: {
    columns: string;
    headers: RowListColumn[];
    rows: readonly T[];
    keys: SortKeys<T>;
    initial?: ListOrder;
    children: (row: T, index: number) => ReactNode;
}) => {
    const [ sorted, sorting ] = useSortedRows(rows, keys, initial);

    return <RowList {...list} sorting={sorting}>{sorted.map(children)}</RowList>;
};

/** One row of a <c>RowList</c>; its children are the cells, in the columns' order. */
export const Row = ({ children, className }: { children: ReactNode; className?: string }) => (
    <li
        className={cx(
            'group flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 hover:bg-subtle/60 [&>:first-child]:basis-full',
            'sm:col-span-full sm:grid sm:grid-cols-subgrid sm:py-2.5 sm:[&>*]:min-w-0 sm:[&>:first-child]:basis-auto',
            className,
        )}
    >
        {children}
    </li>
);

/** Words a cell needs on a phone, where there is no column header to say what it is. */
export const PhoneLabel = ({ children }: { children: ReactNode }) => <span className="text-muted sm:hidden">{children}</span>;

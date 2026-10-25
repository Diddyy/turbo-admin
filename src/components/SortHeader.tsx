import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import type { ReactNode } from 'react';

import { cx } from '#/lib/cx';
import { nextOrder, type SortDir, type Sorting } from '#/lib/sort';

/** A column a list can be sorted by: its key, its header, and the way it reads first. */
export interface SortColumn {
    label?: string;
    sort?: string;
    first?: SortDir;
}

const wayOf = (dir: SortDir) => (dir === 'asc' ? 'ascending' : 'descending');

/**
 * A column's header that sorts the list by it. The column sorted by now is in the accent colour
 * with an arrow its way (up ascending, down descending); a click turns it round. The others show a
 * faint pair of arrows, so a header that sorts reads as one, and a click sorts by it its first way.
 */
export const SortButton = ({ label, sort, first, sorting }: { label: ReactNode; sort: string; first?: SortDir; sorting: Sorting }) => {
    const dir = sorting.order?.sort === sort ? sorting.order.dir : undefined;

    return (
        <button
            type="button"
            onClick={() => sorting.onSort(nextOrder(sorting.order, sort, first))}
            title={dir ? `Sorted ${wayOf(dir)}: sort ${wayOf(dir === 'asc' ? 'desc' : 'asc')}` : 'Sort by this'}
            className={cx(
                'group/sort -mx-1 inline-flex items-center gap-1 rounded px-1 uppercase transition-colors focus-visible:outline-2 focus-visible:outline-accent',
                dir ? 'text-accent' : 'hover:text-ink',
            )}
        >
            {label}
            {dir === 'asc' && <ArrowUp aria-hidden className="size-3 shrink-0" />}
            {dir === 'desc' && <ArrowDown aria-hidden className="size-3 shrink-0" />}
            {!dir && <ChevronsUpDown aria-hidden className="size-3 shrink-0 opacity-40 transition-opacity group-hover/sort:opacity-100" />}
        </button>
    );
};

/**
 * A sorted list's order on a phone, where its column headers are hidden: which column it is sorted
 * by (a choice of them when there are more than one) and a button to turn it round.
 */
export const PhoneSort = ({ columns, sorting, className }: { columns: SortColumn[]; sorting: Sorting; className?: string }) => {
    const sortable = columns.filter((x): x is SortColumn & { sort: string } => !!x.sort);
    const order = sorting.order;

    if (sortable.length === 0 || !order)
        return null;

    const current = sortable.find(x => x.sort === order.sort);

    return (
        <div className={cx('flex items-center gap-2 border-b border-line px-4 py-1 text-xs text-muted sm:hidden', className)}>
            <span>Sorted by</span>
            {sortable.length > 1
                ? (
                        <select
                            value={order.sort}
                            onChange={(event) => {
                                const column = sortable.find(x => x.sort === event.target.value);

                                if (column)
                                    sorting.onSort({ sort: column.sort, dir: column.first ?? 'asc' });
                            }}
                            aria-label="Sort by"
                            className="h-9 min-w-0 rounded-md bg-transparent font-medium text-ink"
                        >
                            {sortable.map(x => <option key={x.sort} value={x.sort}>{x.label}</option>)}
                        </select>
                    )
                : <span className="font-medium text-ink">{current?.label}</span>}
            <button
                type="button"
                onClick={() => sorting.onSort({ sort: order.sort, dir: order.dir === 'asc' ? 'desc' : 'asc' })}
                aria-label={`Sorted ${wayOf(order.dir)}: sort ${wayOf(order.dir === 'asc' ? 'desc' : 'asc')}`}
                className="ml-auto inline-flex h-9 items-center gap-1 rounded-md px-2 text-accent active:bg-subtle"
            >
                {order.dir === 'asc' ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />}
                {order.dir === 'asc' ? 'Ascending' : 'Descending'}
            </button>
        </div>
    );
};

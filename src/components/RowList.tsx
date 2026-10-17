import type { CSSProperties, ReactNode } from 'react';

import { cx } from '#/lib/cx';

export interface RowListColumn {
    label?: string;
    className?: string;
}

/**
 * A list that reads as a table from the small breakpoint up, its columns sized by
 * <c>columns</c> (a grid template) across every row at once through subgrid, and on a phone as
 * stacked rows: each row's first cell on a line of its own, the rest flowing after it, so
 * nothing scrolls sideways.
 */
export const RowList = ({ columns, headers, children }: { columns: string; headers: RowListColumn[]; children: ReactNode }) => (
    <div style={{ '--row-cols': columns } as CSSProperties} className="text-sm sm:grid sm:grid-cols-(--row-cols) sm:gap-x-4">
        <div className="hidden border-b border-line px-4 py-2 font-mono text-[11px] font-medium tracking-[0.08em] text-muted uppercase sm:col-span-full sm:grid sm:grid-cols-subgrid">
            {headers.map((header, index) => <span key={index} className={header.className}>{header.label}</span>)}
        </div>
        <ul className="divide-y divide-line sm:col-span-full sm:grid sm:grid-cols-subgrid">{children}</ul>
    </div>
);

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

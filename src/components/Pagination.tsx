import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import type { ReactNode } from 'react';

import { cx } from '#/lib/cx';

const PageButton = ({ label, icon, disabled, onClick, className }: { label: string; icon: ReactNode; disabled: boolean; onClick: () => void; className?: string }) => (
    <button
        type="button"
        title={label}
        aria-label={label}
        disabled={disabled}
        onClick={onClick}
        className={cx(
            'grid place-items-center rounded-md text-muted transition hover:bg-subtle hover:text-ink active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 [&>svg]:size-4',
            className,
        )}
    >
        {icon}
    </button>
);

/**
 * A list's pages, as nitro-studio has them: which rows these are and the buttons to the others.
 * On a phone it is shorter: the page's number of how many, between previous and next. A list of
 * one page is just its count. `capped` is a log counted only so far (the server stops counting
 * at 10,000): its count reads "10,000+", and its last page is the last one counted.
 */
export const Pagination = ({ offset, limit, total, capped, onChange }: { offset: number; limit: number; total: number; capped?: boolean; onChange: (offset: number) => void }) => {
    const more = capped ? '+' : '';

    if (total <= limit)
        return (
            <div className="shrink-0 text-xs whitespace-nowrap text-muted tabular-nums">
                {`${total.toLocaleString()}${more} ${total === 1 && !capped ? 'result' : 'results'}`}
            </div>
        );

    const page = Math.floor(offset / limit) + 1;
    const pages = Math.ceil(total / limit);

    return (
        <nav aria-label="Pages" className="flex shrink-0 items-center gap-0.5 text-xs whitespace-nowrap text-muted">
            <span className="mr-1.5 tabular-nums max-sm:hidden">
                {`${(offset + 1).toLocaleString()}–${Math.min(offset + limit, total).toLocaleString()} of ${total.toLocaleString()}${more}`}
            </span>
            <PageButton label="First page" icon={<ChevronsLeft />} className="size-7 max-sm:hidden" disabled={page <= 1} onClick={() => onChange(0)} />
            <PageButton label="Previous page" icon={<ChevronLeft />} className="size-8 sm:size-7" disabled={page <= 1} onClick={() => onChange(Math.max(0, offset - limit))} />
            <span className="min-w-12 text-center tabular-nums sm:hidden" aria-label={`Page ${page} of ${pages}${more}`}>
                {`${page.toLocaleString()} of ${pages.toLocaleString()}${more}`}
            </span>
            <PageButton label="Next page" icon={<ChevronRight />} className="size-8 sm:size-7" disabled={page >= pages} onClick={() => onChange(offset + limit)} />
            <PageButton label="Last page" icon={<ChevronsRight />} className="size-7 max-sm:hidden" disabled={page >= pages} onClick={() => onChange((pages - 1) * limit)} />
        </nav>
    );
};

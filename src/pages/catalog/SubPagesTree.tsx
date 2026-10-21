import type { AddFurniPage } from '#/api/catalog';
import { cx } from '#/lib/cx';

const PlanChip = ({ page }: { page: AddFurniPage }) => (
    <span className="flex items-center gap-1 rounded-full bg-subtle px-2 py-0.5 text-xs">
        {page.title}
        <span className="font-mono text-[11px] text-muted tabular-nums">{page.count}</span>
        {page.pageId === null && <span className="text-[10px] text-accent uppercase">new</span>}
    </span>
);

/** Pages furni would be sorted onto, a row each, with the pages under one beside it. */
export const SubPagesTree = ({ pages, fetching, className }: { pages: AddFurniPage[]; fetching?: boolean; className?: string }) => (
    <ul className={cx('flex flex-col gap-1 overflow-y-auto transition-opacity', fetching && 'opacity-60', className)}>
        {pages.map(x => (
            <li key={x.title} className="flex flex-wrap items-center gap-1.5">
                <PlanChip page={x} />
                {x.pages.length > 0 && (
                    <>
                        <span className="text-xs text-muted">→</span>
                        {x.pages.map(y => <PlanChip key={y.title} page={y} />)}
                    </>
                )}
            </li>
        ))}
    </ul>
);

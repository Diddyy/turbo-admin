import { CheckCircle2, EyeOff, Merge } from 'lucide-react';
import { useState } from 'react';

import { type CatalogTree, type DuplicatePage, type DuplicatePageItem, useDuplicatePages } from '#/api/catalog';
import { Badge, type BadgeTone, EmptyState, ErrorNotice, Loading, TextButton } from '#/components/ui';

import { MergePagesDialog } from './MergePagesDialog';

const DISPLAYS: Record<string, { label: string; tone: BadgeTone }> = {
    regular: { label: 'Normal', tone: 'neutral' },
    bc_only: { label: 'Builders Club', tone: 'accent' },
    both: { label: 'Both', tone: 'green' },
    invisible: { label: 'Hidden', tone: 'amber' },
};

const plural = (count: number, one: string, many: string) => `${count.toLocaleString()} ${count === 1 ? one : many}`;

const PageRow = ({ page, canManage, onOpen, onMerge }: { page: DuplicatePageItem; canManage: boolean; onOpen: () => void; onMerge: () => void }) => {
    const display = DISPLAYS[page.display] ?? DISPLAYS.regular!;

    return (
        <li className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
            <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left hover:text-accent" title="Open it in the editor">
                <span className="block truncate text-[13px] font-medium">{page.title}</span>
                <span className="block truncate text-[11px] text-muted">{page.path} · page {page.pageId}</span>
            </button>
            {!page.shown && (
                <span className="flex items-center gap-1 rounded-full bg-subtle px-2 py-0.5 text-[11px] text-muted" title="It or a page above it is hidden">
                    <EyeOff className="size-3" />
                    hidden
                </span>
            )}
            <Badge tone={display.tone}>{display.label}</Badge>
            <span className="font-mono text-xs text-muted tabular-nums sm:w-36 sm:text-right">
                {plural(page.offers, 'offer', 'offers')} · {plural(page.pages, 'page', 'pages')}
            </span>
            {canManage && (
                <TextButton onClick={onMerge} title="Move the others' offers and pages here, then delete them" className="min-h-10 px-2 sm:min-h-0">
                    Merge into this
                </TextButton>
            )}
        </li>
    );
};

/**
 * The names more than one page has, as two imports made apart leave a page of Habbo's, once for
 * each catalogue: each page with where it is, which catalogue shows it and what it holds. Merging
 * into one moves the others' offers and pages to it and deletes them, as one step to undo, keeping
 * the offer of the page picked where two sell the same; the page kept is shown in each catalogue
 * one of them was.
 */
export const DuplicatePages = ({ tree, onOpen }: { tree: CatalogTree; onOpen: (pageId: number) => void }) => {
    const duplicates = useDuplicatePages();
    const [ merging, setMerging ] = useState<{ group: DuplicatePage; keep: DuplicatePageItem } | null>(null);
    const items = duplicates.data?.items ?? [];

    return (
        <section className="flex flex-col gap-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Merge className="size-4 text-accent" />
                {duplicates.data ? `${items.length.toLocaleString()} page names used more than once` : 'Pages by the same name'}
            </h3>
            {duplicates.error && <ErrorNotice error={duplicates.error} />}
            {duplicates.isPending && <Loading />}
            {duplicates.data && items.length === 0 && (
                <EmptyState framed icon={<CheckCircle2 className="text-good" />}>No two pages share a name.</EmptyState>
            )}
            <ul className="grid gap-3 xl:grid-cols-2">
                {items.slice(0, 200).map(group => (
                    <li key={group.name} className="overflow-hidden rounded-xl border border-line bg-surface">
                        <div className="flex items-center gap-3 border-b border-line bg-subtle/50 px-3 py-2">
                            <span className="min-w-0 flex-1 truncate font-mono text-sm font-semibold">{group.name}</span>
                            <span className="rounded-full bg-warn-soft px-2 py-0.5 font-mono text-[11px] font-semibold text-warn">×{group.pages.length}</span>
                        </div>
                        <ul className="divide-y divide-line">
                            {group.pages.map(page => (
                                <PageRow
                                    key={page.pageId}
                                    page={page}
                                    canManage={tree.canManage}
                                    onOpen={() => onOpen(page.pageId)}
                                    onMerge={() => setMerging({ group, keep: page })}
                                />
                            ))}
                        </ul>
                    </li>
                ))}
            </ul>
            {items.length > 200 && <p className="text-center text-xs text-muted">Showing 200 of {items.length}.</p>}
            {merging && (
                <MergePagesDialog
                    tree={tree}
                    pageIds={merging.group.pages.map(x => x.pageId)}
                    keepId={merging.keep.pageId}
                    onClose={() => setMerging(null)}
                />
            )}
        </section>
    );
};

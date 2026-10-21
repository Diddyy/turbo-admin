import { CheckCircle2, EyeOff, Merge } from 'lucide-react';

import { catalogCalls, type CatalogTree, type DuplicatePage, type DuplicatePageItem, useCatalogEdit, useDuplicatePages } from '#/api/catalog';
import { ask } from '#/components/confirm';
import { toast, toastError } from '#/components/toast';
import { Badge, type BadgeTone, EmptyState, ErrorNotice, Loading, TextButton } from '#/components/ui';

const DISPLAYS: Record<string, { label: string; tone: BadgeTone }> = {
    regular: { label: 'Normal', tone: 'neutral' },
    bc_only: { label: 'Builders Club', tone: 'accent' },
    both: { label: 'Both', tone: 'green' },
    invisible: { label: 'Hidden', tone: 'amber' },
};

const plural = (count: number, one: string, many: string) => `${count.toLocaleString()} ${count === 1 ? one : many}`;

const PageRow = ({ page, canManage, busy, onOpen, onMerge }: { page: DuplicatePageItem; canManage: boolean; busy: boolean; onOpen: () => void; onMerge: () => void }) => {
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
                <TextButton disabled={busy} onClick={onMerge} title="Move the others' offers and pages here, then delete them" className="min-h-10 px-2 sm:min-h-0">
                    Merge into this
                </TextButton>
            )}
        </li>
    );
};

/**
 * The names more than one page has, as two imports made apart leave a page of Habbo's, once for
 * each catalogue: each page with where it is, which catalogue shows it and what it holds. Merging
 * into one moves the others' offers and pages to it and deletes them, as one step to undo; the
 * page kept is shown in each catalogue one of them was.
 */
export const DuplicatePages = ({ tree, onOpen }: { tree: CatalogTree; onOpen: (pageId: number) => void }) => {
    const duplicates = useDuplicatePages();
    const merge = useCatalogEdit(catalogCalls.mergePages);
    const items = duplicates.data?.items ?? [];

    const doMerge = (group: DuplicatePage, keep: DuplicatePageItem) => {
        const others = group.pages.filter(x => x.pageId !== keep.pageId);

        ask({
            title: `Merge ${plural(others.length, 'page', 'pages')} named "${group.name}" into page ${keep.pageId}?`,
            body: 'Their offers and the pages under them move to it, an offer it sells already is deleted, and they are deleted. It is shown in each catalogue one of them was. You can undo it.',
            confirm: 'Merge',
        }, () => {
            merge.mutate([ keep.pageId, others.map(x => x.pageId) ], {
                onSuccess: result => toast(`Merged: ${plural(result.offersMoved, 'offer', 'offers')} moved, ${plural(result.offersDropped, 'offer', 'offers')} it had already deleted, ${plural(result.pagesMoved, 'page', 'pages')} moved under it.`),
                onError: toastError,
            });
        });
    };

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
                                    busy={merge.isPending}
                                    onOpen={() => onOpen(page.pageId)}
                                    onMerge={() => doMerge(group, page)}
                                />
                            ))}
                        </ul>
                    </li>
                ))}
            </ul>
            {items.length > 200 && <p className="text-center text-xs text-muted">Showing 200 of {items.length}.</p>}
        </section>
    );
};

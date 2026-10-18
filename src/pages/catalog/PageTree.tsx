import { useDndContext } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronRight, ChevronsDownUp, ChevronsUpDown, EyeOff, FolderPlus, GripVertical, Hammer, Plus, Star } from 'lucide-react';
import { type KeyboardEventHandler, type ReactNode, useState } from 'react';

import { catalogIconUrl, useClientAssets } from '#/api/assets';
import { type CatalogPageNode, type CatalogTree, FRONT_PAGE_LAYOUT } from '#/api/catalog';
import { SearchInput } from '#/components/SearchInput';
import { EmptyState, IconButton } from '#/components/ui';
import { cx } from '#/lib/cx';

import { DISPLAY_LABELS, inBuildersClub } from './labels';
import { ancestorsOf, childrenOf } from './tree';
import { type FlatRow, INDENT, pageDragId, type Projection } from './treeDrag';

export const PageIcon = ({ icon, className }: { icon: number; className?: string }) => {
    const url = catalogIconUrl(useClientAssets(), icon);

    return (
        <span className={cx('grid size-5 shrink-0 place-items-center', className)}>
            {url && <img src={url} alt="" loading="lazy" className="max-h-full max-w-full [image-rendering:pixelated]" onError={event => (event.currentTarget.style.display = 'none')} />}
        </span>
    );
};

/** The part of a title that matches the search, marked. */
const Highlight = ({ text, needle }: { text: string; needle: string }) => {
    const at = needle ? text.toLowerCase().indexOf(needle) : -1;

    if (at < 0)
        return <>{text}</>;

    return (
        <>
            {text.slice(0, at)}
            <mark className="rounded-sm bg-accent-soft px-0.5 text-accent">{text.slice(at, at + needle.length)}</mark>
            {text.slice(at + needle.length)}
        </>
    );
};

/** A page's marks: the front page, hidden, in the Builders Club catalog. */
const Marks = ({ page }: { page: CatalogPageNode }) => (
    <>
        {page.layout === FRONT_PAGE_LAYOUT && <span title="The front page"><Star className="size-3.5 shrink-0 text-coin" aria-label="front page" /></span>}
        {page.display === 'invisible' && <span title="Hidden"><EyeOff className="size-3.5 shrink-0 text-muted" aria-label="hidden" /></span>}
        {inBuildersClub(page.display) && <span title={DISPLAY_LABELS[page.display]}><Hammer className="size-3.5 shrink-0 text-muted" aria-label={DISPLAY_LABELS[page.display]} /></span>}
    </>
);

/** What a row looks like, in the tree and under the pointer while it is dragged. */
export const PageRowBody = ({ page, needle = '', path, strong }: { page: CatalogPageNode; needle?: string; path?: string; strong?: boolean }) => (
    <>
        <PageIcon icon={page.icon} className={strong ? 'size-6' : undefined} />
        <span className="flex min-w-0 flex-1 flex-col">
            <span className={cx('truncate', strong && 'font-semibold', (page.display === 'invisible' || page.display === 'bc_only') && 'opacity-60')}>
                <Highlight text={page.localization} needle={needle} />
            </span>
            {path && <span className="truncate text-[11px] text-muted">{path}</span>}
        </span>
        <Marks page={page} />
        {page.offerCount > 0 && <span className="rounded-full bg-subtle px-1.5 font-mono text-[10px] leading-4 text-muted tabular-nums">{page.offerCount}</span>}
    </>
);

interface RowProps {
    row: FlatRow;
    selected: boolean;
    open: boolean;
    canManage: boolean;
    /** The depth the dragged page would take, drawn on its placeholder. */
    projectedDepth: number | null;
    onToggle: () => void;
    onSelect: () => void;
    onAddUnder: () => void;
}

/** The lines down the left of a row, one for each level above it, as a file tree draws them. */
const Guides = ({ depth }: { depth: number }) => (
    <>
        {Array.from({ length: depth }, (_, i) => (
            <span key={i} aria-hidden className="pointer-events-none absolute inset-y-0 border-l border-line" style={{ left: `${17 + i * INDENT}px` }} />
        ))}
    </>
);

const Row = ({ row, selected, open, canManage, projectedDepth, onToggle, onSelect, onAddUnder }: RowProps) => {
    const { page } = row;
    const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } = useSortable({
        id: pageDragId(page.id),
        data: { kind: 'page', id: page.id },
        disabled: { draggable: !canManage, droppable: false },
    });
    const { active } = useDndContext();
    // An offer held over a page: dropping it moves the offer there.
    const offerOver = isOver && active?.data.current?.kind === 'offer';
    const depth = isDragging && projectedDepth !== null ? projectedDepth : row.depth;
    const isTab = depth === 0;
    // The row is dragged with the mouse or a finger; the keyboard picks it up by its grip.
    const { onKeyDown, ...pointer } = listeners ?? {};

    return (
        <li ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }} className={cx('relative', isDragging && 'z-10', isTab && !isDragging && 'mt-1 first:mt-0')}>
            <Guides depth={depth} />
            <div
                {...(canManage ? pointer : {})}
                className={cx(
                    'group relative flex items-center gap-1 rounded-lg pr-1 text-[13px] transition-colors select-none',
                    isTab ? 'min-h-11 sm:min-h-10' : 'min-h-11 sm:min-h-8',
                    isDragging
                        ? 'border-2 border-dashed border-accent bg-accent-soft/50'
                        : offerOver
                            ? 'bg-accent text-on-accent shadow-[0_0_0_3px_var(--color-accent-soft)]'
                            : selected
                                ? 'bg-accent-soft text-accent before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-full before:bg-accent'
                                : isTab ? 'bg-subtle/60 hover:bg-subtle' : 'hover:bg-subtle',
                )}
                style={{ paddingLeft: `${4 + depth * INDENT}px` }}
            >
                <button
                    type="button"
                    aria-label={open ? `Close ${page.localization}` : `Open ${page.localization}`}
                    onClick={onToggle}
                    className={cx('grid size-8 shrink-0 place-items-center rounded text-muted hover:bg-surface hover:text-ink sm:size-6', !row.hasChildren && 'invisible')}
                >
                    <ChevronRight className={cx('size-3.5 transition-transform', open && 'rotate-90')} />
                </button>
                <button type="button" onClick={onSelect} onDoubleClick={onToggle} className={cx('flex min-w-0 flex-1 items-center gap-2 py-1 text-left', isDragging && 'opacity-60')}>
                    <PageRowBody page={page} strong={isTab} />
                </button>
                {canManage && (
                    <>
                        <button
                            type="button"
                            onClick={onAddUnder}
                            title={`Add a page under ${page.localization}`}
                            aria-label={`Add a page under ${page.localization}`}
                            // Hidden until the row is pointed at, picked or focused; a touch screen has no pointing, so there it always shows.
                            className={cx(
                                'grid size-9 shrink-0 place-items-center rounded text-muted transition-opacity hover:bg-surface hover:text-accent focus-visible:opacity-100 sm:size-6 [@media(hover:none)]:opacity-100',
                                selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
                            )}
                        >
                            <Plus className="size-3.5" />
                        </button>
                        <span
                            {...attributes}
                            onKeyDown={onKeyDown as KeyboardEventHandler<HTMLSpanElement> | undefined}
                            aria-label={`Move ${page.localization}`}
                            title="Drag the row to move it; sideways to go in or out a level. Space picks it up from the keyboard."
                            className="grid size-9 shrink-0 cursor-grab touch-none place-items-center rounded text-muted hover:bg-surface hover:text-ink active:cursor-grabbing sm:size-6"
                        >
                            <GripVertical className="size-3.5" />
                        </span>
                    </>
                )}
            </div>
        </li>
    );
};

const ToolButton = ({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) => (
    <IconButton label={label} icon={children} onClick={onClick} />
);

interface PageTreeProps {
    tree: CatalogTree;
    rows: FlatRow[];
    open: Set<number>;
    selected: number | null;
    projection: Projection | null;
    onToggle: (id: number) => void;
    onSetOpen: (open: Set<number>) => void;
    onSelect: (id: number) => void;
    onAddUnder: (id: number) => void;
}

/**
 * The catalog's pages as the client's navigator shows them: the tabs along the top level, each
 * page under its parent with a guide line per level, marked where it is the front page, hidden,
 * or in the Builders Club catalog, with how many offers it has. A row is dragged up and down
 * among the others and sideways to go under the page above or back out; an offer dragged from
 * the page onto a row moves there. A search lists every page whose title or name matches, with
 * where it sits.
 */
export const PageTree = ({ tree, rows, open, selected, projection, onToggle, onSetOpen, onSelect, onAddUnder }: PageTreeProps) => {
    const [ filter, setFilter ] = useState('');
    const needle = filter.trim().toLowerCase();
    const searching = needle.length > 0;
    const withChildren = [ ...childrenOf(tree).keys() ].filter(id => id !== tree.rootId);
    const allOpen = withChildren.length > 0 && withChildren.every(id => open.has(id));

    const matches = searching
        ? tree.pages
                .filter(x => x.id !== tree.rootId && (x.localization.toLowerCase().includes(needle) || (x.name ?? '').toLowerCase().includes(needle)))
                .slice(0, 150)
        : [];

    return (
        <div className="flex min-h-0 flex-col">
            <div className="flex items-center gap-1 border-b border-line p-2">
                <SearchInput
                    value={filter}
                    onValueChange={setFilter}
                    onKeyDown={event => event.key === 'Escape' && setFilter('')}
                    placeholder="Find a page"
                    className="min-w-0 flex-1"
                />
                {!searching && (
                    <ToolButton label={allOpen ? 'Close every page' : 'Open every page'} onClick={() => onSetOpen(allOpen ? new Set() : new Set(withChildren))}>
                        {allOpen ? <ChevronsDownUp /> : <ChevronsUpDown />}
                    </ToolButton>
                )}
                {tree.canManage && (
                    <ToolButton label="Add a tab" onClick={() => onAddUnder(tree.rootId)}>
                        <FolderPlus />
                    </ToolButton>
                )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
                {searching
                    ? (
                            <ul className="flex flex-col gap-0.5">
                                {matches.length === 0 && <li><EmptyState>No page matches “{filter.trim()}”.</EmptyState></li>}
                                {matches.map(page => (
                                    <li key={page.id}>
                                        <button
                                            type="button"
                                            onClick={() => onSelect(page.id)}
                                            className={cx('flex min-h-11 w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-[13px] sm:min-h-9', selected === page.id ? 'bg-accent-soft text-accent' : 'hover:bg-subtle')}
                                        >
                                            <PageRowBody page={page} needle={needle} path={ancestorsOf(tree, page.id).map(x => x.localization).reverse().join(' / ') || 'Tab'} />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )
                    : (
                            <SortableContext items={rows.map(x => pageDragId(x.page.id))} strategy={verticalListSortingStrategy}>
                                <ul className="flex flex-col gap-px">
                                    {rows.length === 0 && <li><EmptyState>No pages yet.</EmptyState></li>}
                                    {rows.map(row => (
                                        <Row
                                            key={row.page.id}
                                            row={row}
                                            selected={selected === row.page.id}
                                            open={open.has(row.page.id)}
                                            canManage={tree.canManage}
                                            projectedDepth={projection?.depth ?? null}
                                            onToggle={() => onToggle(row.page.id)}
                                            onSelect={() => onSelect(row.page.id)}
                                            onAddUnder={() => onAddUnder(row.page.id)}
                                        />
                                    ))}
                                </ul>
                            </SortableContext>
                        )}
            </div>
            {tree.canManage && !searching && rows.length > 0 && (
                <p className="border-t border-line px-3 py-2 text-[11px] leading-snug text-muted">
                    Drag a page by its grip to move it, and sideways to go in or out a level. On a touch screen, hold it a moment first.
                </p>
            )}
        </div>
    );
};

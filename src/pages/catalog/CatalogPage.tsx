import {
    closestCenter,
    type CollisionDetection,
    DndContext,
    type DragEndEvent,
    type DragMoveEvent,
    DragOverlay,
    type DragStartEvent,
    KeyboardSensor,
    MouseSensor,
    pointerWithin,
    TouchSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Eye, PackagePlus, Settings2, Sparkles } from 'lucide-react';
import { type CSSProperties, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router';

import {
    catalogCalls,
    type CatalogHistory,
    type CatalogPageDetail,
    type CatalogTree,
    CLUB_BUY,
    CLUB_GIFTS,
    CLUB_GIFTS_PAGE_NAME,
    CLUB_PAGE_NAME,
    useCatalogEdit,
    useCatalogFeatured,
    useCatalogHistory,
    useCatalogPage,
    useCatalogTree,
} from '#/api/catalog';
import { ask } from '#/components/confirm';
import { Modal } from '#/components/Modal';
import { Tabs } from '#/components/Tabs';
import { celebrate, toast, toastError } from '#/components/toast';
import { Badge, Button, EmptyState, ErrorNotice, Loading, PageBody, PageHeader, Segmented, WarningNotice } from '#/components/ui';
import { cx } from '#/lib/cx';
import { useFillHeight } from '#/lib/fillHeight';

import { Backups } from './Backups';
import { CatalogHome } from './CatalogHome';
import { CatalogImages } from './CatalogImages';
import { catalogTabs } from './catalogTabs';
import { ChangesBar } from './ChangesBar';
import { Duplicates } from './Duplicates';
import { FeaturedEditor } from './FeaturedEditor';
import { GenerateCatalog } from './GenerateCatalog';
import { ImportCapture } from './ImportCapture';
import { DISPLAY_LABELS, stepLabel } from './labels';
import { layoutOf, showsOffers } from './layouts';
import { MissingFurni } from './MissingFurni';
import { OfferInspector, type OfferStart } from './OfferInspector';
import { offerKey } from './offers';
import { OfferFace } from './OfferTile';
import { PageBuilder } from './PageBuilder';
import { type PageDraft, pageDraftOf } from './pageDraft';
import { PageInspector } from './PageInspector';
import { PagePreview, type SlotRef } from './PagePreview';
import { PageIcon, PageRowBody, PageTree } from './PageTree';
import { ancestorsOf, childrenOf } from './tree';
import { flatten, movePageIn, project } from './treeDrag';
import { TreeResizer } from './TreeResizer';
import { useTreeWidth } from './treeWidth';

/** What a new offer starts as on a page of this layout. */
/** What a new offer on a page with this layout starts as: a membership on any club shop (club_buy, vip_buy, loyalty_vip_buy), a gift with the gifts. */
const startOf = (layout: string): OfferStart => {
    const kind = layoutOf(layout).kind;

    return kind === 'club' ? 'membership' : kind === 'gifts' ? 'gift' : 'item';
};

/** What is being dragged: a page from the tree, or an offer from the page. */
type Dragging = { kind: 'page'; id: number } | { kind: 'offer'; id: number };

/** The editor's views, along the header. */
type View = 'editor' | 'images' | 'missing' | 'duplicates' | 'generate' | 'import' | 'backups';

const VIEWS: View[] = [ 'editor', 'images', 'missing', 'duplicates', 'generate', 'import', 'backups' ];

/** Where each view is under `/catalog/`: the audit's two by `audit/`. */
const VIEW_PATHS: Record<View, string> = { editor: 'editor', images: 'images', missing: 'audit/missing', duplicates: 'audit/duplicates', generate: 'generate', import: 'import', backups: 'backups' };

const idOf = (dragId: string | number) => Number(String(dragId).split(':')[1]);
const kindOf = (dragId: string | number) => String(dragId).split(':')[0];

/** Whether a key press is meant for a field, which keeps its own undo. */
const inField = (target: EventTarget | null) =>
    target instanceof HTMLElement && (target.isContentEditable || [ 'INPUT', 'TEXTAREA', 'SELECT' ].includes(target.tagName));

/**
 * Who a dragged thing can land on: a page only among the pages; an offer on a page in the tree when
 * the pointer is over one, and otherwise among the offers.
 */
const collision: CollisionDetection = (args) => {
    const kind = args.active.data.current?.kind;
    const pages = args.droppableContainers.filter(x => x.data.current?.kind === 'page');

    if (kind === 'page')
        return closestCenter({ ...args, droppableContainers: pages });

    const overPage = pointerWithin({ ...args, droppableContainers: pages });

    if (overPage.length > 0)
        return overPage;

    return closestCenter({ ...args, droppableContainers: args.droppableContainers.filter(x => x.data.current?.kind === 'offer') });
};

/**
 * What is missing for players to reach the club shop: memberships on offer with no shown page the
 * client's club buttons open (link key hc_membership), or club gifts with no shown club_gifts page
 * to list them; and adding one, with the layout that shows them.
 */
const ClubShopNotices = ({ tree, busy, onAdd }: { tree: CatalogTree; busy: boolean; onAdd: (title: string, name: string, layout: string) => void }) => {
    const club = tree.club;

    return (
        <>
            {club.memberships > 0 && club.clubBuyPageId === null && (
                <WarningNotice>
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
                        <span>{club.memberships} {club.memberships === 1 ? 'membership is' : 'memberships are'} on offer, but no shown page has the link key {CLUB_PAGE_NAME}, which the client's club buttons open, so players can't reach the club window.</span>
                        {tree.canManage && <Button variant="secondary" disabled={busy} onClick={() => onAdd('Habbo Club', CLUB_PAGE_NAME, CLUB_BUY)} className="h-8 sm:h-8">Add a Habbo Club page</Button>}
                    </span>
                </WarningNotice>
            )}
            {club.gifts > 0 && club.clubGiftsPageId === null && (
                <WarningNotice>
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
                        <span>{club.gifts} club {club.gifts === 1 ? 'gift is' : 'gifts are'} on offer, but no shown page has the link key {CLUB_GIFTS_PAGE_NAME}, which the client opens to list them.</span>
                        {tree.canManage && <Button variant="secondary" disabled={busy} onClick={() => onAdd('Club Gifts', CLUB_GIFTS_PAGE_NAME, CLUB_GIFTS)} className="h-8 sm:h-8">Add a club gifts page</Button>}
                    </span>
                </WarningNotice>
            )}
        </>
    );
};

/** What the open page shows: itself as the client draws it, its settings, or the front page's featured items. */
type PageTab = 'preview' | 'settings' | 'featured';

/**
 * The catalog editor. Its views: the editor itself - the page tree on the left, the picked page in
 * the middle drawn as the client draws it, and on the right what is being edited (the page, an
 * offer, or the front page's featured items); the pictures its pages show, to find and upload;
 * the audit, of the furni the catalog doesn't sell and the furni it sells twice; generating a
 * whole catalog; and backups to roll back to. Vouchers and
 * songs are pages of their own under the same tabs. Edits are saved as they are made, can be undone
 * and redone (Ctrl+Z, Ctrl+Shift+Z) or thrown away together, and go in front of players when
 * published. The view, the open page and offer live in the address, so they can be linked to.
 */
const CatalogEditor = ({ view }: { view: View }) => {
    const [ params, setParams ] = useSearchParams();
    const navigate = useNavigate();
    const selected = Number(params.get('page')) || null;
    const offerParam = params.get('offer');
    const selectedOffer: number | 'new' | null = offerParam === 'new' ? 'new' : Number(offerParam) || null;
    const tree = useCatalogTree();
    const data = tree.data;
    const page = useCatalogPage(view === 'editor' ? selected : null);
    const featured = useCatalogFeatured();
    const history = useCatalogHistory(!!data?.canManage);
    const publish = useCatalogEdit(catalogCalls.publish);
    const discard = useCatalogEdit(catalogCalls.discard);
    const addPage = useCatalogEdit(catalogCalls.createPage);
    const frontPage = useCatalogEdit(catalogCalls.createFrontPage);
    const movePage = useCatalogEdit(catalogCalls.movePage);
    const moveOffer = useCatalogEdit(catalogCalls.moveOffer);
    const queryClient = useQueryClient();
    const publishButton = useRef<HTMLDivElement>(null);
    const tabsId = useId();
    const tabIds = { tab: (value: string) => `${tabsId}-tab-${value}`, panel: (value: string) => `${tabsId}-panel-${value}` };

    // Undoing or redoing several steps is one call after another, newest first.
    const step = useMutation({
        mutationFn: async ({ undo, steps }: { undo: boolean; steps: number }) => {
            let last: CatalogHistory | null = null;

            for (let i = 0; i < steps; i++)
                last = await (undo ? catalogCalls.undo() : catalogCalls.redo());

            return last;
        },
        onSettled: () => void queryClient.invalidateQueries({ queryKey: [ 'catalog' ] }),
    });

    const [ open, setOpen ] = useState<Set<number>>(() => new Set(selected && data ? ancestorsOf(data, selected).map(x => x.id) : []));
    const [ tab, setTab ] = useState<PageTab>('preview');
    const [ focus, setFocus ] = useState<(SlotRef & { at: number }) | null>(null);
    const [ dragging, setDragging ] = useState<Dragging | null>(null);
    const [ overPage, setOverPage ] = useState<number | null>(null);
    const [ offsetX, setOffsetX ] = useState(0);
    const [ building, setBuilding ] = useState(false);
    const [ addingFurni, setAddingFurni ] = useState(false);
    const [ treeWidth, setTreeWidth ] = useTreeWidth();
    const fillTree = useFillHeight<HTMLElement>();

    // The page's edit, kept until it is saved or the page changes underneath it.
    const savedKey = page.data ? JSON.stringify(pageDraftOf(page.data)) + page.data.id : '';
    const [ pageEdit, setPageEdit ] = useState<{ key: string; draft: PageDraft } | null>(null);
    const draft = page.data ? (pageEdit?.key === savedKey ? pageEdit.draft : pageDraftOf(page.data)) : null;
    const setDraft = (next: PageDraft) => setPageEdit({ key: savedKey, draft: next });

    const sensors = useSensors(
        useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
        // Space picks a page or a tile up; Enter is left to open what has the focus.
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates, keyboardCodes: { start: [ 'Space' ], cancel: [ 'Escape' ], end: [ 'Space', 'Enter' ] } }),
    );

    const setView = (next: View) => void navigate({ pathname: `/catalog/${VIEW_PATHS[next]}`, search: params.toString() });

    // Opening a page opens the pages above it in the tree, so it is in sight.
    const openPage = (id: number | null, offer?: number | 'new') => {
        const next = new URLSearchParams();

        if (id && id !== data?.rootId)
            next.set('page', String(id));

        if (offer)
            next.set('offer', String(offer));

        void navigate({ pathname: '/catalog/editor', search: next.toString() });
        setTab('preview');
        publish.reset();

        if (id && data)
            setOpen(current => new Set([ ...current, ...ancestorsOf(data, id).map(x => x.id) ]));
    };

    const selectOffer = (id: number | 'new' | null) => {
        const next = new URLSearchParams(params);

        if (id)
            next.set('offer', String(id));
        else
            next.delete('offer');

        setParams(next, { replace: true });
    };

    const undoRedo = (undo: boolean, steps: number) => {
        const list = undo ? history.data?.undo : history.data?.redo;
        const first = list?.[0];

        if (!first || step.isPending)
            return;

        step.mutate({ undo, steps }, {
            onSuccess: () => toast(steps === 1 ? `${undo ? 'Undid' : 'Redid'}: ${stepLabel(first)}.` : `${undo ? 'Undid' : 'Redid'} ${steps} steps.`),
            onError: toastError,
        });
    };

    // Ctrl+Z undoes and Ctrl+Shift+Z (or Ctrl+Y) redoes, wherever the focus is but in a field.
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (!(event.ctrlKey || event.metaKey) || inField(event.target) || !data?.canManage)
                return;

            const key = event.key.toLowerCase();

            if (key === 'z' || key === 'y') {
                event.preventDefault();
                undoRedo(key === 'z' && !event.shiftKey, 1);
            }
        };

        window.addEventListener('keydown', onKey);

        return () => window.removeEventListener('keydown', onKey);
    });

    // An undo can take away the open page: then nothing is open.
    useEffect(() => {
        if (data && selected && !data.pages.some(x => x.id === selected))
            setParams(new URLSearchParams(), { replace: true });
    }, [ data, selected, setParams ]);

    const rows = useMemo(() => (data ? flatten(data, open, dragging?.kind === 'page' ? dragging.id : undefined) : []), [ data, open, dragging ]);
    const projection = data && dragging?.kind === 'page' && overPage ? project(rows, dragging.id, overPage, offsetX, data.rootId) : null;

    const onDragStart = ({ active }: DragStartEvent) => {
        setDragging({ kind: kindOf(active.id) as Dragging['kind'], id: idOf(active.id) });
        setOverPage(kindOf(active.id) === 'page' ? idOf(active.id) : null);
        setOffsetX(0);
    };

    const onDragMove = ({ delta, over }: DragMoveEvent) => {
        setOffsetX(delta.x);
        setOverPage(over && kindOf(over.id) === 'page' ? idOf(over.id) : null);
    };

    const endDrag = () => {
        setDragging(null);
        setOverPage(null);
        setOffsetX(0);
    };

    const onDragEnd = ({ over }: DragEndEvent) => {
        const was = dragging;
        const landing = projection;

        endDrag();

        if (!data || !was || !over)
            return;

        if (was.kind === 'page' && landing) {
            const moving = data.pages.find(x => x.id === was.id);
            const siblings = (childrenOf(data).get(landing.parentId) ?? []).filter(x => x.id !== was.id);
            const unchanged = moving?.parentId === landing.parentId && (childrenOf(data).get(landing.parentId) ?? []).findIndex(x => x.id === was.id) === landing.index;

            if (unchanged || !moving)
                return;

            const parent = landing.parentId === data.rootId ? 'the top level' : data.pages.find(x => x.id === landing.parentId)?.localization;

            queryClient.setQueryData<CatalogTree>([ 'catalog', 'tree' ], current => (current ? movePageIn(current, was.id, landing.parentId, landing.index) : current));

            if (landing.parentId !== data.rootId)
                setOpen(current => new Set(current).add(landing.parentId));

            movePage.mutate([ was.id, landing.parentId, Math.min(landing.index, siblings.length) ], {
                onSuccess: () => toast(`Moved ${moving.localization} into ${parent}.`),
                onError: toastError,
            });

            return;
        }

        if (was.kind !== 'offer' || !page.data)
            return;

        const fromPage = page.data;
        const offer = fromPage.offers.find(x => x.id === was.id);

        if (!offer)
            return;

        // Onto a page in the tree: it goes to the end of that page.
        if (kindOf(over.id) === 'page') {
            const target = idOf(over.id);
            const targetPage = data.pages.find(x => x.id === target);

            if (target === fromPage.id || !targetPage)
                return;

            queryClient.setQueryData<CatalogPageDetail>([ 'catalog', 'page', fromPage.id ], current => (current ? { ...current, offers: current.offers.filter(x => x.id !== offer.id) } : current));

            if (selectedOffer === offer.id)
                selectOffer(null);

            moveOffer.mutate([ offer.id, target, targetPage.offerCount ], {
                onSuccess: () => toast(`Moved the offer to ${targetPage.localization}.`),
                onError: toastError,
            });

            return;
        }

        // Among the page's own offers: it takes the place of the one it was dropped on.
        const from = fromPage.offers.findIndex(x => x.id === offer.id);
        const to = fromPage.offers.findIndex(x => x.id === idOf(over.id));

        if (to < 0 || from === to)
            return;

        queryClient.setQueryData<CatalogPageDetail>([ 'catalog', 'page', fromPage.id ], current => (current ? { ...current, offers: arrayMove(current.offers, from, to) } : current));
        moveOffer.mutate([ offer.id, fromPage.id, to ], { onError: toastError });
    };

    const addUnder = (parentId: number) => addPage.mutate(
        [ { parentId, localization: 'New page', name: null, icon: 0, layout: 'default_3x3', imageData: [], textData: [], display: 'invisible' } ],
        {
            onSuccess: (saved) => {
                toast('Added a hidden page, ready to set up.');
                openPage(saved.id);
            },
            onError: toastError,
        },
    );

    const openFromModal = (id: number) => {
        setAddingFurni(false);
        openPage(id);
    };

    const createFrontPage = () => frontPage.mutate([], {
        onSuccess: (saved) => {
            toast('Made the front page, first among the tabs. Pick its featured items.');
            openPage(saved.id);
            setTab('featured');
        },
        onError: toastError,
    });

    const unpublished = history.data?.unpublishedChanges ?? data?.unpublishedChanges ?? 0;
    const busy = step.isPending || publish.isPending || discard.isPending;

    const doPublish = () => {
        ask({ title: 'Publish the catalog?', body: 'Everyone online gets the new catalog at once.', confirm: 'Publish' }, () => {
            publish.mutate([], {
                onSuccess: (result) => {
                    celebrate(publishButton.current);
                    toast(`Live! ${result.offers.toLocaleString()} offers on ${result.pages.toLocaleString()} pages; ${result.playersTold} ${result.playersTold === 1 ? 'player' : 'players'} told to refresh.`);
                },
                onError: toastError,
            });
        });
    };

    const doDiscard = () => {
        const steps = history.data?.undo.length ?? 0;

        ask({
            title: `Throw away ${steps} ${steps === 1 ? 'change' : 'changes'}?`,
            body: 'The saved catalog goes back to the one players have. You can redo them afterwards.',
            confirm: 'Throw away',
        }, () => {
            discard.mutate([], {
                onSuccess: () => toast('Thrown away: the catalog is the one players have.'),
                onError: toastError,
            });
        });
    };

    const path = data && selected ? ancestorsOf(data, selected).map(x => x.localization).reverse() : [];
    const spec = draft ? layoutOf(draft.layout) : null;
    const isFeatured = spec?.kind === 'featured';
    const offer = page.data && typeof selectedOffer === 'number' ? page.data.offers.find(x => x.id === selectedOffer) ?? null : null;
    const shownTab: PageTab = tab === 'featured' && !isFeatured ? 'preview' : tab;
    const pageDirty = !!draft && !!page.data && JSON.stringify(draft) !== JSON.stringify(pageDraftOf(page.data));
    const draggedPage = dragging?.kind === 'page' ? data?.pages.find(x => x.id === dragging.id) : undefined;
    const draggedOffer = dragging?.kind === 'offer' ? page.data?.offers.find(x => x.id === dragging.id) : undefined;

    return (
        <>
            <PageHeader
                title="Catalog"
                description={data ? `${(data.pages.length - 1).toLocaleString()} pages · ${unpublished > 0 ? `${unpublished} ${unpublished === 1 ? 'change' : 'changes'} waiting to go live` : 'everything is live'}` : 'Pages, offers and prices'}
                tabs={{
                    ...catalogTabs(view === 'missing' || view === 'duplicates' ? 'audit' : view, true),
                    onChange: value => setView(value === 'audit' ? 'missing' : value as View),
                }}
            />
            {/* Without the rising entrance: a transformed parent would move the drag overlay. */}
            <PageBody still className="flex flex-col gap-4 lg:gap-5">
                {tree.error && <ErrorNotice error={tree.error} />}
                {tree.isPending && <Loading />}
                {data?.canManage && (
                    <ChangesBar
                        history={history.data}
                        unpublished={unpublished}
                        busy={busy}
                        onUndo={steps => undoRedo(true, steps)}
                        onRedo={steps => undoRedo(false, steps)}
                        onDiscard={doDiscard}
                        onPublish={doPublish}
                        onBuild={() => setBuilding(true)}
                        publishRef={publishButton}
                    />
                )}
                {data && (
                    <ClubShopNotices
                        tree={data}
                        busy={addPage.isPending}
                        onAdd={(title, name, layout) => addPage.mutate(
                            [ { parentId: data.rootId, localization: title, name, icon: 0, layout, imageData: [], textData: [], display: 'regular' } ],
                            { onSuccess: saved => openPage(saved.id), onError: toastError },
                        )}
                    />
                )}

                {data && (view === 'missing' || view === 'duplicates') && (
                    <div className="sm:max-w-sm">
                        <Segmented
                            label="What to audit"
                            value={view}
                            onChange={value => setView(value as View)}
                            options={[ { value: 'missing', label: 'Not sold' }, { value: 'duplicates', label: 'Sold twice' } ]}
                        />
                    </div>
                )}
                {data && view === 'missing' && <MissingFurni tree={data} pageId={selected} onOpenPage={id => openPage(id)} />}
                {data && view === 'duplicates' && <Duplicates tree={data} onOpen={(pageId, offerId) => openPage(pageId, offerId)} />}
                {data && view === 'generate' && <GenerateCatalog tree={data} onDone={() => openPage(null)} />}
                {data && view === 'import' && <ImportCapture tree={data} />}
                {data && view === 'backups' && <Backups tree={data} />}
                {data && view === 'images' && <CatalogImages tree={data} onOpenPage={id => openPage(id)} />}

                {data && view === 'editor' && (
                    data.rootId === 0
                        ? <EmptyState>This catalog has no pages.</EmptyState>
                        : (
                                <DndContext sensors={sensors} collisionDetection={collision} onDragStart={onDragStart} onDragMove={onDragMove} onDragEnd={onDragEnd} onDragCancel={endDrag}>
                                    {/* A phone has no room beside the tree for the home: a short summary of it goes above. */}
                                    {selected === null && (
                                        <div className="lg:hidden">
                                            <CatalogHome tree={data} busy={frontPage.isPending} compact onOpenPage={id => openPage(id)} onView={setView} onCreateFrontPage={createFrontPage} />
                                        </div>
                                    )}
                                    <div className="grid items-start gap-3 lg:grid-cols-[var(--tree-width)_minmax(0,1fr)]" style={{ '--tree-width': `${treeWidth}px` } as CSSProperties}>
                                        <aside
                                            ref={fillTree}
                                            aria-label="Pages"
                                            className={cx(
                                                'flex flex-col overflow-hidden rounded-xl border border-line bg-surface lg:sticky lg:top-6 lg:max-h-(--fill-height)',
                                                selected !== null && 'max-lg:hidden',
                                            )}
                                        >
                                            <TreeResizer width={treeWidth} onWidth={setTreeWidth} />
                                            <PageTree
                                                tree={data}
                                                rows={rows}
                                                open={open}
                                                selected={selected}
                                                projection={projection}
                                                onToggle={id => setOpen((current) => {
                                                    const next = new Set(current);

                                                    if (!next.delete(id))
                                                        next.add(id);

                                                    return next;
                                                })}
                                                onSetOpen={setOpen}
                                                onSelect={id => openPage(id)}
                                                onAddUnder={addUnder}
                                            />
                                        </aside>

                                        {selected === null
                                            ? (
                                                    <div className="min-w-0 max-lg:hidden">
                                                        <CatalogHome tree={data} busy={frontPage.isPending} onOpenPage={id => openPage(id)} onView={setView} onCreateFrontPage={createFrontPage} />
                                                    </div>
                                                )
                                            : (
                                                    <div className="flex min-w-0 flex-col gap-3">
                                                        <div className="overflow-hidden rounded-xl border border-line bg-surface">
                                                            <div className="flex min-w-0 items-center gap-2 px-2 py-2">
                                                                <Button variant="ghost" icon={<ArrowLeft />} onClick={() => openPage(null)} className="lg:hidden">Pages</Button>
                                                                {draft && <PageIcon icon={draft.icon} className="ml-1 size-7 max-lg:hidden" />}
                                                                <div className="min-w-0 flex-1">
                                                                    <nav aria-label="Where it is" className="flex min-w-0 items-center gap-1 truncate text-xs text-muted">
                                                                        {path.length === 0 && <span>Tab</span>}
                                                                        {ancestorsOf(data, selected).reverse().map((x, i) => (
                                                                            <span key={x.id} className="flex min-w-0 items-center gap-1">
                                                                                {i > 0 && <span aria-hidden>/</span>}
                                                                                <button type="button" onClick={() => openPage(x.id)} className="truncate hover:text-accent hover:underline">{x.localization}</button>
                                                                            </span>
                                                                        ))}
                                                                    </nav>
                                                                    <div className="truncate font-semibold">{draft?.localization ?? '…'}</div>
                                                                </div>
                                                                <span className="ml-auto flex shrink-0 items-center gap-1.5">
                                                                    {draft && draft.display !== 'regular' && <Badge className="max-sm:hidden">{DISPLAY_LABELS[draft.display]}</Badge>}
                                                                    {data.canManage && page.data && spec && showsOffers(spec) && (
                                                                        <Button variant="secondary" icon={<PackagePlus />} onClick={() => setAddingFurni(true)} title="Put furni the catalog doesn't sell yet on this page" aria-label="Add furni">
                                                                            <span className="max-sm:hidden">Add furni</span>
                                                                        </Button>
                                                                    )}
                                                                </span>
                                                            </div>
                                                            {page.data && draft && (
                                                                <Tabs
                                                                    label="The page"
                                                                    value={shownTab}
                                                                    onChange={value => setTab(value as PageTab)}
                                                                    ids={tabIds}
                                                                    rule={false}
                                                                    className="border-t border-line px-2"
                                                                    tabs={[
                                                                        { value: 'preview', label: 'Page', icon: <Eye /> },
                                                                        {
                                                                            value: 'settings',
                                                                            icon: <Settings2 />,
                                                                            label: (
                                                                                <>
                                                                                    Settings
                                                                                    {pageDirty && <span className="size-1.5 rounded-full bg-accent" aria-label="unsaved changes" role="img" />}
                                                                                </>
                                                                            ),
                                                                        },
                                                                        ...(isFeatured ? [ { value: 'featured', label: 'Featured items', icon: <Sparkles /> } ] : []),
                                                                    ]}
                                                                />
                                                            )}
                                                        </div>
                                                        {page.error && <ErrorNotice error={page.error} />}
                                                        {page.isPending && <Loading />}
                                                        {page.data && draft && shownTab === 'preview' && (
                                                            <div role="tabpanel" id={tabIds.panel('preview')} aria-labelledby={tabIds.tab('preview')}>
                                                                <PagePreview
                                                                    tree={data}
                                                                    page={page.data}
                                                                    draft={draft}
                                                                    featured={featured.data?.items ?? []}
                                                                    selectedOffer={selectedOffer}
                                                                    onSelectOffer={id => selectOffer(selectedOffer === id ? null : id)}
                                                                    onAddOffer={() => selectOffer('new')}
                                                                    onEditSlot={(slot) => {
                                                                        const at = Date.now();

                                                                        setTab('settings');
                                                                        setFocus({ ...slot, at });
                                                                        // The field stays lit a moment, to be found.
                                                                        setTimeout(() => setFocus(current => (current?.at === at ? null : current)), 2500);
                                                                    }}
                                                                    onEditFeatured={() => setTab('featured')}
                                                                />
                                                            </div>
                                                        )}
                                                        {page.data && draft && shownTab === 'settings' && (
                                                            <div role="tabpanel" id={tabIds.panel('settings')} aria-labelledby={tabIds.tab('settings')} className="overflow-clip rounded-xl border border-line bg-surface">
                                                                <PageInspector tree={data} page={page.data} draft={draft} onDraft={setDraft} focus={focus} onOpen={openPage} />
                                                            </div>
                                                        )}
                                                        {page.data && shownTab === 'featured' && (
                                                            <div role="tabpanel" id={tabIds.panel('featured')} aria-labelledby={tabIds.tab('featured')} className="overflow-clip rounded-xl border border-line bg-surface">
                                                                {featured.data && <FeaturedEditor key={JSON.stringify(featured.data.items)} tree={data} items={featured.data.items} offers={page.data.offers} />}
                                                                {featured.error && <div className="p-4"><ErrorNotice error={featured.error} /></div>}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                    </div>
                                    {/* On the body, so the overlay sits under the pointer whatever is transformed around the editor. */}
                                    {createPortal(
                                        <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.2, 0.8, 0.3, 1)' }} zIndex={60}>
                                            {draggedPage && (
                                                <div className="flex h-10 w-72 items-center gap-2 rounded-lg border border-accent bg-surface px-3 text-[13px] shadow-2xl ring-4 ring-accent-soft">
                                                    <PageRowBody page={draggedPage} />
                                                </div>
                                            )}
                                            {draggedOffer && (
                                                <div className="flex w-24 -rotate-2 flex-col items-center gap-1 rounded-xl border border-accent bg-surface p-1.5 shadow-2xl ring-4 ring-accent-soft">
                                                    <OfferFace offer={draggedOffer} tree={data} />
                                                </div>
                                            )}
                                        </DragOverlay>,
                                        document.body,
                                    )}
                                </DndContext>
                            )
                )}
            </PageBody>
            {data && page.data && (
                <Modal
                    title={selectedOffer === 'new' ? `New offer on ${page.data.localization}` : offer ? `Offer ${offer.id}` : 'Offer'}
                    open={view === 'editor' && (selectedOffer === 'new' || offer !== null)}
                    onClose={() => selectOffer(null)}
                    className="sm:max-w-2xl"
                >
                    {(selectedOffer === 'new' || offer) && (
                        <OfferInspector
                            key={selectedOffer === 'new' ? `new:${page.data.id}` : offerKey(offer)}
                            tree={data}
                            pageId={page.data.id}
                            offer={offer}
                            start={startOf(page.data.layout)}
                            featured={featured.data?.items ?? null}
                            onDone={() => selectOffer(null)}
                            onCreated={id => selectOffer(id)}
                        />
                    )}
                </Modal>
            )}
            {data && building && (
                <PageBuilder
                    key={page.data?.id ?? 'new'}
                    tree={data}
                    page={view === 'editor' ? page.data ?? null : null}
                    open
                    onClose={() => setBuilding(false)}
                    onBuiltPage={id => openPage(id)}
                />
            )}
            {data && page.data && (
                <Modal title={`Add furni to ${page.data.localization}`} open={addingFurni} onClose={() => setAddingFurni(false)} className="sm:max-w-6xl">
                    <div className="p-4">
                        <MissingFurni key={page.data.id} tree={data} pageId={page.data.id} onAdded={() => setAddingFurni(false)} onOpenPage={openFromModal} />
                    </div>
                </Modal>
            )}
        </>
    );
};

/**
 * The catalog at `/catalog/<view>`: a path that names no view goes to the editor, or the audit's
 * first view for `audit`, keeping the page and offer it had open.
 */
export const CatalogPage = () => {
    const path = useParams();
    const { search } = useLocation();
    const view = VIEWS.find(x => VIEW_PATHS[x] === [ path.view, path.sub ].filter(Boolean).join('/'));

    if (!view)
        return <Navigate to={{ pathname: `/catalog/${VIEW_PATHS[path.view === 'audit' ? 'missing' : 'editor']}`, search }} replace />;

    return <CatalogEditor view={view} />;
};

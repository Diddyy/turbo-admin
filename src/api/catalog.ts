import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { postForm } from './bundles';
import { api, post, put, remove } from './client';

/**
 * Which catalogs show a page. Both catalogs are cut from the one tree: a page shown in one brings
 * the pages above it along, so the client can reach it. `invisible` stays in the normal catalog,
 * hidden, for links that open it by name.
 */
export type PageDisplay = 'regular' | 'bc_only' | 'both' | 'invisible';

export interface CatalogPageNode {
    id: number;
    parentId: number | null;
    localization: string;
    name: string | null;
    icon: number;
    layout: string;
    display: PageDisplay;
    sortOrder: number;
    offerCount: number;
}

export interface CatalogCurrency {
    id: number;
    name: string;
    activityPointType: number;
}

/** The club shop: what the club window sells, and the shown pages that open it. */
export interface CatalogClubSummary {
    memberships: number;
    gifts: number;
    clubBuyPageId: number | null;
    clubGiftsPageId: number | null;
}

export interface CatalogTree {
    rootId: number;
    pages: CatalogPageNode[];
    canManage: boolean;
    unpublishedChanges: number;
    currencies: CatalogCurrency[];
    layouts: string[];
    club: CatalogClubSummary;
}

export type Membership = 'HabboClub' | 'BuildersClub';

/** The layout whose page is the club window, listing every shown membership. */
export const CLUB_BUY = 'club_buy';

/** The layout whose page lists the club gifts. */
export const CLUB_GIFTS = 'club_gifts';

/** The name the client opens the club shop by, from the toolbar, the club centre and elsewhere. */
export const CLUB_PAGE_NAME = 'hc_membership';

/** The name the client opens the club gifts by. */
export const CLUB_GIFTS_PAGE_NAME = 'club_gifts';

export interface CatalogLimited {
    id: number;
    total: number;
    remaining: number;
    raffleWindowSeconds: number;
    startsAtUtc: string | null;
    endsAtUtc: string | null;
    active: boolean;
    raffleFinished: boolean;
}

export interface CatalogLimitedInput {
    totalQuantity: number;
    raffleWindowSeconds: number;
    startsAtUtc: string | null;
    endsAtUtc: string | null;
    active: boolean;
}

export type ProductKind = 'floor' | 'wall' | 'badge' | 'effect' | 'robot' | 'pet' | 'club';

export interface CatalogProduct {
    id: number;
    type: ProductKind;
    definitionId: number | null;
    definitionName: string | null;
    spriteId: number | null;
    extraParam: string | null;
    quantity: number;
    limited: CatalogLimited | null;
    subscriptionType: Membership | null;
    subscriptionDays: number;
}

export interface CatalogOffer {
    id: number;
    localizationId: string;
    costCredits: number;
    costCurrency: number;
    currencyTypeId: number | null;
    canGift: boolean;
    canBundle: boolean;
    clubLevel: number;
    visible: boolean;
    isClubGift: boolean;
    clubGiftDaysRequired: number | null;
    products: CatalogProduct[];
}

export interface CatalogPageDetail {
    id: number;
    parentId: number | null;
    localization: string;
    name: string | null;
    icon: number;
    layout: string;
    imageData: string[];
    textData: string[];
    display: PageDisplay;
    offers: CatalogOffer[];
}

export interface CatalogFurniture {
    id: number;
    name: string;
    spriteId: number;
    type: 'floor' | 'wall';
}

export interface CatalogPageInput {
    parentId?: number;
    localization: string;
    name: string | null;
    icon: number;
    layout: string;
    imageData: string[];
    textData: string[];
    display: PageDisplay;
}

export interface CatalogOfferInput {
    pageId: number;
    localizationId: string;
    costCredits: number;
    costCurrency: number;
    currencyTypeId: number | null;
    canGift: boolean;
    canBundle: boolean;
    clubLevel: number;
    visible: boolean;
    /** Null leaves what an existing offer gives as it is; `products` replaces it when given. */
    product: CatalogProductInput | null;
    /** Everything the offer gives, in order: replaces what it gave. */
    products?: CatalogProductInput[];
    /** Set: a club gift, claimed by members with this many days of club used up. */
    clubGiftDaysRequired: number | null;
}

export type EditableKind = 'floor' | 'wall' | 'badge' | 'effect' | 'robot' | 'pet' | 'club';

export interface CatalogProductInput {
    type: EditableKind;
    definitionId: number | null;
    extraParam: string | null;
    quantity: number;
    subscription: Membership | null;
    subscriptionDays: number;
}

interface Saved {
    id: number;
    unpublishedChanges: number;
}

/** Where a featured item takes the player: a page by its link key, an offer, or a product code. */
export type FeaturedLinkType = 'page' | 'offer' | 'product';

export interface CatalogFeaturedItem {
    id: number;
    position: number;
    title: string;
    image: string;
    type: FeaturedLinkType;
    value: string;
    expiresAtUtc: string | null;
}

export interface CatalogFeaturedInput {
    title: string;
    image: string;
    type: FeaturedLinkType;
    value: string;
    expiresAtUtc: string | null;
}

/** The client shows four: the first big, the others in a list beside it. */
export const FEATURED_MAX = 4;

export interface PublishResult {
    pages: number;
    offers: number;
    playersTold: number;
}

export const useCatalogTree = () => useQuery({
    queryKey: [ 'catalog', 'tree' ],
    queryFn: () => api<CatalogTree>('/catalog'),
});

export const useCatalogPage = (id: number | null) => useQuery({
    queryKey: [ 'catalog', 'page', id ],
    queryFn: () => api<CatalogPageDetail>(`/catalog/pages/${id}`),
    enabled: id !== null,
});

/**
 * The colours each of these furni is placed in from a `recolorable_furniture` page, as `RRGGBB` in
 * palette order, by its name; a furni that isn't recolorable is left out.
 */
export const useRecolorablePalettes = (names: string[]) => useQuery({
    queryKey: [ 'catalog', 'recolorable-palettes', names ],
    queryFn: () => api<Record<string, string[]>>(`/catalog/recolorable-palettes?${new URLSearchParams({ names: names.join(',') })}`),
    enabled: names.length > 0,
    staleTime: 5 * 60_000,
});

export const useFurnitureSearch = (text: string) => useQuery({
    queryKey: [ 'catalog', 'furniture', text ],
    queryFn: () => api<CatalogFurniture[]>(`/catalog/furniture?${new URLSearchParams({ q: text })}`),
    enabled: text.trim().length > 0,
    staleTime: 5 * 60_000,
});

/** The page builders: each makes a layout's offers (or pages) from the hotel's own data. */
export type BuilderKind = 'trophies' | 'pets' | 'colours' | 'furniLine' | 'petCustomization' | 'effects' | 'soldLimited' | 'spaces' | 'posters' | 'badgeDisplays' | 'songDiscs';

export interface BuildRequest {
    builder: BuilderKind;
    base: string | null;
    line: string | null;
    prefix: string | null;
    petType: number | null;
}

export interface BuildProduct {
    type: ProductKind;
    definitionId: number | null;
    definitionName: string | null;
    extraParam: string | null;
    quantity: number;
}

export interface BuildItem {
    key: string;
    title: string;
    localizationId: string;
    products: BuildProduct[];
    pageTitle: string | null;
    offerId: number | null;
    alreadyOffered: boolean;
    note: string | null;
}

export interface BuildPlan {
    builder: BuilderKind;
    layout: string;
    createsPages: boolean;
    items: BuildItem[];
    warnings: string[];
}

export interface BuildApply extends BuildRequest {
    keys: string[];
    costCredits: number;
    costCurrency: number;
    currencyTypeId: number | null;
    clubLevel: number;
    canGift: boolean;
    visible: boolean;
    setLayout: boolean;
    display: PageDisplay | null;
    /** Set: build onto a new page of this title, made under the page in the address. */
    newPageTitle?: string | null;
    newPageIcon?: number | null;
}

export interface BuildResult {
    offersCreated: number;
    pagesCreated: number;
    offersMoved: number;
    unpublishedChanges: number;
    failures: { key: string; error: string }[];
    /** The page it built onto: the new one, when it made one. */
    pageId: number | null;
}

export const useFurniLines = (enabled: boolean) => useQuery({
    queryKey: [ 'catalog', 'furni-lines' ],
    queryFn: () => api<{ lines: { line: string; count: number }[] }>('/catalog/builders/furni-lines'),
    enabled,
    staleTime: 10 * 60_000,
});

/** One step of the editor's history: what was done, by whom, when, and how many edits it took. */
export interface CatalogHistoryItem {
    label: string;
    editorId: number;
    atUtc: string;
    edits: number;
}

/** What can be undone (newest first) and redone (next first) since the last publish. */
export interface CatalogHistory {
    undo: CatalogHistoryItem[];
    redo: CatalogHistoryItem[];
    /** Older steps were let go: throwing everything away no longer reaches the published catalog. */
    truncated: boolean;
    unpublishedChanges: number;
}

/** A floor or wall item, as the audits list it. */
export interface AuditFurni {
    id: number;
    name: string;
    publicName: string | null;
    spriteId: number;
    type: 'floor' | 'wall';
    line: string | null;
    category: string | null;
}

export interface AuditFacet {
    value: string;
    count: number;
}

/** `missing`: in no offer; `hidden`: only in offers or on pages players can't see. */
export type UnofferedScope = 'missing' | 'hidden';

export interface UnofferedQuery {
    scope: UnofferedScope;
    q: string;
    line: string;
    category: string;
    page: number;
    size: number;
}

export interface UnofferedResult {
    total: number;
    items: AuditFurni[];
    lines: AuditFacet[];
    categories: AuditFacet[];
}

export interface DuplicateOffer {
    offerId: number;
    pageId: number;
    pageTitle: string;
    pagePath: string;
    costCredits: number;
    costCurrency: number;
    currencyTypeId: number | null;
    visible: boolean;
    /** Visible, and on a page players can reach. */
    shown: boolean;
}

export interface Duplicate {
    furni: AuditFurni;
    extraParam: string | null;
    offers: DuplicateOffer[];
}

/** A page of a name another page has too. `display` is regular, bc_only, both or invisible. */
export interface DuplicatePageItem {
    pageId: number;
    title: string;
    path: string;
    display: string;
    shown: boolean;
    offers: number;
    pages: number;
}

export interface DuplicatePage {
    name: string;
    pages: DuplicatePageItem[];
}

/** An offer of the pages a merge takes, where it is and what it costs. */
export interface PageMergeOffer {
    offerId: number;
    pageId: number;
    costCredits: number;
    costCurrency: number;
    currencyTypeId: number | null;
}

/** A thing more than one of the merged pages sells: the offer that stays, and those deleted. */
export interface PageMergeDuplicate {
    name: string;
    kept: PageMergeOffer;
    dropped: PageMergeOffer[];
}

/** What a merge would do; `display` is how the page kept would be shown. */
export interface PageMergePlan {
    offersMoved: number;
    offersDropped: number;
    pagesMoved: number;
    pagesDeleted: number;
    display: string;
    duplicates: PageMergeDuplicate[];
}

export interface PageMergeResult {
    offersMoved: number;
    offersDropped: number;
    pagesMoved: number;
    pagesDeleted: number;
    display: string;
    unpublishedChanges: number;
}

export interface AddFurniInput {
    definitionIds: number[];
    costCredits: number;
    costCurrency: number;
    currencyTypeId: number | null;
    clubLevel: number;
    canGift: boolean;
    visible: boolean;
    /** Sort them onto pages under it; null puts them all on it. */
    sortBy: AddFurniSort | null;
}

/** How added furni are sorted onto pages: by kind, by colour, or by kind and then each kind by colour. */
export type AddFurniSort = 'kind' | 'colour' | 'kindColour';

/** A page added furni would go on: one there already (`pageId`), or one to make; `count` takes in the pages under it. */
export interface AddFurniPage {
    title: string;
    pageId: number | null;
    count: number;
    pages: AddFurniPage[];
}

export interface BulkResult {
    done: number;
    unpublishedChanges: number;
    failures: { key: string; error: string }[];
}

/** The tabs a generated catalog can have. */
export type GenerateSection = 'front' | 'club' | 'furni' | 'wired' | 'pets' | 'extras' | 'rares' | 'groups' | 'builders';

export type GenerateMode = 'replace' | 'alongside';

export interface GeneratePageEdit {
    key: string;
    title: string | null;
    icon: number | null;
    skip: boolean;
}

export interface GenerateRequest {
    mode: GenerateMode;
    sections: GenerateSection[];
    reuseOffers: boolean;
    maxPerPage: number;
    costCredits: number;
    costCurrency: number;
    currencyTypeId: number | null;
    edits: GeneratePageEdit[];
}

export interface GeneratedPage {
    key: string;
    section: GenerateSection;
    title: string;
    name: string | null;
    icon: number;
    layout: string;
    display: PageDisplay;
    newOffers: number;
    movedOffers: number;
    children: GeneratedPage[];
}

export interface GeneratePlan {
    tabs: GeneratedPage[];
    warnings: string[];
    pages: number;
    newOffers: number;
    movedOffers: number;
    archivedTabs: number;
}

export interface GenerateResult {
    pages: number;
    offersCreated: number;
    offersMoved: number;
    pagesMoved: number;
    unpublishedChanges: number;
}

/** A Builders Club catalogue to take in from a capture of Habbo's: its index and every page, as its client was sent them. */
export interface ImportRequest {
    capture: unknown;
    takeOthersOut: boolean;
    publish: boolean;
}

/** Habbo's catalogues to take in from G-Earth packet logs of its client: the normal catalogue's, the Builders Club's, or both. */
export interface LogImportRequest {
    normal: File | null;
    buildersClub: File | null;
    takeOthersOut: boolean;
    publish: boolean;
}

/** What importing the packet logs would do, or did; null for a catalogue no log was given for. */
export interface LogImportPlan {
    normal: ImportPlan | null;
    buildersClub: ImportPlan | null;
    changes: boolean;
}

/** A page of the capture and what happens to it; `out` is a page here taken out of that catalogue. */
export interface ImportPageChange {
    name: string;
    title: string;
    path: string;
    action: 'add' | 'update' | 'unchanged' | 'out';
    pageId: number | null;
    fields: string[];
    offersAdded: number;
    offersChanged: number;
}

/** Part of the capture left out, and why. */
export interface ImportSkip {
    what: string;
    reason: string;
    offers: number;
}

/** What importing a capture would do, or did, to one catalogue; `category` is the tab the Builders Club's pages go under. */
export interface ImportPlan {
    catalog: 'NORMAL' | 'BUILDERS_CLUB';
    category: string;
    pages: ImportPageChange[];
    pagesTakenOut: ImportPageChange[];
    offersAdded: number;
    offersChanged: number;
    offersKept: number;
    offersUnchanged: number;
    skipped: ImportSkip[];
    missingClasses: string[];
    /** Pictures the pages show that this hotel has no file of, by the names the pages give them. */
    missingPictures: string[];
    warnings: string[];
    saved: boolean;
    published: boolean;
    unpublishedChanges: number;
    changes: boolean;
}

/** A kept copy of the catalog's pages, offers and featured items, to roll back to. */
export interface CatalogBackup {
    id: number;
    name: string;
    takenById: number;
    takenByName: string | null;
    takenAtUtc: string;
    /** Taken by the editor itself, of what a rollback replaced or a reset emptied. */
    automatic: boolean;
    pages: number;
    offers: number;
    products: number;
    featuredItems: number;
}

/** The layout of the page the catalogue opens on. */
export const FRONT_PAGE_LAYOUT = 'frontpage4';

export const useCatalogHistory = (enabled: boolean) => useQuery({
    queryKey: [ 'catalog', 'history' ],
    queryFn: () => api<CatalogHistory>('/catalog/history'),
    enabled,
});

export const useCatalogBackups = () => useQuery({
    queryKey: [ 'catalog', 'backups' ],
    queryFn: () => api<{ items: CatalogBackup[] }>('/catalog/backups'),
});

export const useUnoffered = (query: UnofferedQuery) => useQuery({
    queryKey: [ 'catalog', 'audit', 'unoffered', query ],
    queryFn: () => api<UnofferedResult>(`/catalog/audit/unoffered?${new URLSearchParams({ scope: query.scope, q: query.q, line: query.line, category: query.category, page: String(query.page), size: String(query.size) })}`),
    placeholderData: previous => previous,
});

/** Every furni the unoffered list holds as narrowed, past its pages. */
export const unofferedIds = (query: Omit<UnofferedQuery, 'page' | 'size'>) =>
    api<{ ids: number[] }>(`/catalog/audit/unoffered/ids?${new URLSearchParams({ scope: query.scope, q: query.q, line: query.line, category: query.category })}`);

/** The pages adding the furni, sorted so, would put them on. */
export const useAddFurniPlan = (pageId: number | null, definitionIds: number[], sortBy: AddFurniSort | null) => useQuery({
    queryKey: [ 'catalog', 'add-furni-plan', pageId, definitionIds, sortBy ],
    queryFn: () => post<{ pages: AddFurniPage[] }>(`/catalog/pages/${pageId}/furni/preview`, { definitionIds, sortBy }),
    enabled: sortBy !== null && pageId !== null && definitionIds.length > 0,
    placeholderData: previous => previous,
});

/** What merging the pages into `keepId` would do, the offers of `priorityPageId` staying where two sell the same thing. */
export const usePageMergePlan = (keepId: number | null, pageIds: number[], priorityPageId: number | null) => useQuery({
    queryKey: [ 'catalog', 'merge-plan', keepId, pageIds, priorityPageId ],
    queryFn: () => post<PageMergePlan>(`/catalog/pages/${keepId}/merge/preview`, { pageIds, priorityPageId }),
    enabled: keepId !== null && pageIds.some(x => x !== keepId),
    placeholderData: previous => previous,
});

export const useDuplicatePages = () => useQuery({
    queryKey: [ 'catalog', 'audit', 'duplicate-pages' ],
    queryFn: () => api<{ total: number; items: DuplicatePage[] }>('/catalog/audit/duplicate-pages'),
});

export const useDuplicates = () => useQuery({
    queryKey: [ 'catalog', 'audit', 'duplicates' ],
    queryFn: () => api<{ total: number; items: Duplicate[] }>('/catalog/audit/duplicates'),
});

export const useCatalogFeatured = () => useQuery({
    queryKey: [ 'catalog', 'featured' ],
    queryFn: () => api<{ items: CatalogFeaturedItem[] }>('/catalog/featured'),
});

export const catalogCalls = {
    createPage: (input: CatalogPageInput) => post<Saved>('/catalog/pages', input),
    updatePage: (id: number, input: CatalogPageInput) => put<Saved>(`/catalog/pages/${id}`, input),
    movePage: (id: number, parentId: number, index: number) => post<Saved>(`/catalog/pages/${id}/move`, { parentId, index }),
    deletePage: (id: number) => remove<Saved>(`/catalog/pages/${id}`),
    createOffer: (input: CatalogOfferInput) => post<Saved>('/catalog/offers', input),
    updateOffer: (id: number, input: CatalogOfferInput) => put<Saved>(`/catalog/offers/${id}`, input),
    moveOffer: (id: number, pageId: number, index: number) => post<Saved>(`/catalog/offers/${id}/move`, { pageId, index }),
    deleteOffer: (id: number) => remove<Saved>(`/catalog/offers/${id}`),
    saveFeatured: (items: CatalogFeaturedInput[]) => put<Saved>('/catalog/featured', { items }),
    saveLimited: (offerId: number, input: CatalogLimitedInput) => put<Saved>(`/catalog/offers/${offerId}/limited`, input),
    removeLimited: (offerId: number, withSales = false) => remove<Saved>(`/catalog/offers/${offerId}/limited${withSales ? '?withSales=true' : ''}`),
    publish: () => post<PublishResult>('/catalog/publish'),
    previewBuild: (pageId: number, request: BuildRequest) => post<BuildPlan>(`/catalog/pages/${pageId}/build/preview`, request),
    applyBuild: (pageId: number, request: BuildApply) => post<BuildResult>(`/catalog/pages/${pageId}/build`, request),
    addFurni: (pageId: number, input: AddFurniInput) => post<BulkResult>(`/catalog/pages/${pageId}/furni`, input),
    deleteOffers: (offerIds: number[]) => post<BulkResult>('/catalog/offers/delete', { offerIds }),
    createFrontPage: () => post<Saved>('/catalog/frontpage'),
    mergePages: (keepId: number, pageIds: number[], priorityPageId: number | null = null) => post<PageMergeResult>(`/catalog/pages/${keepId}/merge`, { pageIds, priorityPageId }),
    undo: () => post<CatalogHistory>('/catalog/undo'),
    redo: () => post<CatalogHistory>('/catalog/redo'),
    discard: () => post<CatalogHistory>('/catalog/discard'),
    backup: (name: string) => post<Saved>('/catalog/backups', { name }),
    rollback: (backupId: number) => post<CatalogHistory>(`/catalog/backups/${backupId}/rollback`),
    deleteBackup: (backupId: number) => remove<Saved>(`/catalog/backups/${backupId}`),
    reset: (removeLimited: boolean) => post<CatalogHistory>('/catalog/reset', { removeLimited }),
    previewGenerate: (request: GenerateRequest) => post<GeneratePlan>('/catalog/generate/preview', request),
    generate: (request: GenerateRequest) => post<GenerateResult>('/catalog/generate', request),
    previewImport: (request: ImportRequest) => post<ImportPlan>('/catalog/import/preview', request),
    importCapture: (request: ImportRequest) => post<ImportPlan>('/catalog/import', request),
    previewLogImport: (request: LogImportRequest) => postForm<LogImportPlan>('/catalog/import/logs/preview', logForm(request)),
    importLogs: (request: LogImportRequest) => postForm<LogImportPlan>('/catalog/import/logs', logForm(request)),
};

const logForm = (request: LogImportRequest) => {
    const form = new FormData();

    if (request.normal)
        form.append('normal', request.normal);

    if (request.buildersClub)
        form.append('buildersClub', request.buildersClub);

    form.append('takeOthersOut', String(request.takeOthersOut));
    form.append('publish', String(request.publish));

    return form;
};

/** A catalog edit; the tree and pages are read again once it lands, saved or not. */
export const useCatalogEdit = <A extends unknown[], R>(call: (...args: A) => Promise<R>) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (args: A) => call(...args),
        onSettled: () => void queryClient.invalidateQueries({ queryKey: [ 'catalog' ] }),
    });
};

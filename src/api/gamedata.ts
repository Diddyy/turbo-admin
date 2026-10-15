import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { BadgeTone } from '#/components/ui';

import { api, post, put } from './client';

/** Floor (0) or wall (1), as the server's ProductType numbers them. */
export const FURNITURE_KINDS: Record<number, string> = { 0: 'floor', 1: 'wall' };

/** What made a change set: GamedataChangeKind. */
export const CHANGE_KINDS: Record<number, string> = { 0: 'import', 1: 'edit', 2: 'rollback', 3: 'habbo values' };

/** What an import does to one of Habbo's items: FurnitureImportAction. */
export const IMPORT_ACTIONS: Record<number, string> = { 0: 'add', 1: 'update', 2: 'keep' };

/** Which table a change touched: GamedataRecordType. */
export const RECORD_TYPES: Record<number, string> = { 0: 'definition', 1: 'Habbo item', 2: 'text', 3: 'Habbo text', 4: 'product', 5: 'Habbo product', 6: 'figure', 7: 'Habbo figure', 8: 'variable' };

export interface HabboRelease {
    id: number;
    domain: string;
    revision: string;
    furnitureDataHash: string;
    furnitureCount: number;
    foundAt: string;
    checkedAt: string;
    /** Null until its furniture is taken in. */
    importedAt: string | null;
}

export interface GamedataFile {
    file: string;
    hash: string;
    size: number;
    builtAt: string;
}

export interface HabboTextVersion {
    id: number;
    domain: string;
    hash: string;
    textCount: number;
    foundAt: string;
    checkedAt: string;
    /** Null until it is taken in. */
    importedAt: string | null;
}

export interface HabboProductVersion {
    id: number;
    domain: string;
    hash: string;
    productCount: number;
    foundAt: string;
    checkedAt: string;
    /** Null until it is taken in. */
    importedAt: string | null;
}

export interface HabboFigureVersion {
    id: number;
    domain: string;
    hash: string;
    /** Its pieces of clothing. */
    setCount: number;
    colorCount: number;
    foundAt: string;
    checkedAt: string;
    /** Null until it is taken in. */
    importedAt: string | null;
}

export interface GamedataStatus {
    latestRelease: HabboRelease | null;
    latestTexts: HabboTextVersion | null;
    latestProducts: HabboProductVersion | null;
    latestFigures: HabboFigureVersion | null;
    furnitureData: GamedataFile;
    externalTexts: GamedataFile;
    productData: GamedataFile;
    figureData: GamedataFile;
    externalVariables: GamedataFile;
    /** The variables that carry each file's address, by file (`furnidata_json`): those that follow it. Absent from a server older than the panel. */
    fileKeys?: Record<string, string[]>;
    canManage: boolean;
}

/** The files the hotel builds, by the name their addresses give them. */
export const FILES = { furnitureData: 'furnidata_json', productData: 'productdata_json', externalTexts: 'external_flash_texts', figureData: 'figuredata_json', externalVariables: 'external_variables' } as const;

export interface FurnitureFieldChange {
    field: string;
    /** The hotel's value, as JSON. */
    current: string;
    /** Habbo's new value, as JSON. */
    incoming: string;
    /** The hotel changed it itself, so it keeps its value. */
    kept: boolean;
}

export interface FurnitureImportItem {
    productType: number;
    className: string;
    spriteId: number;
    definitionId: number | null;
    action: number;
    fields: FurnitureFieldChange[];
}

export interface FurnitureImportPreview {
    release: HabboRelease;
    added: number;
    updated: number;
    kept: number;
    unchanged: number;
    items: FurnitureImportItem[];
    truncated: boolean;
    /** Furniture asset files taking it in reads first. */
    filesToRead: number;
}

/** Where taking in a release is: GamedataImportPhase. */
export const IMPORT_PHASES: Record<number, string> = { 0: 'reading furniture files', 1: 'writing definitions', 2: 'done', 3: 'failed' };

export interface ImportJob {
    releaseId: number;
    /** What is taken in: furnidata_json or external_flash_texts. */
    file: string;
    revision: string;
    phase: number;
    filesTotal: number;
    filesDone: number;
    filesFailed: number;
    changeSet: ChangeSet | null;
    error: string | null;
    startedAt: string;
    finishedAt: string | null;
}

export interface ChangeSet {
    id: number;
    kind: number;
    summary: string;
    playerId: number | null;
    releaseId: number | null;
    revertsId: number | null;
    rolledBackById: number | null;
    changeCount: number;
    createdAt: string;
}

export interface Change {
    recordType: number;
    recordId: number;
    label: string;
    /** The fields before, as a JSON object; null for a row the set made. */
    before: string | null;
    after: string | null;
}

export interface RollbackResult {
    changeSet: ChangeSet;
    skipped: string[];
}

export interface FurnitureSearchItem {
    id: number;
    name: string;
    spriteId: number;
    type: string;
}

export interface FurnitureDefinition {
    id: number;
    productType: number;
    className: string;
    /** The item as the built FurnitureData writes it, as JSON. */
    item: string;
    /** Habbo's item in its newest release, as JSON; null for the hotel's own furniture. */
    habbo: string | null;
    /** What Habbo's asset file said, as JSON, or why it could not be read; null when not read. */
    habboFile: string | null;
    habboFileRead: boolean;
    /** Its total_states, which furnidata does not carry. */
    states: number;
    /** The bundle it is drawn from: its classname without the *N colour. */
    assetName: string;
    tags: FurnitureTag[];
}

/** Something to know about a furniture definition at a glance, as the server's FurnitureTag names it. */
export type FurnitureTag = 'hotel-own' | 'habbo-update' | 'edited' | 'no-bundle' | 'bundle-failed' | 'bundle-outdated' | 'not-sold';

/** Each tag in the order the list shows them: its words, its colour and what it means. */
export const FURNITURE_TAGS: { value: FurnitureTag; label: string; tone: BadgeTone; meaning: string }[] = [
    { value: 'no-bundle', label: 'no bundle', tone: 'red', meaning: 'No bundle has its asset: the client draws a placeholder.' },
    { value: 'bundle-failed', label: 'bundle failed', tone: 'red', meaning: 'Its bundle could not be downloaded or converted.' },
    { value: 'bundle-outdated', label: 'bundle outdated', tone: 'accent', meaning: 'Habbo has a newer revision of its bundle; a sync takes it.' },
    { value: 'habbo-update', label: 'Habbo update', tone: 'accent', meaning: 'Habbo\'s newest release changes fields the hotel left alone; taking it in brings them.' },
    { value: 'edited', label: 'edited', tone: 'amber', meaning: 'It holds values of the hotel\'s own where Habbo has others.' },
    { value: 'not-sold', label: 'not sold', tone: 'neutral', meaning: 'No visible offer on a page players can reach sells it.' },
    { value: 'hotel-own', label: 'hotel\'s own', tone: 'green', meaning: 'Habbo has no furniture of its kind and classname.' },
];

export const furnitureTag = (tag: FurnitureTag) => FURNITURE_TAGS.find(x => x.value === tag)!;

/** A furniture definition in the list. */
export interface FurnitureListItem {
    id: number;
    productType: number;
    className: string;
    name: string | null;
    spriteId: number;
    furniLine: string | null;
    category: string | null;
    /** The bundle it is drawn from: its classname without the *N colour. */
    assetName: string;
    tags: FurnitureTag[];
}

export interface FurnitureListPage {
    items: FurnitureListItem[];
    total: number;
    pageSize: number;
    /** Of those the words and kind find, how many carry each tag. */
    tagCounts: Partial<Record<FurnitureTag, number>>;
    /** How many the words and kind find, whichever tag is asked for. */
    searched: number;
}

export const useFurnitureList = (text: string, type: 'floor' | 'wall' | '', tag: FurnitureTag | '', page: number) => useQuery({
    queryKey: [ 'gamedata', 'furniture', 'list', text, type, tag, page ],
    queryFn: () => api<FurnitureListPage>(`/gamedata/furniture/list?${new URLSearchParams({ q: text, type, tag, page: String(page) })}`),
    placeholderData: keepPreviousData,
});

/**
 * How long a review of Habbo's changes is taken as it is. Working one out reads the whole release
 * on the server, so it is not asked for again on every visit or window focus; anything that
 * changes the gamedata (an edit, an import, a Habbo check) asks for it again at once.
 */
const PREVIEW_FRESHNESS = { staleTime: 5 * 60_000, refetchOnWindowFocus: false } as const;

export const useGamedataStatus = () => useQuery({
    queryKey: [ 'gamedata' ],
    queryFn: () => api<GamedataStatus>('/gamedata'),
});

/** Everything gamedata shows, asked again after a change. */
const useRefresh = () => {
    const queryClient = useQueryClient();

    return () => void queryClient.invalidateQueries({ queryKey: [ 'gamedata' ] });
};

export const useCheckHabbo = () => {
    const refresh = useRefresh();

    return useMutation({
        mutationFn: () => post<{ release: HabboRelease; isNew: boolean; texts: HabboTextVersion; textsAreNew: boolean; products: HabboProductVersion; productsAreNew: boolean; figures: HabboFigureVersion; figuresAreNew: boolean }>('/gamedata/habbo/check'),
        onSuccess: refresh,
    });
};

export const useImportPreview = (enabled: boolean) => useQuery({
    queryKey: [ 'gamedata', 'import' ],
    queryFn: () => api<FurnitureImportPreview>('/gamedata/habbo/import'),
    enabled,
    ...PREVIEW_FRESHNESS,
});

/** Starts taking a release in, in the background. */
export const useImport = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (releaseId: number) => post<{ job: ImportJob }>(`/gamedata/habbo/import/${releaseId}`),
        onSuccess: data => queryClient.setQueryData([ 'gamedata-import-job' ], data),
    });
};

/** The import running or run last, asked again each second while it runs. */
export const useImportJob = () => {
    const refresh = useRefresh();

    return useQuery({
        queryKey: [ 'gamedata-import-job' ],
        queryFn: async () => {
            const data = await api<{ job: ImportJob | null }>('/gamedata/habbo/import/job');

            if (data.job && data.job.phase >= 2)
                refresh();

            return data;
        },
        refetchInterval: query => (query.state.data?.job && query.state.data.job.phase < 2 ? 1000 : false),
    });
};

export const useRebuild = () => {
    const refresh = useRefresh();

    return useMutation({
        mutationFn: (file: string) => post<GamedataFile>(`/gamedata/files/${file}/build`),
        onSuccess: refresh,
    });
};

/**
 * Makes a variable the one that carries a file's address: it follows the file, and any other
 * variable that did is unlinked, keeping the file's /0 address.
 */
export const useSetFileKey = () => {
    const refresh = useRefresh();

    return useMutation({
        mutationFn: ({ file, key }: { file: string; key: string }) => put<VariableEntry>(`/gamedata/files/${file}/key`, { key }),
        onSuccess: refresh,
    });
};

export const useFurnitureSearch = (text: string) => useQuery({
    queryKey: [ 'gamedata', 'furniture', 'search', text ],
    queryFn: () => api<FurnitureSearchItem[]>(`/gamedata/furniture?${new URLSearchParams({ q: text })}`),
    enabled: text.trim().length > 0,
    placeholderData: keepPreviousData,
});

export const useFurnitureDefinition = (id: number | null) => useQuery({
    queryKey: [ 'gamedata', 'furniture', id ],
    queryFn: () => api<FurnitureDefinition>(`/gamedata/furniture/${id}`),
    enabled: id !== null,
});

export const useUpdateDefinition = (id: number) => {
    const refresh = useRefresh();

    return useMutation({
        mutationFn: (fields: Record<string, unknown>) => put<FurnitureDefinition>(`/gamedata/furniture/${id}`, { fields }),
        onSuccess: refresh,
    });
};

export interface HabboValuesPreview {
    /** Definitions whose value is not Habbo's, by furnidata key. */
    byField: Record<string, number>;
    /** Definitions with at least one such field. */
    definitions: number;
    /** The release Habbo's values come from; null before Habbo was checked. */
    release: HabboRelease | null;
}

/** How many definitions differ from Habbo in these fields. */
export const useHabboValuesPreview = (fields: string[]) => useQuery({
    queryKey: [ 'gamedata', 'habbo-values', fields ],
    queryFn: () => api<HabboValuesPreview>(`/gamedata/furniture/habbo-values?${new URLSearchParams({ fields: fields.join(',') })}`),
    enabled: fields.length > 0,
    placeholderData: keepPreviousData,
});

/** Puts Habbo's values back in these fields, over the hotel's, for all of Habbo's furniture. */
export const useTakeHabboValues = () => {
    const refresh = useRefresh();

    return useMutation({
        mutationFn: (fields: string[]) => post<{ changeSet: ChangeSet | null }>('/gamedata/furniture/habbo-values', { fields }),
        onSuccess: refresh,
    });
};

export const useHistory = (page: number) => useQuery({
    queryKey: [ 'gamedata', 'history', page ],
    queryFn: () => api<ChangeSet[]>(`/gamedata/history?page=${page}`),
    placeholderData: keepPreviousData,
});

export const useChanges = (id: number | null) => useQuery({
    queryKey: [ 'gamedata', 'history', 'changes', id ],
    queryFn: () => api<Change[]>(`/gamedata/history/${id}`),
    enabled: id !== null,
});

export const useRollback = () => {
    const refresh = useRefresh();

    return useMutation({
        mutationFn: (id: number) => post<RollbackResult>(`/gamedata/history/${id}/rollback`),
        onSuccess: refresh,
    });
};

export interface TextImportItem {
    key: string;
    action: number;
    /** The hotel's value; null when it has none. */
    current: string | null;
    incoming: string;
}

export interface TextImportPreview {
    version: HabboTextVersion;
    added: number;
    updated: number;
    kept: number;
    unchanged: number;
    items: TextImportItem[];
    truncated: boolean;
}

export interface TextEntry {
    key: string;
    /** As the file writes it: a line break is \n. */
    value: string;
    /** Habbo's as last taken in; null for the hotel's own. */
    habbo: string | null;
}

export interface TextSearchResult {
    items: TextEntry[];
    total: number;
    pageSize: number;
}

export const useTextImportPreview = (enabled: boolean) => useQuery({
    queryKey: [ 'gamedata', 'texts', 'import' ],
    queryFn: () => api<TextImportPreview>('/gamedata/texts/import'),
    enabled,
    ...PREVIEW_FRESHNESS,
});

/** Starts taking a version of Habbo's texts in, in the background. */
export const useTextImport = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (versionId: number) => post<{ job: ImportJob }>(`/gamedata/texts/import/${versionId}`),
        onSuccess: data => queryClient.setQueryData([ 'gamedata-import-job' ], data),
    });
};

export const useTextSearch = (text: string, page: number) => useQuery({
    queryKey: [ 'gamedata', 'texts', 'search', text, page ],
    queryFn: () => api<TextSearchResult>(`/gamedata/texts?${new URLSearchParams({ q: text, page: String(page) })}`),
    placeholderData: keepPreviousData,
});

export const useSaveText = () => {
    const refresh = useRefresh();

    return useMutation({
        mutationFn: (text: { key: string; value: string }) => put<TextEntry>('/gamedata/texts', text),
        onSuccess: refresh,
    });
};

export const useDeleteText = () => {
    const refresh = useRefresh();

    return useMutation({
        mutationFn: (key: string) => api<void>(`/gamedata/texts?${new URLSearchParams({ key })}`, { method: 'DELETE' }),
        onSuccess: refresh,
    });
};

/** One of the client's external variables: its value as JSON (`"text"`, `true`, `120`, `[1, 2]`). */
export interface VariableEntry {
    key: string;
    /** For one that follows a setting, the setting's value now. */
    value: string;
    /** The server setting it follows (`Turbo:Web:HotelName`); null or absent for one with a value of its own. */
    setting?: string | null;
    /** The gamedata file whose address it follows by hash (`furnidata_json`); null or absent for one that doesn't. */
    file?: string | null;
}

export interface VariableSearchResult {
    items: VariableEntry[];
    total: number;
    pageSize: number;
    /** The files a variable may follow the address of. */
    linkableFiles: string[];
    /** False while the gamedata host has no public address: a variable following a file is then written with its own value. */
    writesAddresses: boolean;
}

export interface VariableImportItem {
    key: string;
    /** Add (0) or update (1), as IMPORT_ACTIONS names them. */
    action: number;
    /** The hotel's value as JSON; null for one being added. */
    current: string | null;
    incoming: string;
}

export interface VariableImportPreview {
    added: number;
    updated: number;
    unchanged: number;
    /** Keys left out: the hotel's own gamedata addresses, and keys too long to keep. */
    skipped: string[];
    items: VariableImportItem[];
    truncated: boolean;
    /** The hotel's variables the config lacks, removed when asked, up to the preview's limit; never one that follows a setting or a file, nor the reception's (landing.view.*). */
    removed: string[];
    /** Every variable the import would remove, listed or not. */
    removedCount: number;
}

/** A client config to import, and whether the hotel's variables it lacks are removed. */
export interface VariableImport {
    json: string;
    removeMissing: boolean;
}

export const useVariableSearch = (text: string, page: number) => useQuery({
    queryKey: [ 'gamedata', 'variables', 'search', text, page ],
    queryFn: () => api<VariableSearchResult>(`/gamedata/variables?${new URLSearchParams({ q: text, page: String(page) })}`),
    placeholderData: keepPreviousData,
});

export const useSaveVariable = () => {
    const refresh = useRefresh();

    return useMutation({
        mutationFn: (variable: VariableEntry) => put<VariableEntry>('/gamedata/variables', variable),
        onSuccess: refresh,
    });
};

/**
 * Links a variable to a server setting, or to the address of one of the hotel's gamedata files, so
 * the client gets what it follows; neither unlinks it.
 */
export const useLinkVariable = () => {
    const refresh = useRefresh();

    return useMutation({
        mutationFn: (link: { key: string; setting?: string | null; file?: string | null }) => put<VariableEntry>('/gamedata/variables/link', link),
        onSuccess: refresh,
    });
};

export const useDeleteVariable = () => {
    const refresh = useRefresh();

    return useMutation({
        mutationFn: (key: string) => api<void>(`/gamedata/variables?${new URLSearchParams({ key })}`, { method: 'DELETE' }),
        onSuccess: refresh,
    });
};

/** What importing a client config (a JSON object, as nitro-config.json) would do. */
export const useVariableImportPreview = () => useMutation({
    mutationFn: (config: VariableImport) => post<VariableImportPreview>('/gamedata/variables/import/preview', config),
});

/** Takes a client config's variables in: added and changed, the hotel's others kept or, when asked, removed. */
export const useVariableImport = () => {
    const refresh = useRefresh();

    return useMutation({
        mutationFn: (config: VariableImport) => post<{ changeSet: ChangeSet | null }>('/gamedata/variables/import', config),
        onSuccess: refresh,
    });
};

export interface ProductImportItem {
    code: string;
    action: number;
    fields: FurnitureFieldChange[];
}

export interface ProductImportPreview {
    version: HabboProductVersion;
    added: number;
    updated: number;
    kept: number;
    unchanged: number;
    items: ProductImportItem[];
    truncated: boolean;
}

/** A product: the name and description the client shows for an offer whose name key is its code. */
export interface ProductEntry {
    code: string;
    name: string | null;
    description: string | null;
    /** False for the hotel's own. */
    fromHabbo: boolean;
    habboName: string | null;
    habboDescription: string | null;
}

export interface ProductSearchResult {
    items: ProductEntry[];
    total: number;
    pageSize: number;
}

export const useProductImportPreview = (enabled: boolean) => useQuery({
    queryKey: [ 'gamedata', 'products', 'import' ],
    queryFn: () => api<ProductImportPreview>('/gamedata/products/import'),
    enabled,
    ...PREVIEW_FRESHNESS,
});

/** Starts taking a version of Habbo's product data in, in the background. */
export const useProductImport = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (versionId: number) => post<{ job: ImportJob }>(`/gamedata/products/import/${versionId}`),
        onSuccess: data => queryClient.setQueryData([ 'gamedata-import-job' ], data),
    });
};

export const useProductSearch = (text: string, page: number) => useQuery({
    queryKey: [ 'gamedata', 'products', 'search', text, page ],
    queryFn: () => api<ProductSearchResult>(`/gamedata/products?${new URLSearchParams({ q: text, page: String(page) })}`),
    placeholderData: keepPreviousData,
});

/**
 * The products of these codes: what the catalog shows for its offers' name keys. Readable by
 * whoever sees the catalog, as well as the gamedata.
 */
export const useProductLookup = (codes: string[]) => useQuery({
    queryKey: [ 'gamedata', 'products', 'lookup', codes ],
    queryFn: () => api<ProductEntry[]>(`/product-data?${new URLSearchParams({ codes: codes.join(',') })}`),
    enabled: codes.some(code => code.trim().length > 0),
    placeholderData: keepPreviousData,
});

/** Products whose code, name or description holds the words: names to pick an offer's name key from. */
export const useProductSuggestions = (text: string) => useQuery({
    queryKey: [ 'gamedata', 'products', 'suggest', text ],
    queryFn: () => api<ProductEntry[]>(`/product-data?${new URLSearchParams({ q: text })}`),
    enabled: text.trim().length >= 2,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
});

export const useSaveProduct = () => {
    const refresh = useRefresh();

    return useMutation({
        mutationFn: (product: { code: string; name: string | null; description: string | null }) => put<ProductEntry>('/gamedata/products', product),
        onSuccess: refresh,
    });
};

export const useDeleteProduct = () => {
    const refresh = useRefresh();

    return useMutation({
        mutationFn: (code: string) => api<void>(`/gamedata/products?${new URLSearchParams({ code })}`, { method: 'DELETE' }),
        onSuccess: refresh,
    });
};

/** What a figure record is: FigureRecordKind. */
export const FIGURE_KINDS = { color: 0, setType: 1, set: 2 } as const;

export type FigureKind = typeof FIGURE_KINDS[keyof typeof FIGURE_KINDS];

export interface FigureImportItem {
    kind: FigureKind;
    key: string;
    action: number;
    fields: FurnitureFieldChange[];
}

export interface FigureImportPreview {
    version: HabboFigureVersion;
    added: number;
    updated: number;
    kept: number;
    unchanged: number;
    items: FigureImportItem[];
    truncated: boolean;
}

/** A colour, a kind of clothing or a piece of clothing; its fields as JSON, by Habbo's names for them. */
export interface FigureEntry {
    kind: FigureKind;
    key: string;
    /** A piece's kind of clothing, a colour's palette, a kind's own type. */
    group: string;
    data: string;
    /** False for the hotel's own. */
    fromHabbo: boolean;
    habboData: string | null;
}

export interface FigureSearchResult {
    items: FigureEntry[];
    total: number;
    pageSize: number;
}

export const useFigureImportPreview = (enabled: boolean) => useQuery({
    queryKey: [ 'gamedata', 'figures', 'import' ],
    queryFn: () => api<FigureImportPreview>('/gamedata/figures/import'),
    enabled,
    ...PREVIEW_FRESHNESS,
});

/** Starts taking a version of Habbo's figure data in, in the background. */
export const useFigureImport = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (versionId: number) => post<{ job: ImportJob }>(`/gamedata/figures/import/${versionId}`),
        onSuccess: data => queryClient.setQueryData([ 'gamedata-import-job' ], data),
    });
};

/**
 * Records of a kind, under a group, holding the words and every field in `has` - each a field as
 * the record's JSON writes it (`"gender":"M"`), or several split by `|`, any of which will do.
 */
export const useFigureSearch = (kind: FigureKind, group: string, text: string, page: number, has: string[] = []) => useQuery({
    queryKey: [ 'gamedata', 'figures', 'search', kind, group, text, page, has ],
    queryFn: () => {
        const params = new URLSearchParams({ kind: String(kind), group, q: text, page: String(page) });

        for (const field of has)
            params.append('has', field);

        return api<FigureSearchResult>(`/gamedata/figures?${params}`);
    },
    placeholderData: keepPreviousData,
});

/** A kind of clothing, and how many pieces it has. */
export interface FigureKindEntry {
    entry: FigureEntry;
    pieces: number;
}

/** The kinds of clothing in Habbo's order, and the id a new piece takes. */
export const useFigureKinds = () => useQuery({
    queryKey: [ 'gamedata', 'figures', 'kinds' ],
    queryFn: () => api<{ kinds: FigureKindEntry[]; nextSetId: number }>('/gamedata/figures/kinds'),
});

export const useSaveFigure = () => {
    const refresh = useRefresh();

    return useMutation({
        mutationFn: (record: { kind: FigureKind; data: string }) => put<FigureEntry>('/gamedata/figures', record),
        onSuccess: refresh,
    });
};

export const useDeleteFigure = () => {
    const refresh = useRefresh();

    return useMutation({
        mutationFn: (record: { kind: FigureKind; key: string }) => api<void>(`/gamedata/figures?${new URLSearchParams({ kind: String(record.kind), key: record.key })}`, { method: 'DELETE' }),
        onSuccess: refresh,
    });
};

/** The pieces of clothing for sale a player owns. */
export const useOwnedClothing = (playerId: number | null) => useQuery({
    queryKey: [ 'gamedata', 'figures', 'owned', playerId ],
    queryFn: () => api<{ setIds: number[] }>(`/gamedata/figures/owned/${playerId}`),
    enabled: playerId !== null && playerId > 0,
});

export const useGrantClothing = () => {
    const refresh = useRefresh();

    return useMutation({
        mutationFn: ({ playerId, setIds, revoke }: { playerId: number; setIds: number[]; revoke: boolean }) =>
            post<{ changed: number }>(`/gamedata/figures/owned/${playerId}${revoke ? '/revoke' : ''}`, { setIds }),
        onSuccess: refresh,
    });
};

/** A palette: its colours by order, and the kinds of clothing coloured from it. */
export interface FigurePalette {
    id: number;
    usedBy: string[];
    colors: FigureEntry[];
}

export const usePalettes = () => useQuery({
    queryKey: [ 'gamedata', 'figures', 'palettes' ],
    queryFn: () => api<FigurePalette[]>('/gamedata/figures/palettes'),
});

/** Records of one kind set and removed together, as one change set in the history. */
export const useSaveFigureBatch = () => {
    const refresh = useRefresh();

    return useMutation({
        mutationFn: (batch: { kind: FigureKind; save: string[]; delete: string[]; summary: string }) => put<{ changed: number }>('/gamedata/figures/batch', batch),
        onSuccess: refresh,
    });
};

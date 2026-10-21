import { keepPreviousData, type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useSession } from '#/auth/session';

import { api, API_URL, ApiError, MESSAGES, post, put, remove } from './client';

/**
 * The asset bundles the client draws furniture, effects and pets from: kept on this server, taken
 * from Habbo by a sync, checked against the hotel, and published to where the client loads them
 * (`docs/asset-bundles.md`).
 */
/**
 * What an asset file is, which is also the folder it is kept and published in, as Nitro Studio lays
 * out a hotel's assets: the `.nitro` bundles, then the furniture's icons, the badges, the catalog's
 * pictures and the trax samples.
 */
export type BundleKind = 'furniture' | 'figure' | 'effect' | 'pet' | 'template' | 'room' | 'furni-icon' | 'catalog-icon' | 'badge' | 'catalog-image' | 'sound';

export type BundleStatus = 'all' | 'ok' | 'failed' | 'unused';

export type TargetProtocol = 'folder' | 'ftp' | 'ftps' | 'sftp';

export const BUNDLE_KINDS: { value: BundleKind; label: string; one: string }[] = [
    { value: 'furniture', label: 'Furniture', one: 'furniture' },
    { value: 'figure', label: 'Clothing', one: 'clothing' },
    { value: 'effect', label: 'Effects', one: 'effect' },
    { value: 'pet', label: 'Pets', one: 'pet' },
    { value: 'template', label: 'Templates', one: 'template' },
    { value: 'room', label: 'Room', one: 'room library' },
    { value: 'furni-icon', label: 'Furniture icons', one: 'furniture icon' },
    { value: 'catalog-icon', label: 'Catalog icons', one: 'catalog icon' },
    { value: 'badge', label: 'Badges', one: 'badge' },
    { value: 'catalog-image', label: 'Catalog pictures', one: 'catalog picture' },
    { value: 'sound', label: 'Trax samples', one: 'trax sample' },
];

export const PROTOCOLS: { value: TargetProtocol; label: string }[] = [
    { value: 'folder', label: 'Folder' },
    { value: 'ftp', label: 'FTP' },
    { value: 'ftps', label: 'FTPS' },
    { value: 'sftp', label: 'SFTP' },
];

/** The port a protocol uses when the target's is 0. */
export const DEFAULT_PORTS: Record<TargetProtocol, number> = { folder: 0, ftp: 21, ftps: 21, sftp: 22 };

/** A sync or a publish: one runs at a time, and the last one is kept until the next. */
export interface AssetJob {
    id: string;
    kind: 'sync' | 'publish' | 'client-build';
    title: string;
    status: 'running' | 'done' | 'failed' | 'canceled';
    phase: string;
    total: number;
    done: number;
    failed: number;
    log: string[];
    error: string | null;
    /** What it came to, in a line, once done: "312 converted, 4 failed". */
    result: string | null;
    playerId: number | null;
    startedAt: string;
    finishedAt: string | null;
}

export interface AssetKindSummary {
    kind: BundleKind;
    bundles: number;
    failed: number;
    bytes: number;
    /** When one was last downloaded from Habbo; null when none was. Absent from a server older than the panel. */
    updatedAt?: string | null;
}

export interface AssetsStatus {
    directory: string;
    canManage: boolean;
    kinds: AssetKindSummary[];
    job: AssetJob | null;
    checks: { errors: number; warnings: number };
    /** How many publish targets there are; the list itself is `/assets/targets`. */
    targets: number;
}

export interface AssetBundle {
    kind: BundleKind;
    name: string;
    revision: string | null;
    /** Downloaded from Habbo, uploaded, or built by the server from the hotel's own (the chat styles' template). */
    source: 'habbo' | 'upload' | 'built';
    hash: string | null;
    size: number;
    /** The ids that load it: the effects sharing an effect's library, a pet's type. */
    ids: number[];
    /** Why it has no file, when it has none. */
    error: string | null;
    updatedAt: string;
    /** Whether the hotel names it; an effect always is. */
    used: boolean;
}

export interface AssetBundleDetail extends AssetBundle {
    path: string;
    files: { name: string; size: number }[];
}

export interface AssetCheck {
    id: string;
    severity: 'error' | 'warning';
    title: string;
    detail: string;
    count: number;
    samples: string[];
    /** With `status`, the bundle list the check is about. */
    kind: BundleKind | null;
    status: BundleStatus | null;
}

export interface AssetPublishEntry {
    id: number;
    startedAt: string;
    finishedAt: string | null;
    playerId: number | null;
    playerName: string | null;
    dryRun: boolean;
    uploaded: number;
    skipped: number;
    deleted: number;
    bytes: number;
    error: string | null;
}

export interface AssetTarget {
    id: number;
    name: string;
    protocol: TargetProtocol;
    host: string;
    port: number;
    user: string;
    hasPassword: boolean;
    remotePath: string;
    publicUrl: string;
    allowSelfSigned: boolean;
    /** The SFTP host key trusted on first connection, once there has been one. */
    hostKey: string | null;
    /** How many bundles it lacks or holds an older copy of. */
    pending: number;
    lastPublish: AssetPublishEntry | null;
}

export interface AssetTargetInput {
    name: string;
    protocol: TargetProtocol;
    host: string;
    port: number;
    user: string;
    /** Null keeps the saved one; empty clears it. */
    password: string | null;
    remotePath: string;
    publicUrl: string;
    allowSelfSigned: boolean;
}

const JOB_KEY = [ 'asset-job' ];

const refresh = (queryClient: QueryClient) => void queryClient.invalidateQueries({ queryKey: [ 'assets' ] });

/** A job that has just started: polled from now on. */
const started = (queryClient: QueryClient, job: AssetJob) => {
    queryClient.setQueryData(JOB_KEY, job);
    refresh(queryClient);
};

export const useAssetsStatus = () => {
    const queryClient = useQueryClient();

    return useQuery({
        queryKey: [ 'assets', 'status' ],
        queryFn: async () => {
            const status = await api<AssetsStatus>('/assets');
            const known = queryClient.getQueryData<AssetJob | null>(JOB_KEY);

            // A job started elsewhere (another staff member, the Habbo check's timer): polled from now on.
            if (status.job?.status === 'running' && known?.status !== 'running')
                queryClient.setQueryData(JOB_KEY, status.job);

            return status;
        },
        // Not asked again on every page or window focus; a sync, an upload or a job's end asks for it at once.
        staleTime: 30_000,
    });
};

/**
 * The job running or last run, asked for every second while one runs and not otherwise. When it
 * ends, everything the page shows is asked for again.
 */
export const useAssetJob = () => {
    const queryClient = useQueryClient();

    return useQuery({
        queryKey: JOB_KEY,
        queryFn: async () => {
            const before = queryClient.getQueryData<AssetJob | null>(JOB_KEY);
            const job = (await api<AssetJob | undefined>('/assets/job')) ?? null;

            if (before?.status === 'running' && job?.status !== 'running')
                refresh(queryClient);

            return job;
        },
        refetchInterval: query => (query.state.data?.status === 'running' ? 1000 : false),
    });
};

export const useStartSync = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: () => post<AssetJob>('/assets/sync'),
        onSuccess: job => started(queryClient, job),
    });
};

/** One bundle built from Habbo's HTML client. */
export interface HabboClientBuiltLibrary {
    library: string;
    kind: 'avatar' | 'variable-fx' | 'texts' | 'chat' | 'template' | 'window-manager';
    /** The hotel's own upload stands in its place: a build leaves it alone. */
    uploaded: boolean;
    size: number;
    updatedAt: string | null;
}

/** What the hotel builds from Habbo's HTML client, and what the last build said. */
export interface HabboClientBuild {
    libraries: HabboClientBuiltLibrary[];
    version: string | null;
    builtAt: string | null;
    /** The window templates' problems: a bitmap no library has, a layout the client would refuse. */
    problems: string[];
    /** What the last build left unbuilt, and why. */
    notes: string[];
    /** The AIR client the templates took from, and how many images and layouts; absent from a server older than the panel. */
    airVersion?: string | null;
    airImages?: number;
    airLayouts?: number;
}

/** Read again whenever an asset job ends, as every asset query is. */
export const useHabboClientBuild = () => useQuery({
    queryKey: [ 'assets', 'client-build' ],
    queryFn: () => api<HabboClientBuild>('/gamedata/habbo/client/build'),
});

/** Builds every library from the client again, as an asset job. */
export const useStartClientBuild = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: () => post<AssetJob>('/gamedata/habbo/client/build'),
        onSuccess: job => started(queryClient, job),
    });
};

export const useCancelJob = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: () => post<void>('/assets/job/cancel'),
        onSuccess: () => void queryClient.invalidateQueries({ queryKey: JOB_KEY }),
    });
};

export const useAssetChecks = () => useQuery({
    queryKey: [ 'assets', 'checks' ],
    queryFn: () => api<{ items: AssetCheck[] }>('/assets/checks'),
});

export const useBundles = (kind: BundleKind, q: string, status: BundleStatus, page: number) => useQuery({
    queryKey: [ 'assets', 'bundles', kind, q, status, page ],
    queryFn: () => {
        const params = new URLSearchParams({ kind, q, status, page: String(page) });

        return api<{ items: AssetBundle[]; total: number; pageSize: number }>(`/assets/bundles?${params}`);
    },
    placeholderData: keepPreviousData,
});

/**
 * Each effect's icon by its id, as a PNG data url: the `fx_icon_<id>` bitmaps of the hotel's
 * `habbo-inventory-com` template, as the client's effects view draws them.
 */
export const useEffectIcons = (enabled = true) => useQuery({
    queryKey: [ 'assets', 'effect-icons' ],
    queryFn: async () => {
        const { icons } = await api<{ icons: Record<string, string> }>('/assets/effect-icons');

        return new Map(Object.entries(icons).map(([ id, png ]) => [ Number(id), `data:image/png;base64,${png}` ]));
    },
    enabled,
    staleTime: Infinity,
});

const bundlePath = (kind: BundleKind, name: string) => `/assets/bundles/${kind}/${encodeURIComponent(name)}`;

export const useBundle = (bundle: { kind: BundleKind; name: string } | null) => useQuery({
    queryKey: [ 'assets', 'bundle', bundle?.kind, bundle?.name ],
    queryFn: () => api<AssetBundleDetail>(bundlePath(bundle!.kind, bundle!.name)),
    enabled: !!bundle,
});

export const useDeleteBundle = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ kind, name }: { kind: BundleKind; name: string }) => remove<void>(bundlePath(kind, name)),
        onSuccess: () => refresh(queryClient),
    });
};

/** The auth header every call carries, for the calls `client.ts` can't make (files both ways). */
const authHeaders = () => {
    const token = useSession.getState().session?.token;
    const headers = new Headers();

    if (token)
        headers.set('Authorization', `Bearer ${token}`);

    return { token, headers };
};

/** A call the server refused, with its own words when it gave them, as `client.ts` reads them. */
const refusal = async (response: Response, token: string | undefined) => {
    if (response.status === 401 && token)
        useSession.getState().signOut();

    let message: string | null = null;

    try {
        const body = (await response.json()) as { message?: unknown; error?: unknown };

        message = typeof body.message === 'string' ? body.message : typeof body.error === 'string' ? body.error : null;
    } catch {
        // No body, or not JSON: the status speaks for it.
    }

    return new ApiError(response.status, message ?? MESSAGES[response.status] ?? `The server answered ${response.status}.`);
};

const send = async (path: string, init: RequestInit) => {
    const { token, headers } = authHeaders();

    let response: Response;

    try {
        response = await fetch(`${API_URL}/api${path}`, { ...init, headers });
    } catch {
        throw new ApiError(0, 'Cannot reach the admin API. Is the server running with Turbo:Admin:Enabled?');
    }

    if (!response.ok)
        throw await refusal(response, token);

    return response;
};

/** Sends a form with files as the signed-in player; the browser sets its boundary. */
export const postForm = async <T>(path: string, form: FormData) => (await (await send(path, { method: 'POST', body: form })).json()) as T;

/** A gamedata file an upload was found to be, by what it holds. */
export type GamedataFileKind = 'furnidata' | 'productdata' | 'figuredata' | 'figuremap' | 'effectmap' | 'texts' | 'variables';

export const GAMEDATA_FILE_NAMES: Record<GamedataFileKind, string> = {
    furnidata: 'furniture data',
    productdata: 'product data',
    figuredata: 'figure data',
    figuremap: 'figure map',
    effectmap: 'effect map',
    texts: 'external texts',
    variables: 'client config',
};

/**
 * What an upload was found to be: a library kept as the bundle its content says it is, a gamedata
 * file recognised (not taken), or neither - `unknown`, with why, which is a warning and not a
 * failure.
 */
export type AssetUpload
    = | { type: 'bundle'; bundle: AssetBundle }
        | { type: 'gamedata'; gamedata: GamedataFileKind }
        | { type: 'unknown'; message: string };

/**
 * Uploads any file and has the server say what it is. The server answers 422 for a file whose
 * content says nothing of what it is; that comes back as `unknown` rather than an error.
 */
export const useUploadFile = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ file, name }: { file: File; name?: string }): Promise<AssetUpload> => {
            const form = new FormData();

            form.append('file', file);

            if (name?.trim())
                form.append('name', name.trim());

            try {
                const result = await postForm<{ type: 'bundle' | 'gamedata'; bundle: AssetBundle | null; gamedata: GamedataFileKind | null }>('/assets/upload', form);

                return result.type === 'bundle' ? { type: 'bundle', bundle: result.bundle! } : { type: 'gamedata', gamedata: result.gamedata! };
            } catch (error) {
                if (error instanceof ApiError && error.status === 422)
                    return { type: 'unknown', message: error.message };

                throw error;
            }
        },
        onSuccess: (result) => {
            if (result.type === 'bundle') {
                refresh(queryClient);
                void queryClient.invalidateQueries({ queryKey: [ 'gamedata' ] });
            }
        },
    });
};

/** One of Habbo's libraries a sync would download, and why. */
export interface AssetSyncPending {
    name: string;
    reason: 'new' | 'updated';
    habboRevision: string;
    /** The revision the hotel has; null when it has no row of it. */
    hotelRevision: string | null;
    /** Why the hotel's last try failed, when it did. */
    error: string | null;
}

export interface AssetSyncKind {
    kind: BundleKind;
    /** False when Habbo's list of this kind (the figure map, the effect map) could not be read. */
    listed: boolean;
    habboLibraries: number;
    upToDate: number;
    uploads: number;
    new: number;
    updated: number;
    items: AssetSyncPending[];
    truncated: boolean;
}

/** What a sync from Habbo would download now, kind by kind, without downloading it. */
export interface AssetSyncPreview {
    domain: string;
    revision: string;
    listedAt: string;
    kinds: AssetSyncKind[];
}

const PENDING_KEY = [ 'assets', 'pending' ];

/**
 * What a sync would take: Habbo's lists as the server last read them (it reads them again once
 * they are a while old) against the hotel's bundles as they are now.
 */
export const useSyncPreview = (enabled = true) => useQuery({
    queryKey: PENDING_KEY,
    queryFn: () => api<AssetSyncPreview>('/assets/pending'),
    enabled,
    staleTime: 60_000,
    retry: false,
});

/** Reads Habbo's lists of libraries again, now. */
export const useRelist = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: () => api<AssetSyncPreview>('/assets/pending?relist=true'),
        onSuccess: preview => queryClient.setQueryData(PENDING_KEY, preview),
    });
};

/**
 * Saves a bundle's `.nitro` file. The file needs the session's header, which a plain link can't
 * carry, so it is fetched and handed to the browser as a download.
 */
export const downloadBundle = async (kind: BundleKind, name: string) => {
    const response = await send(`${bundlePath(kind, name)}/file`, {});
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement('a');

    link.href = url;
    link.download = `${name}.nitro`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const useTargets = () => useQuery({
    queryKey: [ 'assets', 'targets' ],
    queryFn: () => api<{ items: AssetTarget[] }>('/assets/targets'),
});

export const useSaveTarget = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, input }: { id: number | null; input: AssetTargetInput }) =>
            id === null ? post<AssetTarget>('/assets/targets', input) : put<AssetTarget>(`/assets/targets/${id}`, input),
        onSuccess: () => refresh(queryClient),
    });
};

export const useDeleteTarget = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: number) => remove<void>(`/assets/targets/${id}`),
        onSuccess: () => refresh(queryClient),
    });
};

export const useTestTarget = () => useMutation({
    mutationFn: (id: number) => post<{ ok: boolean; message: string }>(`/assets/targets/${id}/test`),
});

export const usePublish = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, dryRun, deleteRemoved }: { id: number; dryRun: boolean; deleteRemoved: boolean }) =>
            post<AssetJob>(`/assets/targets/${id}/publish`, { dryRun, deleteRemoved }),
        onSuccess: job => started(queryClient, job),
    });
};

export const useForgetHostKey = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: number) => post<void>(`/assets/targets/${id}/forget-host-key`),
        onSuccess: () => refresh(queryClient),
    });
};

export const useTargetHistory = (id: number | null) => useQuery({
    queryKey: [ 'assets', 'targets', id, 'history' ],
    queryFn: () => api<{ items: AssetPublishEntry[] }>(`/assets/targets/${id}/history`),
    enabled: id !== null,
});

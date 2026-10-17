import { type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { type AssetJob, postForm } from './bundles';
import { api, post, put, remove } from './client';

/** How a plugin stands: running, its last load failed, turned off, or found and not loaded yet. */
export type PluginState = 'loaded' | 'failed' | 'disabled' | 'not_loaded';

/** One plugin the server found. `name` is null for a folder whose manifest could not be read. */
export interface Plugin {
    key: string;
    name: string | null;
    version: string | null;
    author: string | null;
    /** The folder's name in the plugin folder; a development plugin's full path. */
    folder: string;
    /** Loaded from `Turbo:Plugin:DevPluginPaths`, not the plugin folder. */
    dev: boolean;
    state: PluginState;
    /** Why the manifest could not be read, or why its last load failed. */
    error: string | null;
    dependencies: string[];
    /** The client capabilities it registered. */
    capabilities: string[];
    incomingHeaders: number[];
    outgoingHeaders: number[];
    /** The migrations applied for its tables, oldest first. */
    migrations: string[];
    loadedAtUtc: string | null;
    /** Earlier versions kept to roll back to, newest first. */
    versions: string[];
}

/** What a link follows: the repository's newest release, or one tag. */
export type PluginSourceFollow = 'latest' | 'tag';

/** A GitHub repository a plugin is installed from. Never its token: only whether it has one. */
export interface PluginSource {
    id: string;
    /** `owner/repo`. */
    repository: string;
    follow: PluginSourceFollow;
    tag: string | null;
    /** The release asset installed; null takes the release's only zip. */
    asset: string | null;
    hasToken: boolean;
    autoUpdate: boolean;
    /** The plugin's key, once a release has been installed. */
    key: string | null;
    installedTag: string | null;
    installedVersion: string | null;
    latestTag: string | null;
    latestUrl: string | null;
    latestPublishedAtUtc: string | null;
    checkedAtUtc: string | null;
    /** Why the last check or update failed. */
    error: string | null;
    updateAvailable: boolean;
}

/** A link as staff enter it: `token` undefined keeps the saved one, empty removes it. */
export interface PluginSourceInput {
    repository: string;
    follow: PluginSourceFollow;
    tag: string | null;
    asset: string | null;
    token?: string;
    autoUpdate: boolean;
}

/** A check of the links or an update from one, in the asset jobs' shape. */
export type PluginJob = Omit<AssetJob, 'kind'> & { kind: 'plugin-check' | 'plugin-update' };

export interface PluginSourceActionResponse {
    ok: boolean;
    message: string;
    source: PluginSource | null;
    job: PluginJob | null;
}

export interface PluginsResponse {
    plugins: Plugin[];
    /** Holds `admin.plugins.manage`: may reload, rescan and turn plugins off or on. */
    canManage: boolean;
    /** Holds `admin.plugins.install` as well. */
    canInstall: boolean;
    /** The server allows installing from the panel (`Turbo:Plugin:UploadEnabled`). */
    uploadEnabled: boolean;
    maxUploadBytes: number;
    sources: PluginSource[];
    /** The check or update running, or the last one. */
    job: PluginJob | null;
    /** The GitHub owners plugins may be linked from; empty allows any. */
    allowedSources: string[];
    /** Minutes between scheduled checks; 0 checks only on request. */
    checkMinutes: number;
}

/** What an action did: a refusal or a failed load is `ok: false`, with why. */
export interface PluginActionResponse {
    ok: boolean;
    message: string;
    plugin: Plugin | null;
}

const PLUGINS_KEY = [ 'plugins' ];

/** The plugins, read again every second while a check or update runs. */
export const usePlugins = () => useQuery({
    queryKey: PLUGINS_KEY,
    queryFn: () => api<PluginsResponse>('/plugins'),
    refetchInterval: query => (query.state.data?.job?.status === 'running' ? 1000 : false),
});

const refresh = (queryClient: QueryClient) => void queryClient.invalidateQueries({ queryKey: PLUGINS_KEY });

/** An action on the plugins; the list is read again whatever came of it. */
const usePluginAction = <T>(run: (input: T) => Promise<PluginActionResponse>) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: run,
        onSettled: () => void queryClient.invalidateQueries({ queryKey: [ 'plugins' ] }),
    });
};

export const useReloadPlugin = () => usePluginAction((key: string) => post<PluginActionResponse>(`/plugins/${encodeURIComponent(key)}/reload`));

export const useSetPluginEnabled = () => usePluginAction(({ key, enabled }: { key: string; enabled: boolean }) =>
    post<PluginActionResponse>(`/plugins/${encodeURIComponent(key)}/${enabled ? 'enable' : 'disable'}`));

export const useRescanPlugins = () => usePluginAction<void>(() => post<PluginActionResponse>('/plugins/rescan'));

/** Installs a plugin package: a zip with `manifest.json` and the plugin's assembly. */
export const useInstallPlugin = () => usePluginAction((file: File) => {
    const form = new FormData();

    form.append('file', file);

    return postForm<PluginActionResponse>('/plugins/install', form);
});

export const useRollbackPlugin = () => usePluginAction(({ key, version }: { key: string; version: string }) =>
    post<PluginActionResponse>(`/plugins/${encodeURIComponent(key)}/rollback`, { version }));

/** A link action; the list (and the job it started) is read again whatever came of it. */
const useSourceAction = <T>(run: (input: T) => Promise<PluginSourceActionResponse>) => {
    const queryClient = useQueryClient();

    return useMutation({ mutationFn: run, onSettled: () => refresh(queryClient) });
};

/** Links a repository and starts installing its release. */
export const useAddPluginSource = () => useSourceAction((input: PluginSourceInput) => post<PluginSourceActionResponse>('/plugins/sources', input));

export const useEditPluginSource = () => useSourceAction(({ id, input }: { id: string; input: PluginSourceInput }) =>
    put<PluginSourceActionResponse>(`/plugins/sources/${encodeURIComponent(id)}`, input));

/** Unlinks a repository; its plugin stays installed. */
export const useRemovePluginSource = () => useSourceAction((id: string) => remove<PluginSourceActionResponse>(`/plugins/sources/${encodeURIComponent(id)}`));

/** Checks one link for a new release, or all (`null`). */
export const useCheckPluginSource = () => useSourceAction((id: string | null) =>
    post<PluginSourceActionResponse>(id === null ? '/plugins/sources/check' : `/plugins/sources/${encodeURIComponent(id)}/check`));

export const useUpdatePluginSource = () => useSourceAction((id: string) => post<PluginSourceActionResponse>(`/plugins/sources/${encodeURIComponent(id)}/update`));

export const useCancelPluginJob = () => {
    const queryClient = useQueryClient();

    return useMutation({ mutationFn: () => post<void>('/plugins/job/cancel'), onSettled: () => refresh(queryClient) });
};

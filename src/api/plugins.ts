import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { postForm } from './bundles';
import { api, post } from './client';

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
}

/** What an action did: a refusal or a failed load is `ok: false`, with why. */
export interface PluginActionResponse {
    ok: boolean;
    message: string;
    plugin: Plugin | null;
}

export const usePlugins = () => useQuery({
    queryKey: [ 'plugins' ],
    queryFn: () => api<PluginsResponse>('/plugins'),
});

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

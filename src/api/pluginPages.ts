import { useQuery, useQueryClient } from '@tanstack/react-query';

import { api, apiBlob, ApiError } from './client';

/** A column of a table, or a field of a detail: PluginAdminColumn. */
export interface PluginColumn {
    key: string;
    label: string;
    /** `link`: a value starting with `/` opens that panel page, `http(s)://` a new tab. */
    type: 'text' | 'number' | 'time' | 'bool' | 'badge' | 'link' | string;
}

/** A form field or a table filter: PluginAdminField. */
export interface PluginField {
    key: string;
    label: string;
    /** `file`: the chosen file's text is the value (`options` are the accepted extensions, e.g. `.json`). */
    type: 'text' | 'textarea' | 'number' | 'bool' | 'select' | 'file' | string;
    required: boolean;
    min: number | null;
    max: number | null;
    pattern: string | null;
    options: string[] | null;
    hint: string | null;
}

/** A button: PluginAdminAction. */
export interface PluginAction {
    label: string;
    method: string;
    endpoint: string;
    confirm: string | null;
    danger: boolean;
    node: string | null;
    /** `open:<page>`: the plugin's page `<page>` for the `id` the call answered with. */
    then: 'refresh' | 'back' | `open:${string}` | string;
    /** `key=value`: shown only for an item whose field has that value. */
    when: string | null;
}

/** One block of a page: PluginAdminBlock. The panel draws the types it knows. */
export interface PluginBlock {
    type: string;
    title: string | null;
    text: string | null;
    endpoint: string | null;
    columns: PluginColumn[] | null;
    filters: PluginField[] | null;
    fields: PluginField[] | null;
    actions: PluginAction[] | null;
    itemPage: string | null;
    image: string | null;
    downloads: PluginAction[] | null;
    submit: PluginAction | null;
}

export interface PluginPage {
    id: string;
    title: string;
    node: string;
    blocks: PluginBlock[];
    description: string | null;
    nav: boolean;
    icon: string | null;
}

/** A live plugin's pages the viewer may see, and its nodes they hold. */
export interface PluginPages {
    key: string;
    name: string;
    version: string;
    /** Changes with every load of the plugin. */
    revision: string;
    pages: PluginPage[];
    nodes: string[];
}

/** A page of a list endpoint: what a table block reads. */
export interface PluginList {
    items: Record<string, unknown>[];
    total: number;
    pageSize: number;
}

export const usePluginPages = () => useQuery({
    queryKey: [ 'plugin-pages' ],
    queryFn: () => api<PluginPages[]>('/plugins/pages'),
    staleTime: 30_000,
});

/** An endpoint of a block, its `{id}` filled in. */
export const endpointOf = (endpoint: string, id: string | undefined) => endpoint.replace('{id}', encodeURIComponent(id ?? ''));

const path = (key: string, endpoint: string) => `/plugins/${encodeURIComponent(key)}/api/${endpoint}`;

/** Answers that mean the page was drawn from a plugin that has changed since: reloaded, off or gone. */
export const isStale = (error: unknown) => error instanceof ApiError && [ 404, 410, 503 ].includes(error.status);

/**
 * Calls a plugin's endpoint. When the plugin answers that it changed under the page (reloaded,
 * turned off, taken away), the pages and the navigation are read again too.
 */
export const usePluginCall = () => {
    const queryClient = useQueryClient();

    return async <T>(key: string, endpoint: string, init: RequestInit = {}): Promise<T> => {
        try {
            return await api<T>(path(key, endpoint), init);
        } catch (error) {
            if (isStale(error))
                void queryClient.invalidateQueries({ queryKey: [ 'plugin-pages' ] });

            throw error;
        }
    };
};

export const usePluginData = <T>(key: string, endpoint: string | null) => {
    const call = usePluginCall();

    return useQuery({
        queryKey: [ 'plugin', key, endpoint ],
        queryFn: () => call<T>(key, endpoint!),
        enabled: !!endpoint,
        retry: false,
    });
};

export const pluginBlob = (key: string, endpoint: string) => apiBlob(path(key, endpoint));

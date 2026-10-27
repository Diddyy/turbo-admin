import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, put, remove } from './client';

/** What a named element of a window does when clicked (turbo-cloud `docs/plugin-data.md`, "Windows of its own"): `show` shows that page and hides the other buttons' pages (tabs). */
export type DataWindowButton = { close: true } | { link: string } | { show: string };

/** Where players open a window from: a me menu entry, or a toolbar icon. */
export type DataWindowEntry = { where: 'memenu'; caption: string } | { where: 'toolbar'; icon: string; tooltip?: string };

/** One element of a window's template, in the shape the client's template bundles carry (nitro-theme `TemplateElement`). */
export interface DataWindowElement {
    tag: string;
    name?: string;
    x: number;
    y: number;
    width: number;
    height: number;
    style?: string;
    caption?: string;
    color?: number;
    vars: Record<string, unknown>;
    params?: Record<string, unknown>;
    margins?: [ number, number, number, number ];
    children: DataWindowElement[];
    [key: string]: unknown;
}

export interface DataWindowTemplate {
    name: string;
    width: number;
    height: number;
    elements: DataWindowElement[];
}

/** A plugin's `wwwroot/windows/<name>.json`: a window defined as data, no code. */
export interface DataWindowFile {
    title: string;
    template: DataWindowTemplate;
    buttons?: Record<string, DataWindowButton>;
    entries?: DataWindowEntry[];
}

export interface PluginWindow {
    name: string;
    title: string | null;
    url: string | null;
    file: DataWindowFile | null;
}

export interface PluginWindowsResponse {
    key: string;
    windows: PluginWindow[];
    canManage: boolean;
}

const windowsKey = (key: string) => [ 'plugins', key, 'windows' ];

export const usePluginWindows = (key: string) => useQuery({
    queryKey: windowsKey(key),
    queryFn: () => api<PluginWindowsResponse>(`/plugins/${encodeURIComponent(key)}/windows`),
});

export const useSaveWindow = (key: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ name, file }: { name: string; file: DataWindowFile }) => put<PluginWindow>(`/plugins/${encodeURIComponent(key)}/windows/${encodeURIComponent(name)}`, file),
        onSettled: () => void queryClient.invalidateQueries({ queryKey: windowsKey(key) }),
    });
};

export const useRemoveWindow = (key: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (name: string) => remove<void>(`/plugins/${encodeURIComponent(key)}/windows/${encodeURIComponent(name)}`),
        onSettled: () => void queryClient.invalidateQueries({ queryKey: windowsKey(key) }),
    });
};

/** The id the client reads a plugin's window under, as a template: `<plugin key>/windows/<name>`. */
export const dataWindowTemplateId = (plugin: string, name: string) => `${plugin}/windows/${name}`;

/** The window name a template id names, when it is one of `plugin`'s windows defined as data. */
export const dataWindowNameOf = (plugin: string, template: string | null | undefined) => (template?.startsWith(`${plugin}/windows/`) ? template.slice(plugin.length + 9) : null);

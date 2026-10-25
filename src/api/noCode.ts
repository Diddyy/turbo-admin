import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { postForm } from './bundles';
import { api, apiBlob, post, put, remove } from './client';

/** What a theme style holds; staff type each as `theme.json` says (turbo-cloud `docs/plugin-data.md`). */
export type PluginStyleType = 'color' | 'number' | 'image' | 'font' | 'text';

/** One style property of a theme and the hotel's value of it: `value` is `default` while `changed` is false. */
export interface PluginStyle {
    name: string;
    type: PluginStyleType;
    group: string | null;
    label: string | null;
    hint: string | null;
    /** The library bitmap an image stands in for (`asset.overlays`). */
    overlay: string | null;
    min: number | null;
    max: number | null;
    default: string;
    value: string;
    changed: boolean;
}

export interface PluginStylesResponse {
    key: string;
    styles: PluginStyle[];
    canManage: boolean;
}

/** A window patch staff made: its ops are nitro-next's `TemplatePatchOp`s, as JSON. */
export interface HotelPatch {
    id: string;
    name: string;
    template: string;
    order: number | null;
    ops: unknown;
    disabled: boolean;
}

export interface HotelPatchesResponse {
    /** The key of the hotel's own data plugin, which holds them. */
    key: string;
    patches: HotelPatch[];
    canManage: boolean;
}

const stylesKey = (key: string) => [ 'plugins', key, 'styles' ];

const PATCHES_KEY = [ 'plugins', 'hotel-patches' ];

export const usePluginStyles = (key: string) => useQuery({
    queryKey: stylesKey(key),
    queryFn: () => api<PluginStylesResponse>(`/plugins/${encodeURIComponent(key)}/styles`),
});

/** A style's change, its reset or an image upload; the theme's styles are read again after. */
export const useStyleChange = (key: string) => {
    const queryClient = useQueryClient();
    const base = `/plugins/${encodeURIComponent(key)}/styles`;

    return useMutation({
        mutationFn: ({ name, value, file }: { name: string; value?: string | null; file?: File }) => {
            const path = `${base}/${encodeURIComponent(name)}`;

            if (file) {
                const form = new FormData();

                form.append('file', file);

                return postForm<PluginStyle>(`${path}/image`, form);
            }

            return value === null || value === undefined ? remove<PluginStyle>(path) : put<PluginStyle>(path, { value });
        },
        onSettled: () => void queryClient.invalidateQueries({ queryKey: stylesKey(key) }),
    });
};

export const useHotelPatches = () => useQuery({
    queryKey: PATCHES_KEY,
    queryFn: () => api<HotelPatchesResponse>('/plugins/hotel-patches'),
});

export const useSaveHotelPatch = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (patch: HotelPatch) => post<HotelPatch>('/plugins/hotel-patches', patch),
        onSettled: () => void queryClient.invalidateQueries({ queryKey: [ 'plugins' ] }),
    });
};

export const useRemoveHotelPatch = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => remove<void>(`/plugins/hotel-patches/${encodeURIComponent(id)}`),
        onSettled: () => void queryClient.invalidateQueries({ queryKey: [ 'plugins' ] }),
    });
};

/** What the new plugin is called: another hotel installs the zip as it installs any package. */
export interface PluginPackageRequest {
    key: string;
    name: string;
    version: string;
    author: string | null;
}

/** Makes a data plugin of `key` as this hotel has it, and hands the zip to the browser. */
export const downloadPluginPackage = async (key: string, request: PluginPackageRequest) => {
    const url = URL.createObjectURL(await apiBlob(`/plugins/${encodeURIComponent(key)}/package`, request));
    const link = document.createElement('a');

    link.href = url;
    link.download = `${request.key}-${request.version}.zip`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
};

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { postForm } from './bundles';
import { api, remove } from './client';

/**
 * What a field stores to show an image, by the shape it takes: a path under the client's image
 * library, a catalog picture's name, a catalog icon's number, one of the client's own images, a
 * badge's code, a path in a plugin's `wwwroot/`, or the full address (empty when it has none).
 */
export interface MediaValues {
    relative: string | null;
    catalogPicture: string | null;
    catalogIcon: number | null;
    clientImage: string | null;
    badge: string | null;
    plugin: string | null;
    url: string;
}

/** A value shape a field stores (`?shape=`). */
export type MediaShape = 'relative' | 'catalogpicture' | 'catalogicon' | 'clientimage' | 'badge' | 'plugin' | 'url';

/** Where an image is shown: the area, the thing there, its field and the panel page that edits it. */
export interface MediaUse {
    area: string;
    id: string;
    title: string;
    field: string;
    link: string;
}

/** One image the hotel can show, from any source; `usedOn` only when one image is asked for. */
export interface MediaImage {
    id: string;
    name: string;
    path: string;
    kind: string;
    source: string;
    sourceDetail: string | null;
    url: string;
    thumbUrl: string;
    width: number | null;
    height: number | null;
    bytes: number;
    modifiedUtc: string | null;
    tags: string[];
    usedCount: number;
    values: MediaValues;
    usedOn: MediaUse[] | null;
}

export interface MediaSearchResponse {
    total: number;
    items: MediaImage[];
    facets: { kinds: Record<string, number>; sources: Record<string, number> };
    canManage: boolean;
}

export interface MediaQuery {
    q?: string;
    kind?: string;
    source?: string;
    shape?: string;
    used?: 'all' | 'used' | 'unused';
    minWidth?: number;
    maxWidth?: number;
    minHeight?: number;
    maxHeight?: number;
    sort?: 'name' | 'modified' | 'size' | 'used';
    desc?: boolean;
    page?: number;
    size?: number;
}

export interface MediaUploadResponse {
    items: MediaImage[];
    refused: { file: string; why: string }[];
}

/** The kind an upload names to be a catalog picture rather than an image library picture. */
export const CATALOG_PICTURE = 'catalogue-picture';

const queryString = (query: MediaQuery) => new URLSearchParams(Object.entries(query)
    .filter(([ , value ]) => value !== undefined && value !== '' && value !== null)
    .map(([ key, value ]) => [ key, String(value) ])).toString();

/** The admin API path an image's bytes are drawn from, before any publish. */
export const mediaFilePath = (image: Pick<MediaImage, 'id' | 'modifiedUtc'>) =>
    `/media/file?id=${encodeURIComponent(image.id)}${image.modifiedUtc ? `&v=${encodeURIComponent(image.modifiedUtc)}` : ''}`;

export const useMediaSearch = (query: MediaQuery) => useQuery({
    queryKey: [ 'media', 'search', query ],
    queryFn: () => api<MediaSearchResponse>(`/media?${queryString(query)}`),
    placeholderData: keepPreviousData,
});

export const useMediaImage = (id: string | null) => useQuery({
    queryKey: [ 'media', 'item', id ],
    queryFn: () => api<MediaImage>(`/media/item?id=${encodeURIComponent(id!)}`),
    enabled: !!id,
});

export const useUploadMedia = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ files, folder, kind }: { files: File[]; folder: string; kind: string }) => {
            const form = new FormData();

            for (const file of files) form.append('files', file);
            form.append('folder', folder);
            form.append('kind', kind);

            return postForm<MediaUploadResponse>('/media', form);
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: [ 'media' ] }),
    });
};

export const useEditMedia = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, name, tags }: { id: string; name?: string; tags?: string[] }) =>
            api<MediaImage>(`/media/item?id=${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ name: name ?? null, tags: tags ?? null }) }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: [ 'media' ] }),
    });
};

export const useDeleteMedia = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => remove<void>(`/media/item?id=${encodeURIComponent(id)}`),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: [ 'media' ] }),
    });
};

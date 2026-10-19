import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { postForm } from './bundles';
import { api, remove } from './client';

/**
 * A catalog picture - a page's header or teaser - as a file in the server's `images/catalog`
 * folder: its name as a page gives it, its file (`<name>.gif`), and the pages that show it.
 */
export interface CatalogImage {
    name: string;
    file: string;
    size: number;
    updatedAtUtc: string | null;
    pages: { id: number; title: string }[];
}

export type CatalogImageShow = 'all' | 'unused';

export interface CatalogImageQuery {
    q: string;
    show: CatalogImageShow;
    page: number;
    size: number;
}

/** The file a page's picture is loaded from, as the server finds it: `.gif` after the name unless it names a GIF or PNG. */
const fileOf = (name: string) => (/\.(gif|png)$/i.test(name) ? name : `${name}.gif`);

/** The picture a page's value names, when the server has it. */
export const findImage = (images: CatalogImage[] | undefined, value: string) =>
    value ? images?.find(x => x.name === value || x.file === fileOf(value)) ?? null : null;

/** The most the server lists at once: every picture, for the picker to search. */
const EVERY = 5000;

/**
 * Where a picture's file is drawn from, through the admin API. The version (when it was last
 * written) makes a replaced picture a new address, so the old one isn't shown from the cache.
 */
export const catalogImagePath = (image: Pick<CatalogImage, 'name' | 'updatedAtUtc'>) =>
    `/catalog/images/${encodeURIComponent(image.name)}/file${image.updatedAtUtc ? `?v=${encodeURIComponent(image.updatedAtUtc)}` : ''}`;

export const useCatalogImages = (query: CatalogImageQuery) => useQuery({
    queryKey: [ 'catalog', 'images', query ],
    queryFn: () => api<{ total: number; items: CatalogImage[] }>(`/catalog/images?${new URLSearchParams({ q: query.q, show: query.show, page: String(query.page), size: String(query.size) })}`),
    placeholderData: previous => previous,
});

/** Every picture, for the picker to find among as it is typed into. */
export const useAllCatalogImages = (enabled = true) => useQuery({
    queryKey: [ 'catalog', 'images', 'every' ],
    queryFn: () => api<{ total: number; items: CatalogImage[] }>(`/catalog/images?size=${EVERY}`),
    enabled,
    staleTime: 60_000,
});

const useRefreshImages = () => {
    const queryClient = useQueryClient();

    return () => void queryClient.invalidateQueries({ queryKey: [ 'catalog', 'images' ] });
};

/** Uploads a GIF or PNG as a picture, named as given or else as the file. */
export const useUploadCatalogImage = () => {
    const refresh = useRefreshImages();

    return useMutation({
        mutationFn: ({ file, name }: { file: File; name: string }) => {
            const form = new FormData();

            form.append('file', file);
            form.append('name', name);

            return postForm<CatalogImage>('/catalog/images', form);
        },
        onSuccess: refresh,
    });
};

export const useDeleteCatalogImage = () => {
    const refresh = useRefreshImages();

    return useMutation({
        mutationFn: (name: string) => remove<void>(`/catalog/images/${encodeURIComponent(name)}`),
        onSuccess: refresh,
    });
};

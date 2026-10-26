import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { postForm } from './bundles';
import { api, ApiError, remove } from './client';
import { type PluginImage, uploadPluginImage } from './noCode';

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

const search = (query: MediaQuery) => api<MediaSearchResponse>(`/media?${queryString(query)}`);

export const useMediaSearch = (query: MediaQuery, enabled = true) => useQuery({
    queryKey: [ 'media', 'search', query ],
    queryFn: () => search(query),
    placeholderData: keepPreviousData,
    enabled,
});

export const useMediaImage = (id: string | null) => useQuery({
    queryKey: [ 'media', 'item', id ],
    queryFn: () => api<MediaImage>(`/media/item?id=${encodeURIComponent(id!)}`),
    enabled: !!id,
});

const uploadMedia = ({ files, folder, kind }: { files: File[]; folder: string; kind: string }) => {
    const form = new FormData();

    for (const file of files) form.append('files', file);
    form.append('folder', folder);
    form.append('kind', kind);

    return postForm<MediaUploadResponse>('/media', form);
};

export const useUploadMedia = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: uploadMedia,
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

/**
 * What an image field stores, as the library's values name it (`relative`, `catalogPicture`, ...),
 * and one more: `libraryUrl`, a path under the image library written with the client's own
 * placeholder before it (`${image.library.url}reception/background.png`), as the hotel view's
 * variables keep it.
 */
export type FieldShape = keyof MediaValues | 'libraryUrl';

/** The placeholder the client fills with its image library's address. */
export const LIBRARY_PLACEHOLDER = '${image.library.url}';

/**
 * What a field takes: the shapes it stores a picture in, the first an image has being the one
 * written, and what to offer first - the kinds of image, the plugin whose images a theme's image
 * style names, and the kind of field it is (`usedIn`), whose picks are remembered as recent.
 * `hint` says what suits it, such as a size; `folder` is the image library folder an upload goes
 * into (Habbo's own for that kind of picture, as `web_promo`).
 */
export interface ImageAccept {
    shapes: FieldShape[];
    kinds?: string[];
    plugin?: string;
    usedIn?: string;
    hint?: string;
    folder?: string;
}

/** The library's own value a shape is found by. */
export const valueKeyOf = (shape: FieldShape): keyof MediaValues => (shape === 'libraryUrl' ? 'relative' : shape);

/** The `?shape=` a value is searched by. */
export const shapeParam = (key: keyof MediaValues): MediaShape => key.toLowerCase() as MediaShape;

/** An image's value of this kind, as a field stores it; a plugin's only for the plugin named. */
const valueIn = (image: MediaImage, key: keyof MediaValues, plugin?: string) => {
    if (key === 'plugin' && plugin && image.sourceDetail !== plugin)
        return null;

    const value = image.values[key];

    return value === null || value === '' ? null : String(value);
};

/** The value a field of these shapes writes for an image: its first shape the image has, or null for none. */
export const valueOf = (image: MediaImage, accept: ImageAccept): string | null => {
    for (const shape of accept.shapes) {
        const value = valueIn(image, valueKeyOf(shape), accept.plugin);

        if (value)
            return shape === 'libraryUrl' ? `${LIBRARY_PLACEHOLDER}${value}` : value;
    }

    return null;
};

const ADDRESS = /^(https?:)?\/\//i;

/** Which of a field's shapes a stored value is in, and the value the media library finds it by. */
export const shapeOfValue = (value: string, accept: ImageAccept): { key: keyof MediaValues; value: string } | null => {
    const text = value.trim();

    if (!text)
        return null;

    for (const shape of accept.shapes) {
        const fits = shape === 'catalogIcon'
            ? /^\d+$/.test(text)
            : shape === 'libraryUrl'
                ? text.startsWith(LIBRARY_PLACEHOLDER)
                : shape === 'url'
                    ? ADDRESS.test(text)
                    : shape === 'clientImage' || shape === 'badge'
                        ? /^[\w-]+$/.test(text)
                        : shape === 'catalogPicture'
                            ? !text.includes('/') && !ADDRESS.test(text)
                            : !ADDRESS.test(text) && !text.startsWith('$');

        if (fits)
            return { key: valueKeyOf(shape), value: shape === 'libraryUrl' ? text.slice(LIBRARY_PLACEHOLDER.length) : text };
    }

    return null;
};

/**
 * The image a stored value names, or null when the library has none by it: found by its words
 * among the images with that value, then the one whose value it is.
 */
export const useMediaFind = (key: keyof MediaValues | null, value: string, plugin?: string) => useQuery({
    queryKey: [ 'media', 'find', key, value, plugin ?? null ],
    queryFn: async () => {
        try {
            const found = await search({ q: key === 'catalogIcon' ? `icon_${value}.` : value, shape: shapeParam(key!), size: 60 });

            return found.items.find(x => valueIn(x, key!, plugin) === value) ?? null;
        } catch (error) {
            if (error instanceof ApiError && error.status === 404) return null;

            throw error;
        }
    },
    enabled: key !== null && value.trim() !== '',
    staleTime: 30_000,
    retry: false,
});

/** Where an upload goes: a folder of the image library, the catalog pictures, or a plugin's images. */
export interface MediaUploadTarget {
    key: string;
    label: string;
    folder?: string;
    kind?: string;
    plugin?: string;
}

/** Where an image a field can name may be uploaded: the catalog pictures, a folder of the image library, or the theme's own images. */
export const uploadTargetsOf = (accept: ImageAccept): MediaUploadTarget[] => {
    const keys = new Set(accept.shapes.map(valueKeyOf));
    const targets: MediaUploadTarget[] = [];

    if (keys.has('catalogPicture')) targets.push({ key: 'catalog', label: 'the catalog pictures', kind: CATALOG_PICTURE });
    if (keys.has('relative') || keys.has('url')) targets.push({ key: 'library', label: `the image library's ${accept.folder ?? 'uploads'}/`, folder: accept.folder });
    if (keys.has('plugin') && accept.plugin) targets.push({ key: `plugin:${accept.plugin}`, label: 'the theme\'s images', plugin: accept.plugin });

    return targets;
};

/** A plugin's uploaded image, as the library lists it. */
const pluginImageOf = (plugin: string, file: File, image: PluginImage): MediaImage => {
    const id = `plugin:${plugin}/${image.path}`;

    return {
        id,
        name: file.name,
        path: `${plugin}/${image.path}`,
        kind: 'theme',
        source: 'plugin',
        sourceDetail: plugin,
        url: image.url ?? '',
        thumbUrl: `/media/file?id=${encodeURIComponent(id)}`,
        width: null,
        height: null,
        bytes: image.bytes,
        modifiedUtc: image.modified,
        tags: [],
        usedCount: 0,
        values: { relative: null, catalogPicture: null, catalogIcon: null, clientImage: null, badge: null, plugin: image.path, url: image.url ?? '' },
        usedOn: null,
    };
};

/**
 * Uploads where a field can name the images: into the library (`POST /media`), or a theme's own
 * images through its plugin, as its Images section does - answered as the library would.
 */
export const useUploadForField = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ files, target }: { files: File[]; target: MediaUploadTarget }): Promise<MediaUploadResponse> => {
            if (!target.plugin)
                return uploadMedia({ files, folder: target.folder ?? '', kind: target.kind ?? '' });

            const items: MediaImage[] = [];
            const refused: MediaUploadResponse['refused'] = [];

            for (const file of files) {
                try {
                    items.push(pluginImageOf(target.plugin, file, await uploadPluginImage(target.plugin, file)));
                } catch (error) {
                    refused.push({ file: file.name, why: error instanceof Error ? error.message : String(error) });
                }
            }

            return { items, refused };
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: [ 'media' ] }),
    });
};

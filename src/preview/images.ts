/**
 * Images a preview draws: from the admin API (fetched with the session's token, which an `<img>`
 * cannot send), from another host that allows it (the imager), or picked by the user. Each comes
 * as a loaded `HTMLImageElement` whose `src` an `<img>` can show too, kept by React Query so a
 * picture asked for twice is fetched once.
 */
import { useQuery } from '@tanstack/react-query';

import { apiBlob } from '#/api/client';

/** An image, loaded; `crossOrigin` for one from another host the page draws into a canvas. */
export const loadImage = (src: string, crossOrigin = false) => new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();

    if (crossOrigin)
        image.crossOrigin = 'anonymous';

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`The image could not be loaded: ${src.startsWith('data:') ? 'a picture' : src}`));
    image.src = src;
});

/** A blob as a data url: kept as long as the image is, with no object url to revoke. */
export const dataUrlOf = (blob: Blob) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error ?? new Error('The file could not be read.'));
    reader.readAsDataURL(blob);
});

/** A data url's bytes as base64, as the API takes a file. */
export const base64Of = (dataUrl: string) => dataUrl.slice(dataUrl.indexOf(',') + 1);

/** A canvas's PNG as base64. */
export const pngBase64 = (canvas: HTMLCanvasElement) => base64Of(canvas.toDataURL('image/png'));

const KEEP = { staleTime: Infinity, gcTime: 10 * 60_000, retry: false } as const;

/** The query key every admin API image is kept under: removing it has the picture fetched again. */
export const apiImageKey = (path: string | null) => [ 'preview-image', 'api', path ];

/** The query for an image from the admin API: disabled without a path. */
export const apiImageQuery = (path: string | null) => ({
    queryKey: apiImageKey(path),
    queryFn: async () => loadImage(await dataUrlOf(await apiBlob(path!))),
    enabled: path !== null,
    ...KEEP,
});

/** The query for an image from a url - another host's must allow it (`Access-Control-Allow-Origin`) - or a data url. */
export const urlImageQuery = (src: string | null) => ({
    queryKey: [ 'preview-image', 'url', src ],
    queryFn: () => loadImage(src!, !src!.startsWith('data:')),
    enabled: src !== null,
    ...KEEP,
});

/** An image from the admin API, or null while it loads (and when there is none). */
export const useApiImage = (path: string | null) => useQuery(apiImageQuery(path)).data ?? null;

/** An image from a url or a data url, and whether it could not be loaded. */
export const useImage = (src: string | null) => {
    const query = useQuery(urlImageQuery(src));

    return { image: query.data ?? null, failed: query.isError };
};

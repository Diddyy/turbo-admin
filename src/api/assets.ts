import { useQuery } from '@tanstack/react-query';

import { api } from './client';

/**
 * Where the client loads its images from, read by the server from the client's own
 * `nitro-config.json` (`Turbo:Admin:ClientConfigUrl`), so the panel shows what players see. Each
 * keeps the client's placeholders; an empty one shows none.
 */
export interface ClientAssets {
    /** `catalog.icons.url`: `%name%` is the icon's number. */
    catalogIcon: string;
    /** `asset.urls.catalog`: `%name%` is the page image's name. */
    catalogImage: string;
    /** `asset.urls.icons.furni`: `%libname%` is the class name, `%param%` `_` and its colour or nothing. */
    furniIcon: string;
    /** `badge.asset.url`: `%badgename%` is the badge code. */
    badge: string;
    /** `image.library.url`: a featured item's promo image is its path under this. */
    imageLibrary: string;
    /** `asset.bundles.templates`: `%libname%` is the library, as `habbo-free-flow-chat-com`. */
    templates: string;
    /** The nitro-imager the panel draws avatars with (`Turbo:Admin:ImagerUrl`), without a trailing slash. */
    imager: string;
}

/** The addresses change only when the client is redeployed, so they are asked for once a session. */
export const useClientAssets = () => useQuery({
    queryKey: [ 'client-assets' ],
    queryFn: () => api<ClientAssets>('/client/assets'),
    staleTime: Infinity,
}).data;

const fill = (template: string | undefined, values: Record<string, string>) => {
    if (!template)
        return null;

    return Object.entries(values).reduce((url, [ key, value ]) => url.replaceAll(`%${key}%`, encodeURIComponent(value)), template);
};

/** A catalog page's icon, as the client's navigator draws it; null when there is none to show. */
export const catalogIconUrl = (assets: ClientAssets | undefined, icon: number) =>
    icon > 0 ? fill(assets?.catalogIcon, { name: String(icon) }) : null;

/** A catalog page image, by the name the page lists it under. */
export const catalogImageUrl = (assets: ClientAssets | undefined, name: string) =>
    name.trim() ? fill(assets?.catalogImage, { name: name.trim() }) : null;

/**
 * A furniture's icon, by its class name. A coloured one (`throne*4`) is its base class's with `_`
 * and the colour after it, as the client asks for it.
 */
export const furniIconUrl = (assets: ClientAssets | undefined, className: string | null) => {
    if (!className)
        return null;

    const [ libname = className, colour ] = className.split('*');

    return fill(assets?.furniIcon, { libname, param: colour ? `_${colour}` : '' });
};

/** A badge's image, by its code. */
export const badgeUrl = (assets: ClientAssets | undefined, code: string | null) =>
    code?.trim() ? fill(assets?.badge, { badgename: code.trim() }) : null;

/** A template bundle as the client loads it, by its library's name. */
export const templateBundleUrl = (assets: ClientAssets | undefined, library: string) =>
    fill(assets?.templates, { libname: library });

/** A catalog featured item's promo image: its path under the client's image library. */
export const promoImageUrl = (assets: ClientAssets | undefined, path: string) =>
    path.trim() && assets?.imageLibrary ? `${assets.imageLibrary}${path.trim().replace(/^\/+/, '')}` : null;

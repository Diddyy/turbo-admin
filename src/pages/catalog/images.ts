import type { ImageAccept } from '#/api/media';

/** A page's picture (header, teaser, special) is a catalog picture's name, its file in `images/catalog`. */
export const CATALOG_PICTURE: ImageAccept = { shapes: [ 'catalogPicture' ] };

/** A page's icon is the number of the client's `icon_<n>.png`. */
export const CATALOG_ICON: ImageAccept = { shapes: [ 'catalogIcon' ], usedIn: 'catalog.icon' };

/** A featured item's promo image is its path under the client's image library (`web_promo_small/spromo_x.png`). */
export const FEATURED_IMAGE: ImageAccept = { shapes: [ 'relative' ], usedIn: 'catalog.featured', folder: 'web_promo_small' };

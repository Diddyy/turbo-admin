import type { CatalogPageDetail, CatalogPageInput } from '#/api/catalog';

/** A page's settings as they are edited: everything but where it sits. */
export type PageDraft = Omit<CatalogPageInput, 'parentId'>;

export const pageDraftOf = (page: CatalogPageDetail): PageDraft => ({
    localization: page.localization,
    name: page.name,
    icon: page.icon,
    layout: page.layout,
    imageData: page.imageData,
    textData: page.textData,
    display: page.display,
    folderOnly: page.folderOnly,
});

/** A list with one place set, padded to reach it, without empty places left trailing. */
export const withSlot = (list: string[], index: number, value: string) => {
    const next = [ ...list ];

    while (next.length <= index)
        next.push('');

    next[index] = value;

    while (next.length > 0 && !next[next.length - 1])
        next.pop();

    return next;
};

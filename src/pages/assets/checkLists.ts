import { type BundleKind, useAssetChecks } from '#/api/bundles';

/** The tab each kind's bundles are listed on. */
export const KIND_TABS: Record<BundleKind, string> = { furniture: 'furniture', figure: 'clothing&view=bundles', effect: 'effects', pet: 'pets' };

/** The checks that found something, errors first; with `ids`, only those. */
export const useFoundChecks = (ids?: string[]) => {
    const query = useAssetChecks();
    const items = (query.data?.items ?? [])
        .filter(x => x.count > 0 && (!ids || ids.includes(x.id)))
        .sort((a, b) => (a.severity === b.severity ? b.count - a.count : a.severity === 'error' ? -1 : 1));

    return { ...query, items };
};

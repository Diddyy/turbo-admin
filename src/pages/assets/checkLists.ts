import { type BundleKind, useAssetChecks } from '#/api/bundles';

/** The library tab each kind's bundles are listed on (clothing's in its bundles view); templates are built by the content pages, with no list of their own. */
export const KIND_TABS: Record<BundleKind, string | null> = { furniture: 'furniture', figure: 'clothing', effect: 'effects', pet: 'pets', template: null, room: null, 'furni-icon': null, 'catalog-icon': null, badge: null, 'catalog-image': null, sound: null, 'library-image': null };

/** The checks that found something, errors first; with `ids`, only those. */
export const useFoundChecks = (ids?: string[]) => {
    const query = useAssetChecks();
    const items = (query.data?.items ?? [])
        .filter(x => x.count > 0 && (!ids || ids.includes(x.id)))
        .sort((a, b) => (a.severity === b.severity ? b.count - a.count : a.severity === 'error' ? -1 : 1));

    return { ...query, items };
};

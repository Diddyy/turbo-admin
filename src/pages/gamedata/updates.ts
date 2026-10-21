import type { ReactNode } from 'react';

import type { BundleKind } from '#/api/bundles';

/** Something Habbo has that the hotel may take in: its count waiting, and its list to review and take in. */
export interface Category {
    id: string;
    label: string;
    group: 'Gamedata' | 'Bundles';
    /** What waits to be taken in; null while it is worked out or can't be. */
    count: number | null;
    /** Why there is no count, when it isn't only loading. */
    note?: string;
    content: ReactNode;
}

/** The kinds of library a sync takes from Habbo, in its order, each with its category on the Waiting tab. */
export const LIBRARY_CATEGORIES: { kind: BundleKind; id: string; label: string }[] = [
    { kind: 'furniture', id: 'furniture-bundles', label: 'Furniture' },
    { kind: 'figure', id: 'figure-bundles', label: 'Clothing' },
    { kind: 'effect', id: 'effect-bundles', label: 'Effects' },
    { kind: 'pet', id: 'pet-bundles', label: 'Pets' },
    { kind: 'room', id: 'room-bundles', label: 'Room libraries' },
    { kind: 'badge', id: 'badges', label: 'Badges' },
    { kind: 'catalog-icon', id: 'catalog-icons', label: 'Catalog icons' },
    { kind: 'catalog-image', id: 'catalog-pictures', label: 'Catalog pictures' },
    { kind: 'sound', id: 'trax-samples', label: 'Trax samples' },
];

/** The Waiting tab, opened on one category. */
export const waitingLink = (id: string) => `/gamedata/updates/waiting?pick=${id}`;

import { DatabaseBackup, Disc3, FileUp, LayoutGrid, ListChecks, PackagePlus, Ticket, Wand2 } from 'lucide-react';

import type { TabItem } from '#/components/Tabs';

/** The catalog editor's own views, switched in its address (`?view=`). */
export type CatalogTab = 'editor' | 'audit' | 'generate' | 'import' | 'backups' | 'vouchers' | 'songs' | 'discounts';

const VIEWS: { value: CatalogTab; label: string; icon: React.ReactNode; to: string }[] = [
    { value: 'editor', label: 'Editor', icon: <LayoutGrid />, to: '/catalog' },
    { value: 'audit', label: 'Audit', icon: <ListChecks />, to: '/catalog?view=missing' },
    { value: 'generate', label: 'Generate', icon: <Wand2 />, to: '/catalog?view=generate' },
    { value: 'import', label: 'Import', icon: <FileUp />, to: '/catalog?view=import' },
    { value: 'backups', label: 'Backups', icon: <DatabaseBackup />, to: '/catalog?view=backups' },
    { value: 'vouchers', label: 'Vouchers', icon: <Ticket />, to: '/vouchers' },
    { value: 'songs', label: 'Songs', icon: <Disc3 />, to: '/catalog/songs' },
    { value: 'discounts', label: 'Discounts', icon: <PackagePlus />, to: '/catalog/discounts' },
];

const PAGES_OF_THEIR_OWN = new Set<CatalogTab>([ 'vouchers', 'songs', 'discounts' ]);

/**
 * The tabs along every catalog page's header: the editor's views, then vouchers, songs and
 * bundle discounts, which are pages of their own. On the editor, its views switch in place
 * (`inPlace`) and keep the page open; elsewhere every tab is a link.
 */
export const catalogTabs = (value: CatalogTab, inPlace = false): { items: TabItem[]; value: CatalogTab } => ({
    value,
    items: VIEWS.map(view => ({
        value: view.value,
        label: view.label,
        icon: view.icon,
        to: inPlace && !PAGES_OF_THEIR_OWN.has(view.value) ? undefined : view.to,
    })),
});

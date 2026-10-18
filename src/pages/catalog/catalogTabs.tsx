import { DatabaseBackup, Disc3, FileUp, LayoutGrid, ListChecks, Ticket, Wand2 } from 'lucide-react';

import type { TabItem } from '#/components/Tabs';

/** The catalog editor's own views, switched in its address (`?view=`). */
export type CatalogTab = 'editor' | 'audit' | 'generate' | 'import' | 'backups' | 'vouchers' | 'songs';

const VIEWS: { value: CatalogTab; label: string; icon: React.ReactNode; to: string }[] = [
    { value: 'editor', label: 'Editor', icon: <LayoutGrid />, to: '/catalog' },
    { value: 'audit', label: 'Audit', icon: <ListChecks />, to: '/catalog?view=missing' },
    { value: 'generate', label: 'Generate', icon: <Wand2 />, to: '/catalog?view=generate' },
    { value: 'import', label: 'Import', icon: <FileUp />, to: '/catalog?view=import' },
    { value: 'backups', label: 'Backups', icon: <DatabaseBackup />, to: '/catalog?view=backups' },
    { value: 'vouchers', label: 'Vouchers', icon: <Ticket />, to: '/vouchers' },
    { value: 'songs', label: 'Songs', icon: <Disc3 />, to: '/catalog/songs' },
];

/**
 * The tabs along every catalog page's header: the editor's views, then vouchers and songs, which
 * are pages of their own. On the editor, its views switch in place (`inPlace`) and keep the page
 * open; elsewhere every tab is a link.
 */
export const catalogTabs = (value: CatalogTab, inPlace = false): { items: TabItem[]; value: CatalogTab } => ({
    value,
    items: VIEWS.map(view => ({
        value: view.value,
        label: view.label,
        icon: view.icon,
        to: inPlace && view.value !== 'vouchers' && view.value !== 'songs' ? undefined : view.to,
    })),
});

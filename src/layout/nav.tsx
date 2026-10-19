import { Activity, Armchair, Bug, CloudDownload, Coins, Disc3, DoorOpen, Flag, FunnelX, Gauge, History, House, KeyRound, Landmark, Languages, Mail, MessagesSquare, Milestone, PackagePlus, Plug, Puzzle, ScrollText, Send, Shield, ShieldCheck, SlidersHorizontal, SquareTerminal, Store, Ticket, UserRound, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { useLocation } from 'react-router';

import { usePluginPages } from '#/api/pluginPages';
import { useMe } from '#/api/queries';
import type { MeResponse } from '#/api/types';
import type { TabItem } from '#/components/Tabs';

type Need = keyof Pick<MeResponse, 'canViewRooms' | 'canViewPlayers' | 'canViewPermissions' | 'canViewCommandLog' | 'canViewChatlog' | 'canViewCatalog' | 'canViewGamedata' | 'canViewSettings' | 'canViewContent' | 'canViewPlugins' | 'canResetPasskeys' | 'canManageRewardTracks' | 'canHandleReports' | 'canViewMessages'>;

/** One page of the panel: where `g` and its letter go, and what the search offers by name. */
export interface NavItem {
    to: string;
    label: string;
    icon: ReactNode;
    /** Only this path, not the paths under it. */
    end: boolean;
    /** The page's other paths, for a page whose tabs are not under its own (Texts & variables). */
    also?: string[];
    /** The letter after `g` that goes to it (`Shortcuts`); none for a page reached from its hub. */
    key?: string;
    needs?: Need;
}

const PAGES = {
    dashboard: { to: '/', label: 'Overview', icon: <Gauge />, end: true, key: 'd' },
    performance: { to: '/performance', label: 'Performance', icon: <Activity />, end: false, key: 'm' },
    players: { to: '/players', label: 'Players', icon: <Users />, end: false, key: 'p', needs: 'canViewPlayers' },
    reports: { to: '/reports', label: 'Reports', icon: <Flag />, end: false, key: 'q', needs: 'canHandleReports' },
    wordFilter: { to: '/word-filter', label: 'Word filter', icon: <FunnelX />, end: false, needs: 'canHandleReports' },
    rooms: { to: '/rooms', label: 'Rooms', icon: <House />, end: false, key: 'r', needs: 'canViewRooms' },
    groups: { to: '/groups', label: 'Groups', icon: <Shield />, end: false, key: 'b', needs: 'canViewContent' },
    badgeParts: { to: '/groups/badge-parts', label: 'Badge parts', icon: <Puzzle />, end: false, needs: 'canViewContent' },
    catalog: { to: '/catalog', label: 'Catalog', icon: <Store />, end: false, key: 'c', needs: 'canViewCatalog' },
    vouchers: { to: '/catalog/vouchers', label: 'Vouchers', icon: <Ticket />, end: false, key: 'u', needs: 'canViewCatalog' },
    songs: { to: '/catalog/songs', label: 'Songs', icon: <Disc3 />, end: false, needs: 'canViewCatalog' },
    discounts: { to: '/catalog/discounts', label: 'Bundle discounts', icon: <PackagePlus />, end: false, needs: 'canViewSettings' },
    hotelView: { to: '/hotel-view', label: 'Hotel view', icon: <Landmark />, end: false, key: 'v', needs: 'canViewGamedata' },
    rewardTracks: { to: '/reward-tracks', label: 'Reward tracks', icon: <Milestone />, end: false, key: 'w', needs: 'canManageRewardTracks' },
    content: { to: '/content', label: 'Content', icon: <Puzzle />, end: false, key: 't', needs: 'canViewContent' },
    updates: { to: '/gamedata/updates', label: 'Habbo updates', icon: <CloudDownload />, end: false, key: 'g', needs: 'canViewGamedata' },
    library: { to: '/gamedata/library', label: 'Library', icon: <Armchair />, end: false, key: 'f', needs: 'canViewGamedata' },
    texts: { to: '/gamedata/products', also: [ '/gamedata/texts', '/gamedata/variables' ], label: 'Texts & variables', icon: <Languages />, end: false, key: 'x', needs: 'canViewGamedata' },
    publish: { to: '/gamedata/publish', label: 'Publish', icon: <Send />, end: false, key: 'n', needs: 'canViewGamedata' },
    permissions: { to: '/permissions', label: 'Permissions', icon: <KeyRound />, end: false, key: 'k', needs: 'canViewPermissions' },
    staff: { to: '/staff', label: 'Staff passkeys', icon: <ShieldCheck />, end: false, key: 's', needs: 'canResetPasskeys' },
    commandLog: { to: '/command-log', label: 'Command log', icon: <ScrollText />, end: false, key: 'l', needs: 'canViewCommandLog' },
    chatlog: { to: '/chatlog', label: 'Chat log', icon: <MessagesSquare />, end: false, key: 'h', needs: 'canViewChatlog' },
    messages: { to: '/messages', label: 'Messages', icon: <Mail />, end: false, needs: 'canViewMessages' },
    currencyLog: { to: '/currency-log', label: 'Currency', icon: <Coins />, end: false, needs: 'canViewPlayers' },
    roomVisits: { to: '/room-visits', label: 'Room visits', icon: <DoorOpen />, end: false, needs: 'canViewPlayers' },
    permissionLog: { to: '/permission-log', label: 'Permission log', icon: <History />, end: false, needs: 'canViewPermissions' },
    settings: { to: '/settings', label: 'Settings', icon: <SlidersHorizontal />, end: false, key: 'e', needs: 'canViewSettings' },
    plugins: { to: '/plugins', label: 'Plugins', icon: <Plug />, end: false, key: 'i', needs: 'canViewPlugins' },
    console: { to: '/console', label: 'Console', icon: <SquareTerminal />, end: false, key: 'o' },
    account: { to: '/account', label: 'Account', icon: <UserRound />, end: false, key: 'a' },
} satisfies Record<string, NavItem>;

type PageName = keyof typeof PAGES;

/**
 * A place in the navigation: one entry that holds one page or several alike, whose header shows
 * them as tabs (the command log and the chat log are both under Logs). It goes to the first of
 * them the viewer may open, and shows only when there is one.
 */
export interface NavEntry {
    label: string;
    icon: ReactNode;
    pages: PageName[];
    /** A line about it, for the menu on a phone. */
    hint: string;
    /** A plugin's page: where it is, which holds no page of the panel's own. */
    path?: string;
}

export interface NavSection {
    /** None for the first, which stands above the rest. */
    label: string | null;
    entries: NavEntry[];
}

const OVERVIEW: NavEntry = { label: 'Overview', icon: <Gauge />, pages: [ 'dashboard', 'performance' ], hint: 'The hotel now, and how the server runs' };
const LOGS: NavEntry = { label: 'Logs', icon: <ScrollText />, pages: [ 'commandLog', 'chatlog', 'messages', 'currencyLog', 'roomVisits', 'permissionLog' ], hint: 'Commands run, chat in rooms, private messages, wallet changes, room visits, permission changes' };
const MODERATION: NavEntry = { label: 'Moderation', icon: <Flag />, pages: [ 'reports', 'wordFilter' ], hint: 'Calls for help players send, and the word filter' };
const GROUPS: NavEntry = { label: 'Groups', icon: <Shield />, pages: [ 'groups', 'badgeParts' ], hint: 'Groups, their members, and badge parts' };
const ACCESS: NavEntry = { label: 'Access', icon: <KeyRound />, pages: [ 'permissions', 'staff' ], hint: 'Groups, nodes and staff passkeys' };

const SECTIONS: NavSection[] = [
    { label: null, entries: [ OVERVIEW ] },
    {
        label: 'Community',
        entries: [
            { label: 'Players', icon: <Users />, pages: [ 'players' ], hint: 'Find a player, act on them' },
            MODERATION,
            { label: 'Rooms', icon: <House />, pages: [ 'rooms' ], hint: 'Rooms, who is in them, their settings' },
            GROUPS,
        ],
    },
    {
        label: 'Shop',
        entries: [ { label: 'Catalog', icon: <Store />, pages: [ 'catalog', 'vouchers', 'songs', 'discounts' ], hint: 'Pages, offers, vouchers, songs and bundle discounts' } ],
    },
    {
        label: 'World',
        entries: [
            { label: 'Hotel view', icon: <Landmark />, pages: [ 'hotelView' ], hint: 'The reception players land in' },
            { label: 'Reward tracks', icon: <Milestone />, pages: [ 'rewardTracks' ], hint: 'Progression tracks: tasks, prizes and premium' },
            { label: 'Content', icon: <Puzzle />, pages: [ 'content' ], hint: 'Achievements, badges, pets, chat styles' },
        ],
    },
    {
        label: 'Gamedata',
        entries: [
            { label: 'Habbo updates', icon: <CloudDownload />, pages: [ 'updates' ], hint: 'What Habbo has that the hotel hasn\'t taken in' },
            { label: 'Library', icon: <Armchair />, pages: [ 'library' ], hint: 'Furniture, clothing, effects and pets' },
            { label: 'Texts & variables', icon: <Languages />, pages: [ 'texts' ], hint: 'Product data, external texts and variables' },
            { label: 'Publish', icon: <Send />, pages: [ 'publish' ], hint: 'Publish targets, client files and checks' },
        ],
    },
    { label: 'Staff', entries: [ ACCESS, LOGS ] },
    {
        label: 'Server',
        entries: [
            { label: 'Settings', icon: <SlidersHorizontal />, pages: [ 'settings' ], hint: 'How the server is set up' },
            { label: 'Plugins', icon: <Plug />, pages: [ 'plugins' ], hint: 'What the server loaded, and turning it off or on' },
            { label: 'Console', icon: <SquareTerminal />, pages: [ 'console' ], hint: 'Run the hotel\'s commands' },
        ],
    },
];

/** Whether a path is a page's or under it. */
const isAt = (pathname: string, page: NavItem) =>
    [ page.to, ...(page.also ?? []) ].some(to => (page.end ? pathname === to : pathname === to || pathname.startsWith(`${to}/`)));

const allowed = (me: MeResponse | undefined, page: NavItem) => !page.needs || !!me?.[page.needs];

/** An entry as the viewer has it: where it goes, and the pages it holds that they may open. */
export interface ShownEntry extends NavEntry {
    to: string;
    shown: NavItem[];
}

/** The icons a plugin's page may name; any other is a plug. */
const PLUGIN_ICONS: Record<string, ReactNode> = { bug: <Bug />, puzzle: <Puzzle />, scroll: <ScrollText />, users: <Users /> };

/**
 * The pages live plugins add to the navigation, those the viewer may see: under Plugins, below the
 * panel's own, and gone as soon as the plugin is reloaded without them, turned off or taken away.
 */
const usePluginEntries = (): ShownEntry[] => {
    const { data: plugins } = usePluginPages();

    return (plugins ?? []).flatMap(plugin => plugin.pages.filter(page => page.nav).map((page) => {
        const to = `/plugin/${plugin.key}/${page.id}`;
        const icon = PLUGIN_ICONS[page.icon ?? ''] ?? <Plug />;

        return { label: page.title, icon, pages: [], hint: `From the plugin ${plugin.name}`, path: `/plugin/${plugin.key}/`, to, shown: [ { to, label: page.title, icon, end: false } ] };
    }));
};

/** The navigation's sections, with only the entries the signed-in player may open. */
export const useNav = (): { label: string | null; entries: ShownEntry[] }[] => {
    const { data: me } = useMe();
    const plugins = usePluginEntries();

    return [ ...SECTIONS, { label: 'Plugins', entries: [] } ]
        .map(section => ({
            label: section.label,
            entries: section.entries
                .map((entry) => {
                    const shown = entry.pages.map(name => PAGES[name] as NavItem).filter(page => allowed(me, page));

                    return { ...entry, shown, to: shown[0]?.to ?? '' };
                })
                .filter(entry => entry.shown.length > 0),
        }))
        .map(section => (section.label === 'Plugins' ? { ...section, entries: plugins } : section))
        .filter(section => section.entries.length > 0);
};

/** Every page the signed-in player may open, the account too: where `g` and a letter go, and what the search offers by name. */
export const usePages = (): NavItem[] => {
    const { data: me } = useMe();

    return Object.values(PAGES).filter(page => allowed(me, page));
};

/** The page open now, the deepest that holds the path (Songs, not Catalog). */
const pageAt = (pathname: string) =>
    (Object.values(PAGES) as NavItem[])
        .filter(page => isAt(pathname, page))
        .sort((a, b) => b.to.length - a.to.length)[0];

/**
 * The navigation's entry for the page open now: a room's pages are under Rooms. A page with no
 * entry of its own (the account) stands as its own; none for a path no page holds.
 */
export const useActiveNavItem = (): NavEntry | undefined => {
    const { pathname } = useLocation();
    const page = pageAt(pathname);

    if (!page)
        return undefined;

    return SECTIONS.flatMap(section => section.entries).find(entry => entry.pages.some(name => PAGES[name] === page))
        ?? { label: page.label, icon: page.icon, pages: [], hint: '' };
};

/** Whether an entry holds the page open now. */
export const useIsActive = () => {
    const { pathname } = useLocation();
    const page = pageAt(pathname);

    return (entry: NavEntry) => (entry.path ? pathname.startsWith(entry.path) : !!page && entry.pages.some(name => PAGES[name] === page));
};

/**
 * The tabs of an entry that holds several pages, for its pages' headers: each a link to its page,
 * the one open now chosen. Only the pages the viewer may open; none at all when that is one.
 */
export const useHubTabs = (hub: 'overview' | 'logs' | 'groups' | 'moderation'): { items: TabItem[]; value: string } | undefined => {
    const { data: me } = useMe();
    const { pathname } = useLocation();
    const entry = { overview: OVERVIEW, logs: LOGS, groups: GROUPS, moderation: MODERATION }[hub];
    const pages = entry.pages.map(name => PAGES[name] as NavItem).filter(page => allowed(me, page));

    if (pages.length < 2)
        return undefined;

    return {
        items: pages.map(page => ({ value: page.to, label: page.label, icon: page.icon, to: page.to })),
        // The deepest that holds the path: Badge parts, not the Groups above it.
        value: pages.find(page => page === pageAt(pathname))?.to ?? pages[0]!.to,
    };
};

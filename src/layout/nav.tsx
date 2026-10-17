import { Activity, Database, Disc3, Gauge, House, KeyRound, Landmark, MessagesSquare, Puzzle, ScrollText, Shield, ShieldCheck, SlidersHorizontal, SquareTerminal, Store, Ticket, UserRound, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { useLocation } from 'react-router';

import { useMe } from '#/api/queries';
import type { MeResponse } from '#/api/types';
import type { TabItem } from '#/components/Tabs';

type Need = keyof Pick<MeResponse, 'canViewRooms' | 'canViewPlayers' | 'canViewPermissions' | 'canViewCommandLog' | 'canViewChatlog' | 'canViewCatalog' | 'canViewGamedata' | 'canViewSettings' | 'canViewContent' | 'canResetPasskeys'>;

/** One page of the panel: where `g` and its letter go, and what the search offers by name. */
export interface NavItem {
    to: string;
    label: string;
    icon: ReactNode;
    /** Only this path, not the paths under it. */
    end: boolean;
    /** The letter after `g` that goes to it (`Shortcuts`); none for a page reached from its hub. */
    key?: string;
    needs?: Need;
}

const PAGES = {
    dashboard: { to: '/', label: 'Overview', icon: <Gauge />, end: true, key: 'd' },
    performance: { to: '/performance', label: 'Performance', icon: <Activity />, end: false, key: 'm' },
    players: { to: '/players', label: 'Players', icon: <Users />, end: false, key: 'p', needs: 'canViewPlayers' },
    rooms: { to: '/rooms', label: 'Rooms', icon: <House />, end: false, key: 'r', needs: 'canViewRooms' },
    groups: { to: '/groups', label: 'Groups', icon: <Shield />, end: false, key: 'b', needs: 'canViewContent' },
    badgeParts: { to: '/groups/badge-parts', label: 'Badge parts', icon: <Puzzle />, end: false, needs: 'canViewContent' },
    catalog: { to: '/catalog', label: 'Catalog', icon: <Store />, end: false, key: 'c', needs: 'canViewCatalog' },
    vouchers: { to: '/vouchers', label: 'Vouchers', icon: <Ticket />, end: false, key: 'u', needs: 'canViewCatalog' },
    songs: { to: '/catalog/songs', label: 'Songs', icon: <Disc3 />, end: false, needs: 'canViewCatalog' },
    hotelView: { to: '/hotel-view', label: 'Hotel view', icon: <Landmark />, end: false, key: 'v', needs: 'canViewGamedata' },
    content: { to: '/content', label: 'Content', icon: <Puzzle />, end: false, key: 't', needs: 'canViewContent' },
    gamedata: { to: '/gamedata', label: 'Gamedata & assets', icon: <Database />, end: false, key: 'g', needs: 'canViewGamedata' },
    permissions: { to: '/permissions', label: 'Permissions', icon: <KeyRound />, end: false, key: 'k', needs: 'canViewPermissions' },
    staff: { to: '/staff', label: 'Staff passkeys', icon: <ShieldCheck />, end: false, key: 's', needs: 'canResetPasskeys' },
    commandLog: { to: '/command-log', label: 'Command log', icon: <ScrollText />, end: false, key: 'l', needs: 'canViewCommandLog' },
    chatlog: { to: '/chatlog', label: 'Chat log', icon: <MessagesSquare />, end: false, key: 'h', needs: 'canViewChatlog' },
    settings: { to: '/settings', label: 'Settings', icon: <SlidersHorizontal />, end: false, key: 'e', needs: 'canViewSettings' },
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
}

export interface NavSection {
    /** None for the first, which stands above the rest. */
    label: string | null;
    entries: NavEntry[];
}

const OVERVIEW: NavEntry = { label: 'Overview', icon: <Gauge />, pages: [ 'dashboard', 'performance' ], hint: 'The hotel now, and how the server runs' };
const LOGS: NavEntry = { label: 'Logs', icon: <ScrollText />, pages: [ 'commandLog', 'chatlog' ], hint: 'Commands run and chat in rooms' };
const GROUPS: NavEntry = { label: 'Groups', icon: <Shield />, pages: [ 'groups', 'badgeParts' ], hint: 'Groups, their members, and badge parts' };
const ACCESS: NavEntry = { label: 'Access', icon: <KeyRound />, pages: [ 'permissions', 'staff' ], hint: 'Groups, nodes and staff passkeys' };

const SECTIONS: NavSection[] = [
    { label: null, entries: [ OVERVIEW ] },
    {
        label: 'Community',
        entries: [
            { label: 'Players', icon: <Users />, pages: [ 'players' ], hint: 'Find a player, act on them' },
            { label: 'Rooms', icon: <House />, pages: [ 'rooms' ], hint: 'Rooms, who is in them, their settings' },
            GROUPS,
        ],
    },
    {
        label: 'Shop',
        entries: [ { label: 'Catalog', icon: <Store />, pages: [ 'catalog', 'vouchers', 'songs' ], hint: 'Pages, offers, vouchers and songs' } ],
    },
    {
        label: 'World',
        entries: [
            { label: 'Hotel view', icon: <Landmark />, pages: [ 'hotelView' ], hint: 'The reception players land in' },
            { label: 'Content', icon: <Puzzle />, pages: [ 'content' ], hint: 'Achievements, badges, pets, chat styles' },
            { label: 'Gamedata & assets', icon: <Database />, pages: [ 'gamedata' ], hint: 'Updates from Habbo, furni, clothing, bundles, texts' },
        ],
    },
    { label: 'Staff', entries: [ ACCESS, LOGS ] },
    {
        label: 'Server',
        entries: [
            { label: 'Settings', icon: <SlidersHorizontal />, pages: [ 'settings' ], hint: 'How the server is set up' },
            { label: 'Console', icon: <SquareTerminal />, pages: [ 'console' ], hint: 'Run the hotel\'s commands' },
        ],
    },
];

/** Whether a path is a page's or under it. */
const isAt = (pathname: string, page: NavItem) =>
    page.end ? pathname === page.to : pathname === page.to || pathname.startsWith(`${page.to}/`);

const allowed = (me: MeResponse | undefined, page: NavItem) => !page.needs || !!me?.[page.needs];

/** An entry as the viewer has it: where it goes, and the pages it holds that they may open. */
export interface ShownEntry extends NavEntry {
    to: string;
    shown: NavItem[];
}

/** The navigation's sections, with only the entries the signed-in player may open. */
export const useNav = (): { label: string | null; entries: ShownEntry[] }[] => {
    const { data: me } = useMe();

    return SECTIONS
        .map(section => ({
            label: section.label,
            entries: section.entries
                .map((entry) => {
                    const shown = entry.pages.map(name => PAGES[name] as NavItem).filter(page => allowed(me, page));

                    return { ...entry, shown, to: shown[0]?.to ?? '' };
                })
                .filter(entry => entry.shown.length > 0),
        }))
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

/** The navigation's entry for the page open now: a room's pages are under Rooms. None for a page it has none for. */
export const useActiveNavItem = (): NavEntry | undefined => {
    const { pathname } = useLocation();
    const page = pageAt(pathname);

    return page && SECTIONS.flatMap(section => section.entries).find(entry => entry.pages.some(name => PAGES[name] === page));
};

/** Whether an entry holds the page open now. */
export const useIsActive = () => {
    const { pathname } = useLocation();
    const page = pageAt(pathname);

    return (entry: NavEntry) => !!page && entry.pages.some(name => PAGES[name] === page);
};

/**
 * The tabs of an entry that holds several pages, for its pages' headers: each a link to its page,
 * the one open now chosen. Only the pages the viewer may open; none at all when that is one.
 */
export const useHubTabs = (hub: 'overview' | 'logs' | 'groups'): { items: TabItem[]; value: string } | undefined => {
    const { data: me } = useMe();
    const { pathname } = useLocation();
    const entry = { overview: OVERVIEW, logs: LOGS, groups: GROUPS }[hub];
    const pages = entry.pages.map(name => PAGES[name] as NavItem).filter(page => allowed(me, page));

    if (pages.length < 2)
        return undefined;

    return {
        items: pages.map(page => ({ value: page.to, label: page.label, icon: page.icon, to: page.to })),
        value: pages.find(page => isAt(pathname, page))?.to ?? pages[0]!.to,
    };
};

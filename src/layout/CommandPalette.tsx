import { Armchair, ArrowRight, House, Languages, Package, Search, SquareTerminal, Store, UserRound } from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import { useCommands, useMe } from '#/api/queries';
import { MIN_SEARCH_LENGTH, type SearchHit, type SearchKind, useSearch } from '#/api/search';
import { Label } from '#/components/ui';
import { cx } from '#/lib/cx';
import { useRecent } from '#/lib/recent';

import { usePages } from './nav';
import { usePalette } from './palette';

interface Hit {
    key: string;
    icon: ReactNode;
    title: string;
    subtitle?: string;
    /** The keys after `g` that go to it, shown at the row's end. */
    shortcut?: string;
    to: string;
}

interface Group {
    label: string;
    hits: Hit[];
}

/** How many console commands the palette lists. */
const PER_GROUP = 5;

const params = (values: Record<string, string>) => new URLSearchParams(values).toString();

/** Each kind the server finds: its group's name, its icon, where a hit opens, and where all of them are. */
const KINDS: Record<SearchKind, { label: string; many: string; icon: ReactNode; open: (hit: SearchHit) => string; all?: (q: string) => string }> = {
    player: { label: 'Players', many: 'players', icon: <UserRound />, open: hit => `/players/${hit.id}`, all: q => `/players?${params({ q, by: 'name', page: '1' })}` },
    room: { label: 'Rooms', many: 'rooms', icon: <House />, open: hit => `/rooms/${hit.id}`, all: q => `/rooms?${params({ q, by: 'name', page: '1' })}` },
    catalogPage: { label: 'Catalog pages', many: 'pages', icon: <Store />, open: hit => `/catalog?${params({ page: hit.id })}` },
    furniture: { label: 'Furniture', many: 'furniture', icon: <Armchair />, open: hit => `/gamedata/library?${params({ tab: 'furniture', q: hit.title, id: hit.id })}`, all: q => `/gamedata/library?${params({ tab: 'furniture', q })}` },
    text: { label: 'Texts', many: 'texts', icon: <Languages />, open: hit => `/gamedata/texts?${params({ tab: 'texts', q: hit.id, open: hit.id })}`, all: q => `/gamedata/texts?${params({ tab: 'texts', q })}` },
    product: { label: 'Product data', many: 'products', icon: <Package />, open: hit => `/gamedata/texts?${params({ tab: 'products', q: hit.id, open: hit.id })}`, all: q => `/gamedata/texts?${params({ tab: 'products', q })}` },
};

/**
 * The search, opened with Ctrl K (Cmd K), `/` or a page header's search button. Before anything is
 * typed: the players and rooms opened lately, and every page. Then the pages by name, an id as
 * that room or player, what the server finds (`/api/search`: players, rooms, catalog pages,
 * furniture, texts and product data, each only for those who may open it) and the console's
 * commands. The arrow keys pick a hit and Enter opens it.
 */
const Palette = ({ onClose }: { onClose: () => void }) => {
    const navigate = useNavigate();
    const dialog = useRef<HTMLDialogElement>(null);
    const list = useRef<HTMLDivElement>(null);
    const [ text, setText ] = useState('');
    const [ q, setQ ] = useState('');
    const [ active, setActive ] = useState(0);
    const me = useMe().data;
    const allPages = usePages();
    const recent = useRecent(state => state.items);
    const searching = q.length >= MIN_SEARCH_LENGTH;

    const search = useSearch(q);
    const commands = useCommands();

    useEffect(() => {
        dialog.current?.showModal();
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => setQ(text.trim()), 180);

        return () => clearTimeout(timer);
    }, [ text ]);

    const needle = text.trim().toLowerCase();
    const id = /^\d+$/.test(needle) ? Number(needle) : null;
    const groups: Group[] = [];

    const pages = allPages.filter(page => needle === '' || page.label.toLowerCase().includes(needle));

    // Before anything is typed: the players and rooms opened lately, to go back to.
    const recentShown = needle === '' ? recent.filter(item => (item.kind === 'player' ? me?.canViewPlayers : me?.canViewRooms)) : [];

    if (recentShown.length > 0)
        groups.push({
            label: 'Recent',
            hits: recentShown.map(item => ({
                key: `recent:${item.kind}:${item.id}`,
                icon: item.kind === 'player' ? <UserRound /> : <House />,
                title: item.name,
                subtitle: `${item.kind === 'player' ? 'Player' : 'Room'} #${item.id}`,
                to: `/${item.kind === 'player' ? 'players' : 'rooms'}/${item.id}`,
            })),
        });

    if (pages.length > 0)
        groups.push({ label: 'Pages', hits: pages.map(page => ({ key: `page:${page.to}`, icon: page.icon, title: page.label, shortcut: page.key, to: page.to })) });

    if (id !== null) {
        const byId: Hit[] = [];

        if (me?.canViewRooms)
            byId.push({ key: `room:${id}`, icon: <House />, title: `Room #${id}`, subtitle: 'Open the room with this id', to: `/rooms/${id}` });

        if (me?.canViewPlayers)
            byId.push({ key: `player:${id}`, icon: <UserRound />, title: `Player #${id}`, subtitle: 'Open the player with this id', to: `/players/${id}` });

        if (byId.length > 0)
            groups.push({ label: 'By id', hits: byId });
    }

    for (const group of searching ? search.data?.groups ?? [] : []) {
        const kind = KINDS[group.kind];

        if (!kind)
            continue;

        const hits: Hit[] = group.hits.map(hit => ({
            key: `${group.kind}:${hit.id}`,
            icon: kind.icon,
            title: hit.title,
            subtitle: hit.subtitle ?? undefined,
            to: kind.open(hit),
        }));
        const all = kind.all?.(q);

        if (all && group.total > group.hits.length)
            hits.push({ key: `${group.kind}:all`, icon: <ArrowRight />, title: `All ${group.total.toLocaleString()} ${kind.many} matching "${q}"`, to: all });

        groups.push({ label: kind.label, hits });
    }

    if (needle !== '' && commands.data) {
        const matched = commands.data
            .filter(command => !command.needsRoom && (command.name.includes(needle) || command.aliases.some(alias => alias.includes(needle))))
            .slice(0, PER_GROUP);

        if (matched.length > 0)
            groups.push({
                label: 'Console commands',
                hits: matched.map(command => ({ key: `command:${command.name}`, icon: <SquareTerminal />, title: command.name, subtitle: command.description, to: `/console?${params({ command: command.name })}` })),
            });
    }

    const hits = groups.flatMap(group => group.hits);
    const current = Math.min(active, Math.max(0, hits.length - 1));
    const loading = searching && search.isFetching;

    useEffect(() => {
        list.current?.querySelector('[data-active]')?.scrollIntoView({ block: 'nearest' });
    }, [ current ]);

    const open = (hit: Hit) => {
        navigate(hit.to);
        onClose();
    };

    let index = -1;

    return (
        <dialog
            ref={dialog}
            aria-label="Search"
            onClose={onClose}
            onClick={event => event.target === dialog.current && onClose()}
            className="m-auto mt-[12vh] w-[640px] max-w-[92vw] animate-rise rounded-xl border border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-[rgb(5_8_12/0.6)]"
        >
            <div className="flex items-center gap-3 border-b border-line px-4">
                <Search className="size-4 shrink-0 text-muted" />
                <input
                    autoFocus
                    value={text}
                    onChange={(event) => {
                        setText(event.target.value);
                        setActive(0);
                    }}
                    onKeyDown={(event) => {
                        if (event.key === 'ArrowDown') {
                            event.preventDefault();
                            setActive(Math.min(current + 1, hits.length - 1));
                        } else if (event.key === 'ArrowUp') {
                            event.preventDefault();
                            setActive(Math.max(current - 1, 0));
                        } else if (event.key === 'Enter' && hits[current]) {
                            event.preventDefault();
                            open(hits[current]);
                        }
                    }}
                    placeholder="Search players, rooms, the catalog, gamedata and commands"
                    aria-label="Search players, rooms, the catalog, gamedata and commands"
                    className="h-12 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted sm:text-sm"
                />
                {loading && <span className="font-mono text-xs text-muted">...</span>}
                <kbd className="rounded border border-line px-1.5 font-mono text-[10px] text-muted max-sm:hidden">Esc</kbd>
            </div>
            <div ref={list} className="max-h-[60vh] overflow-y-auto overscroll-contain py-2">
                {hits.length === 0 && (
                    <p className="px-4 py-6 text-center text-sm text-muted">
                        {loading ? 'Searching...' : searching ? 'Nothing found.' : 'Type a name or an id.'}
                    </p>
                )}
                {groups.map(group => (
                    <div key={group.label} className="pb-1">
                        <Label as="div" className="px-4 pt-2 pb-1">{group.label}</Label>
                        {group.hits.map((hit) => {
                            index++;

                            const position = index;

                            return (
                                <button
                                    key={hit.key}
                                    type="button"
                                    data-active={position === current || undefined}
                                    onMouseMove={() => setActive(position)}
                                    onClick={() => open(hit)}
                                    className={cx(
                                        'flex w-full items-center gap-3 px-4 py-2 text-left [&>svg]:size-4 [&>svg]:shrink-0',
                                        position === current ? 'bg-accent-soft [&>svg]:text-accent' : '[&>svg]:text-muted',
                                    )}
                                >
                                    {hit.icon}
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm">{hit.title}</span>
                                        {hit.subtitle && <span className="block truncate text-xs text-muted">{hit.subtitle}</span>}
                                    </span>
                                    {hit.shortcut && (
                                        <span className="flex shrink-0 gap-1 font-mono text-[10px] text-muted max-sm:hidden">
                                            <kbd className="rounded border border-line px-1.5">g</kbd>
                                            <kbd className="rounded border border-line px-1.5">{hit.shortcut}</kbd>
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                ))}
            </div>
            <div className="flex gap-4 border-t border-line px-4 py-2 font-mono text-[11px] text-muted max-sm:hidden">
                <span>↑↓ to move</span>
                <span>Enter to open</span>
                <span>Esc to close</span>
            </div>
        </dialog>
    );
};

/** The search, wherever you are: Ctrl K (Cmd K) opens it, and so does a page header's search button. */
export const CommandPalette = () => {
    const open = usePalette(state => state.open);
    const setOpen = usePalette(state => state.setOpen);

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault();
                setOpen(true);
            }
        };

        window.addEventListener('keydown', onKey);

        return () => window.removeEventListener('keydown', onKey);
    }, [ setOpen ]);

    return open ? <Palette onClose={() => setOpen(false)} /> : null;
};

/** The search's box under the sidebar's logo (on a phone the bottom bar holds the search). */
export const SearchButton = () => {
    const setOpen = usePalette(state => state.setOpen);

    return (
        <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Search everything"
            className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border border-line bg-surface px-2.5 text-left text-[13px] text-muted transition-colors hover:border-muted/50"
        >
            <Search className="size-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate">Search</span>
            <kbd className="rounded border border-line px-1.5 font-mono text-[10px]">Ctrl K</kbd>
        </button>
    );
};

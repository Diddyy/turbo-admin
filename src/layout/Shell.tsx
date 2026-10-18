import { useQueryClient } from '@tanstack/react-query';
import { Keyboard, LayoutGrid, LogOut, Monitor, Moon, Search, Sun } from 'lucide-react';
import { type ReactNode, type RefObject, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';

import { post } from '#/api/client';
import { useLiveUpdates } from '#/api/live';
import { useSession } from '#/auth/session';
import { ConfirmHost } from '#/components/ConfirmHost';
import { useModalDialog } from '#/components/dialog';
import { PageErrorBoundary } from '#/components/PageErrorBoundary';
import { Toasts } from '#/components/Toasts';
import { Segmented } from '#/components/ui';
import { cx } from '#/lib/cx';
import { setTheme, type ThemeChoice, useTheme } from '#/lib/theme';

import { CommandPalette } from './CommandPalette';
import { useDrawer } from './drawer';
import { HotelSheet, HotelStatusCard } from './HotelStatus';
import { type ShownEntry, useIsActive, useNav } from './nav';
import { usePalette, useShortcutsSheet } from './palette';
import { Shortcuts } from './Shortcuts';

const THEMES: { value: ThemeChoice; label: string; icon: ReactNode }[] = [
    { value: 'dark', label: 'Dark', icon: <Moon /> },
    { value: 'light', label: 'Light', icon: <Sun /> },
    { value: 'system', label: 'System', icon: <Monitor /> },
];

const useSignOut = () => {
    const signOut = useSession(state => state.signOut);
    const queryClient = useQueryClient();

    return async () => {
        // Ending the session on the server matters more than its answer: sign out here either way.
        await post('/auth/logout').catch(() => undefined);
        queryClient.clear();
        signOut();
    };
};

/** The small square buttons at the sidebar's foot: the theme, signing out. */
const footButton = 'grid size-8 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-subtle hover:text-ink [&>svg]:size-[18px]';

/** Dark, light or as the system is: the chosen one's icon at the sidebar's foot, the three above it when opened. */
const RailTheme = () => {
    const choice = useTheme();
    const [ open, setOpen ] = useState(false);
    const box = useRef<HTMLDivElement>(null);
    const current = THEMES.find(entry => entry.value === choice) ?? THEMES[0]!;

    useEffect(() => {
        if (!open)
            return;

        const away = (event: MouseEvent) => {
            if (!box.current?.contains(event.target as Node))
                setOpen(false);
        };
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape')
                setOpen(false);
        };

        document.addEventListener('mousedown', away);
        window.addEventListener('keydown', onKey);

        return () => {
            document.removeEventListener('mousedown', away);
            window.removeEventListener('keydown', onKey);
        };
    }, [ open ]);

    return (
        <div ref={box} className="relative">
            <button
                type="button"
                onClick={() => setOpen(!open)}
                title={`Theme: ${current.label.toLowerCase()}`}
                aria-label="Theme"
                aria-expanded={open}
                className={footButton}
            >
                {current.icon}
            </button>
            {open && (
                <div role="radiogroup" aria-label="Theme options" className="absolute right-0 bottom-full z-40 mb-2 flex gap-1 rounded-lg border border-line bg-surface p-1 shadow-xl">
                    {THEMES.map(entry => (
                        <button
                            key={entry.value}
                            type="button"
                            role="radio"
                            aria-checked={entry.value === choice}
                            title={entry.label}
                            aria-label={entry.label}
                            onClick={() => {
                                setTheme(entry.value);
                                setOpen(false);
                            }}
                            className={cx('grid size-9 place-items-center rounded-md [&>svg]:size-4', entry.value === choice ? 'bg-subtle text-accent' : 'text-muted hover:text-ink')}
                        >
                            {entry.icon}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

/** One entry of the sidebar: its icon and name. */
const RailLink = ({ entry, active }: { entry: ShownEntry; active: boolean }) => (
    <Link
        to={entry.to}
        aria-current={active ? 'page' : undefined}
        className={cx(
            'relative flex h-9 items-center gap-3 rounded-lg px-3 text-sm transition-colors [&>svg]:size-[18px] [&>svg]:shrink-0',
            active
                ? 'bg-subtle font-medium text-ink before:absolute before:inset-y-2 before:-left-3 before:w-[3px] before:rounded-r-full before:bg-accent [&>svg]:text-accent'
                : 'text-muted hover:bg-subtle hover:text-ink',
        )}
    >
        {entry.icon}
        <span className="min-w-0 flex-1 truncate">{entry.label}</span>
    </Link>
);

/**
 * From a laptop up: the hotel's state at the top, then the places in their sections down the left
 * (pages alike share one entry and show as tabs on their pages), and at its foot your account, the
 * shortcuts, the theme and signing out.
 */
const Rail = () => {
    const sections = useNav();
    const isActive = useIsActive();
    const player = useSession(state => state.session?.player);
    const signOut = useSignOut();
    const showShortcuts = useShortcutsSheet(state => state.setOpen);

    return (
        <nav aria-label="Main" className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-chrome lg:flex">
            <Link to="/" className="flex h-16 shrink-0 items-center gap-3 px-4">
                <span className="grid size-8 place-items-center rounded-lg bg-accent font-mono text-sm font-bold text-on-accent">T</span>
                <span className="font-mono text-xs font-medium tracking-[0.08em] text-ink uppercase">Turbo Admin</span>
            </Link>
            <HotelStatusCard />
            <div className="no-scrollbar flex flex-1 flex-col gap-3 overflow-y-auto px-3 py-3">
                {sections.map(section => (
                    <div key={section.label ?? 'top'} className="flex flex-col gap-0.5">
                        {section.label && <span className="px-3 pb-1 font-mono text-[10px] font-medium tracking-[0.12em] text-muted/70 uppercase">{section.label}</span>}
                        {section.entries.map(entry => <RailLink key={entry.label} entry={entry} active={isActive(entry)} />)}
                    </div>
                ))}
            </div>
            <div className="flex items-center gap-0.5 border-t border-line px-3 py-3">
                <NavLink
                    to="/account"
                    title="Your account"
                    className={({ isActive: open }) => cx('flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg px-1.5 text-[13px] transition-colors', open ? 'bg-subtle text-ink' : 'text-muted hover:bg-subtle hover:text-ink')}
                >
                    <span className="grid size-6 shrink-0 place-items-center rounded-md bg-warn font-mono text-[10px] font-semibold text-canvas">{player?.name.slice(0, 2).toUpperCase()}</span>
                    <span className="truncate">{player?.name}</span>
                </NavLink>
                <button type="button" onClick={() => showShortcuts(true)} title="Keyboard shortcuts (?)" aria-label="Keyboard shortcuts" className={footButton}>
                    <Keyboard />
                </button>
                <RailTheme />
                <button type="button" onClick={signOut} title="Sign out" aria-label="Sign out" className={cx(footButton, 'hover:text-bad')}>
                    <LogOut />
                </button>
            </div>
        </nav>
    );
};

/** The places a phone's bottom bar keeps in reach, the first four of these the viewer may open. */
const DOCK = [ 'Overview', 'Players', 'Rooms', 'Catalog', 'Hotel view', 'Content', 'Gamedata', 'Logs' ];

const DockItem = ({ to, label, icon, active, onClick }: { to?: string; label: string; icon: ReactNode; active: boolean; onClick?: () => void }) => {
    const body = (
        <>
            <span className={cx('grid h-7 w-12 place-items-center rounded-full transition-colors [&>svg]:size-[21px]', active && 'bg-accent-soft text-accent')}>{icon}</span>
            <span className="max-w-full truncate">{label}</span>
        </>
    );
    const className = cx('flex min-w-0 flex-1 flex-col items-center gap-0.5 pt-2 pb-1.5 text-[11px] font-medium transition-colors', active ? 'text-ink' : 'text-muted');

    return to
        ? <Link to={to} aria-current={active ? 'page' : undefined} className={className}>{body}</Link>
        : <button type="button" onClick={onClick} className={className}>{body}</button>;
};

/**
 * On a phone and a tablet: the bar along the bottom, where a thumb is. The most used places on
 * each side of the search, and the menu, which holds everything (and is marked when the page open
 * is one of those).
 */
const BottomBar = () => {
    const entries = useNav().flatMap(section => section.entries);
    const isActive = useIsActive();
    const menuOpen = useDrawer(state => state.open);
    const openMenu = useDrawer(state => state.setOpen);
    const openSearch = usePalette(state => state.setOpen);
    const docked = DOCK.map(label => entries.find(entry => entry.label === label)).filter(entry => !!entry).slice(0, 3);
    const elsewhere = !docked.some(entry => isActive(entry));

    return (
        <nav aria-label="Main" className="z-30 shrink-0 border-t border-line bg-chrome/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
            <div className="mx-auto flex max-w-xl items-stretch px-1">
                {docked.slice(0, 2).map(entry => <DockItem key={entry.label} to={entry.to} label={entry.label} icon={entry.icon} active={isActive(entry)} />)}
                <div className="flex flex-1 items-start justify-center">
                    <button
                        type="button"
                        onClick={() => openSearch(true)}
                        aria-label="Search everything"
                        className="-mt-4 grid size-13 place-items-center rounded-2xl bg-accent text-on-accent shadow-[0_8px_20px_-6px] shadow-accent/60 ring-4 ring-canvas transition active:scale-95 [&>svg]:size-6"
                    >
                        <Search />
                    </button>
                </div>
                {docked.slice(2).map(entry => <DockItem key={entry.label} to={entry.to} label={entry.label} icon={entry.icon} active={isActive(entry)} />)}
                <DockItem label="Menu" icon={<LayoutGrid />} active={menuOpen || elsewhere} onClick={() => openMenu(true)} />
            </div>
        </nav>
    );
};

/**
 * On a phone and a tablet, everything: every place as a tile in its section, the one open now
 * marked, then your account, the theme and signing out. A sheet from the bottom that closes when a
 * place is picked, on a tap outside it, and on Escape.
 */
const MenuSheet = () => {
    const sections = useNav();
    const isActive = useIsActive();
    const choice = useTheme();
    const signOut = useSignOut();
    const player = useSession(state => state.session?.player);
    const open = useDrawer(state => state.open);
    const setOpen = useDrawer(state => state.setOpen);
    const close = () => setOpen(false);
    const dialog = useModalDialog(open, close);

    return (
        <dialog
            {...dialog}
            aria-label="Menu"
            className="mx-0 mt-auto mb-0 max-h-[88dvh] w-full max-w-none animate-sheet overflow-y-auto rounded-t-3xl border border-line bg-chrome p-0 text-ink shadow-2xl sm:mx-auto sm:max-w-xl lg:hidden"
        >
            {open && (
                <div className="flex flex-col gap-5 px-4 pt-2 pb-[calc(1rem+env(safe-area-inset-bottom))]">
                    <div aria-hidden className="mx-auto h-1 w-10 rounded-full bg-line" />
                    {sections.map(section => (
                        <section key={section.label ?? 'top'} aria-label={section.label ?? 'Overview'}>
                            {section.label && <h2 className="mb-2 px-1 font-mono text-[10px] font-medium tracking-[0.12em] text-muted uppercase">{section.label}</h2>}
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                {section.entries.map((entry) => {
                                    const active = isActive(entry);

                                    return (
                                        <Link
                                            key={entry.label}
                                            to={entry.to}
                                            onClick={close}
                                            aria-current={active ? 'page' : undefined}
                                            className={cx(
                                                'flex min-h-[4.5rem] flex-col justify-between gap-2 rounded-2xl border p-3 transition active:scale-[0.98] [&>svg]:size-5',
                                                active ? 'border-accent/50 bg-accent-soft text-accent' : 'border-line bg-surface text-ink hover:border-muted/50',
                                            )}
                                        >
                                            {entry.icon}
                                            <span className="min-w-0">
                                                <span className="block truncate text-sm font-medium">{entry.label}</span>
                                                <span className={cx('block truncate text-[11px]', active ? 'text-accent/80' : 'text-muted')}>{entry.hint}</span>
                                            </span>
                                        </Link>
                                    );
                                })}
                            </div>
                        </section>
                    ))}
                    <div className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-2">
                        <Link to="/account" onClick={close} className="flex min-h-12 items-center gap-3 rounded-xl px-2 hover:bg-subtle">
                            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-warn font-mono text-[11px] font-semibold text-canvas">{player?.name.slice(0, 2).toUpperCase()}</span>
                            <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium">{player?.name}</span>
                                <span className="block text-[11px] text-muted">Your account and passkeys</span>
                            </span>
                        </Link>
                        <div className="px-1">
                            <Segmented label="Theme" value={choice} onChange={value => setTheme(value as ThemeChoice)} options={THEMES.map(x => ({ value: x.value, label: x.label }))} />
                        </div>
                        <button type="button" onClick={signOut} className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-[15px] text-bad hover:bg-bad-soft [&>svg]:size-5">
                            <LogOut />
                            Sign out
                        </button>
                    </div>
                </div>
            )}
        </dialog>
    );
};

/** A new page starts at its top, with the menu closed; tabs kept in the address (its search) keep the place. */
const useFreshPage = (root: RefObject<HTMLElement | null>) => {
    const { pathname } = useLocation();
    const setMenu = useDrawer(state => state.setOpen);

    useLayoutEffect(() => {
        root.current?.scrollTo({ top: 0 });
        window.scrollTo({ top: 0 });
        setMenu(false);
    }, [ pathname, root, setMenu ]);
};

/**
 * The frame every signed-in page sits in, and the live stream that keeps them current. From a
 * laptop up the window scrolls beside the sidebar; on a phone the page scrolls between its header
 * and the bottom bar, so what sticks to a page's foot (a save bar) stays above the bar.
 */
export const Shell = () => {
    useLiveUpdates();
    const main = useRef<HTMLElement>(null);
    const { pathname } = useLocation();

    useFreshPage(main);

    return (
        <div className="flex min-h-dvh max-lg:h-dvh max-lg:flex-col max-lg:overflow-hidden">
            <Rail />
            <CommandPalette />
            <Shortcuts />
            <MenuSheet />
            <HotelSheet />
            <ConfirmHost />
            <Toasts />
            <main ref={main} data-scroll-root className="flex min-h-0 min-w-0 flex-1 flex-col pb-8 max-lg:overflow-y-auto max-lg:overscroll-contain lg:pb-10">
                <PageErrorBoundary key={pathname}>
                    <Outlet />
                </PageErrorBoundary>
            </main>
            <BottomBar />
        </div>
    );
};

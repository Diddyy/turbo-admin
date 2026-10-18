import { useQueryClient } from '@tanstack/react-query';
import { Keyboard, LogOut, Monitor, Moon, Sun } from 'lucide-react';
import { type ReactNode, type RefObject, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';

import { post } from '#/api/client';
import { useLiveUpdates } from '#/api/live';
import { useSession } from '#/auth/session';
import { ConfirmHost } from '#/components/ConfirmHost';
import { useModalDialog } from '#/components/dialog';
import { Logo } from '#/components/Logo';
import { PageErrorBoundary } from '#/components/PageErrorBoundary';
import { Toasts } from '#/components/Toasts';
import { cx } from '#/lib/cx';
import { setTheme, type ThemeChoice, useTheme } from '#/lib/theme';

import { CommandPalette, SearchButton } from './CommandPalette';
import { useDrawer } from './drawer';
import { HotelSheet, HotelStatusCard } from './HotelStatus';
import { type ShownEntry, useIsActive, useNav } from './nav';
import { NotificationsBell } from './NotificationsBell';
import { useShortcutsSheet } from './palette';
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
const RailLink = ({ entry, active, onPick }: { entry: ShownEntry; active: boolean; onPick?: () => void }) => (
    <Link
        to={entry.to}
        onClick={onPick}
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
 * What the sidebar holds, at a laptop's left and in a phone's menu alike: the logo, the search and
 * the bell under it, the hotel's state, then the places in their sections (pages alike share one
 * entry and show as tabs on their pages), and at its foot your account, the shortcuts, the theme
 * and signing out. In the menu, `onPick` closes it on any place picked; the bell and the shortcuts
 * stay out of it (the phone's header has the bell, and a phone has no keyboard).
 */
const RailBody = ({ onPick }: { onPick?: () => void }) => {
    const sections = useNav();
    const isActive = useIsActive();
    const player = useSession(state => state.session?.player);
    const signOut = useSignOut();
    const showShortcuts = useShortcutsSheet(state => state.setOpen);
    const inMenu = onPick !== undefined;

    return (
        <>
            <Link to="/" onClick={onPick} aria-label="Turbo Admin, overview" className="flex h-16 shrink-0 items-center px-4">
                <Logo />
            </Link>
            <div className="flex shrink-0 items-center gap-1.5 px-3 pb-3">
                <SearchButton onOpen={onPick} />
                {!inMenu && <NotificationsBell align="start" />}
            </div>
            <HotelStatusCard />
            <div className="no-scrollbar flex flex-1 flex-col gap-3 overflow-y-auto px-3 py-3">
                {sections.map(section => (
                    <div key={section.label ?? 'top'} className="flex flex-col gap-0.5">
                        {section.label && <span className="px-3 pb-1 font-mono text-[10px] font-medium tracking-[0.12em] text-muted/70 uppercase">{section.label}</span>}
                        {section.entries.map(entry => <RailLink key={entry.label} entry={entry} active={isActive(entry)} onPick={onPick} />)}
                    </div>
                ))}
            </div>
            <div className="flex items-center gap-0.5 border-t border-line px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <NavLink
                    to="/account"
                    onClick={onPick}
                    title="Your account"
                    className={({ isActive: open }) => cx('flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg px-1.5 text-[13px] transition-colors', open ? 'bg-subtle text-ink' : 'text-muted hover:bg-subtle hover:text-ink')}
                >
                    <span className="grid size-6 shrink-0 place-items-center rounded-md bg-warn font-mono text-[10px] font-semibold text-canvas">{player?.name.slice(0, 2).toUpperCase()}</span>
                    <span className="truncate">{player?.name}</span>
                </NavLink>
                {!inMenu && (
                    <button type="button" onClick={() => showShortcuts(true)} title="Keyboard shortcuts (?)" aria-label="Keyboard shortcuts" className={footButton}>
                        <Keyboard />
                    </button>
                )}
                <RailTheme />
                <button type="button" onClick={signOut} title="Sign out" aria-label="Sign out" className={cx(footButton, 'hover:text-bad')}>
                    <LogOut />
                </button>
            </div>
        </>
    );
};

/** From a laptop up: the sidebar down the window's left. */
const Rail = () => (
    <nav aria-label="Main" className="sticky top-0 z-30 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-chrome lg:flex">
        <RailBody />
    </nav>
);

/**
 * On a phone and a tablet: the same sidebar, sliding in from the left when the header's menu
 * button is pressed. It closes when a place is picked, on a tap outside it, and on Escape.
 */
const MenuDrawer = () => {
    const open = useDrawer(state => state.open);
    const setOpen = useDrawer(state => state.setOpen);
    const close = () => setOpen(false);
    const dialog = useModalDialog(open, close);

    return (
        <dialog
            {...dialog}
            aria-label="Menu"
            className="m-0 h-dvh max-h-none w-72 max-w-[85vw] animate-drawer border-r border-line bg-chrome p-0 text-ink shadow-2xl lg:hidden"
        >
            {open && (
                <nav aria-label="Main" className="flex h-full flex-col pt-[env(safe-area-inset-top)]">
                    <RailBody onPick={close} />
                </nav>
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
 * laptop up the window scrolls beside the sidebar; on a phone the page scrolls under its header,
 * and the sidebar is a menu that slides in from the left.
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
            <MenuDrawer />
            <HotelSheet />
            <ConfirmHost />
            <Toasts />
            <main ref={main} data-scroll-root className="flex min-h-0 min-w-0 flex-1 flex-col pb-[calc(2rem+env(safe-area-inset-bottom))] max-lg:overflow-y-auto max-lg:overscroll-contain lg:pb-10">
                <PageErrorBoundary key={pathname}>
                    <Outlet />
                </PageErrorBoundary>
            </main>
        </div>
    );
};

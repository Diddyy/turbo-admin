import { Keyboard } from 'lucide-react';
import { type ReactNode, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';

import { Label } from '#/components/ui';

import { usePages } from './nav';
import { usePalette, useShortcutsSheet } from './palette';

/** What keys do beyond going to a page. */
const ELSEWHERE: { keys: string[]; label: string }[] = [
    { keys: [ 'Ctrl', 'K' ], label: 'Search pages, players, rooms, the catalog and gamedata' },
    { keys: [ '/' ], label: 'Search, too' },
    { keys: [ '←', '→' ], label: 'The tab before or after, with a tab picked' },
    { keys: [ '↑', '↓' ], label: 'Lines typed before (Console)' },
    { keys: [ 'Esc' ], label: 'Close a dialog, a menu or the search' },
    { keys: [ '?' ], label: 'These shortcuts' },
];

/** Keys typed into a field are the field's, never a shortcut. */
const typing = (target: EventTarget | null) => {
    const element = target as HTMLElement | null;

    return !!element && (element.isContentEditable || [ 'INPUT', 'TEXTAREA', 'SELECT' ].includes(element.tagName));
};

export const Key = ({ children }: { children: ReactNode }) => (
    <kbd className="inline-grid min-w-6 place-items-center rounded-md border border-line bg-subtle px-1.5 py-0.5 font-mono text-[11px] font-semibold text-ink shadow-[0_1px_0_var(--color-line)]">{children}</kbd>
);

const Sheet = ({ onClose }: { onClose: () => void }) => {
    const dialog = useRef<HTMLDialogElement>(null);
    const pages = usePages();

    useEffect(() => {
        dialog.current?.showModal();
    }, []);

    return (
        <dialog
            ref={dialog}
            aria-labelledby="shortcuts-title"
            onClose={onClose}
            onClick={event => event.target === dialog.current && onClose()}
            className="m-auto w-[720px] max-w-[92vw] animate-rise rounded-xl border border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-[rgb(5_8_12/0.6)]"
        >
            <header className="flex items-center gap-2 border-b border-line px-5 py-4">
                <Keyboard className="size-5 text-accent" />
                <div className="min-w-0 flex-1">
                    <h2 id="shortcuts-title" className="text-sm font-semibold">Keyboard shortcuts</h2>
                    <p className="text-xs text-muted">Press ? on any page to see these again.</p>
                </div>
                <Key>Esc</Key>
            </header>
            <div className="grid max-h-[70vh] grid-cols-1 gap-6 overflow-y-auto p-5 sm:grid-cols-2">
                <section className="flex flex-col gap-0.5">
                    <Label as="h3" className="mb-1">Go to</Label>
                    {pages.map(page => (
                        <div key={page.key} className="flex items-center justify-between gap-3 rounded-md px-2 py-1 text-sm hover:bg-subtle">
                            <span className="flex items-center gap-2 [&>svg]:size-4 [&>svg]:text-muted">
                                {page.icon}
                                {page.label}
                            </span>
                            <span className="flex items-center gap-1">
                                <Key>g</Key>
                                <Key>{page.key}</Key>
                            </span>
                        </div>
                    ))}
                </section>
                <section className="flex flex-col gap-0.5">
                    <Label as="h3" className="mb-1">Anywhere</Label>
                    {ELSEWHERE.map(entry => (
                        <div key={entry.label} className="flex items-center justify-between gap-3 rounded-md px-2 py-1 text-sm hover:bg-subtle">
                            <span>{entry.label}</span>
                            <span className="flex shrink-0 items-center gap-1">
                                {entry.keys.map(key => <Key key={key}>{key}</Key>)}
                            </span>
                        </div>
                    ))}
                </section>
            </div>
        </dialog>
    );
};

/**
 * Keyboard shortcuts across the panel, as nitro-studio has them: `g` then a letter goes to a page
 * (`g p` Players, `g r` Rooms ...), `/` opens the search, and `?` shows them all. Keys typed into
 * a field are the field's, and none is heard while a dialog is open.
 */
export const Shortcuts = () => {
    const navigate = useNavigate();
    const pages = usePages();
    const open = useShortcutsSheet(state => state.open);
    const setOpen = useShortcutsSheet(state => state.setOpen);
    const openSearch = usePalette(state => state.setOpen);
    // `g` pressed and waiting for its letter, for a second.
    const pendingGo = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.ctrlKey || event.metaKey || event.altKey || typing(event.target) || document.querySelector('dialog[open]'))
                return;

            if (pendingGo.current) {
                clearTimeout(pendingGo.current);
                pendingGo.current = null;

                const page = pages.find(entry => entry.key === event.key.toLowerCase());

                if (page) {
                    event.preventDefault();
                    navigate(page.to);
                }

                return;
            }

            if (event.key === '?') {
                event.preventDefault();
                setOpen(true);
            } else if (event.key === '/') {
                event.preventDefault();
                openSearch(true);
            } else if (event.key === 'g') {
                pendingGo.current = setTimeout(() => (pendingGo.current = null), 1000);
            }
        };

        window.addEventListener('keydown', onKey);

        return () => window.removeEventListener('keydown', onKey);
    }, [ navigate, pages, setOpen, openSearch ]);

    return open ? <Sheet onClose={() => setOpen(false)} /> : null;
};

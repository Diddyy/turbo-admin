import { X } from 'lucide-react';
import type { ReactNode } from 'react';

import { cx } from '#/lib/cx';

import { useModalDialog } from './dialog';

/**
 * A wide dialog over the page, for picking from many or editing one thing at length: on a phone
 * it fills the screen, with its title and a close button along the top. On a bigger screen the
 * dialog covers the window and the card in it grows as tall as it needs, so the scrollbar at the
 * window's edge scrolls the card (the page behind stays put). `className` sizes the card.
 */
export const Modal = ({ title, open, onClose, children, className }: { title: ReactNode; open: boolean; onClose: () => void; children: ReactNode; className?: string }) => {
    const dialog = useModalDialog(open, onClose);

    return (
        <dialog
            {...dialog}
            className="m-0 h-dvh max-h-none w-full max-w-none overflow-y-auto overscroll-contain border-0 bg-surface p-0 text-ink sm:bg-transparent sm:px-6 sm:py-[6dvh]"
        >
            {open && (
                <div
                    className={cx(
                        'flex h-full animate-rise flex-col overflow-clip bg-surface sm:mx-auto sm:h-auto sm:max-w-3xl sm:rounded-2xl sm:border sm:border-line sm:shadow-2xl',
                        className,
                    )}
                >
                    <div className="flex items-center justify-between gap-3 border-b border-line bg-surface px-5 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 sm:sticky sm:top-0 sm:z-20">
                        <h2 className="min-w-0 truncate text-sm font-semibold">{title}</h2>
                        <button type="button" onClick={onClose} aria-label="Close" className="grid size-11 shrink-0 place-items-center rounded-lg text-muted hover:bg-subtle hover:text-ink sm:size-9">
                            <X className="size-4" />
                        </button>
                    </div>
                    {/* On a bigger screen this does not scroll itself, so what sticks in it sticks to the window. */}
                    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-[env(safe-area-inset-bottom)] sm:overflow-visible">{children}</div>
                </div>
            )}
        </dialog>
    );
};

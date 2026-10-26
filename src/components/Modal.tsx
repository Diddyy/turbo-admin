import { X } from 'lucide-react';
import type { ReactNode } from 'react';

import { cx } from '#/lib/cx';

import type { Question } from './confirm';
import { closeOrAsk, useModalDialog } from './dialog';

/**
 * A wide dialog over the page, for picking from many or editing one thing at length: on a phone
 * it fills the screen, with its title and a close button along the top. On a bigger screen the
 * dialog covers the window and the card in it grows as tall as it needs, so the scrollbar at the
 * window's edge scrolls the card (the page behind stays put). `className` sizes the card. With
 * `leave` (an editor with unsaved changes), closing it asks that question first.
 */
export const Modal = ({ title, open, onClose, children, className, leave }: { title: ReactNode; open: boolean; onClose: () => void; children: ReactNode; className?: string; leave?: Question | null }) => {
    const dialog = useModalDialog(open, onClose, leave);

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
                    <div className="flex items-center justify-between gap-3 border-b border-line bg-surface px-5 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
                        <h2 className="min-w-0 truncate text-sm font-semibold">{title}</h2>
                        <button type="button" onClick={() => closeOrAsk(onClose, leave)} aria-label="Close" className="grid size-10 shrink-0 place-items-center rounded-lg text-muted hover:bg-subtle hover:text-ink sm:size-8">
                            <X className="size-4" />
                        </button>
                    </div>
                    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-[env(safe-area-inset-bottom)] sm:overflow-visible">{children}</div>
                </div>
            )}
        </dialog>
    );
};

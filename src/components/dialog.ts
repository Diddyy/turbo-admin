import { type MouseEvent, type SyntheticEvent, useEffect, useRef } from 'react';

import { ask, type Question } from './confirm';

/**
 * The browser's own modal dialog, opened and closed as `open` says: focus stays in it, Escape
 * closes it, and so does a click on the dim around it. What every dialog in the panel (a sheet, a
 * wide picker, a question) is built on. Spread the result on a `<dialog>`.
 *
 * With `leave`, closing it would lose something (an editor's unsaved changes): Escape and the dim
 * ask that question first and close it only when the viewer goes ahead.
 */
export const useModalDialog = (open: boolean, onClose: () => void, leave?: Question | null) => {
    const ref = useRef<HTMLDialogElement>(null);

    useEffect(() => {
        const dialog = ref.current;

        if (!dialog)
            return;

        if (open && !dialog.open)
            dialog.showModal();
        else if (!open && dialog.open)
            dialog.close();
    }, [ open ]);

    // Asked once the key that closed it is done with: asked at once, the same Escape would close
    // the question it opens.
    const askLater = (question: Question) => setTimeout(() => ask(question, onClose));

    return {
        ref,
        onClose: () => {
            // A browser closes a dialog on Escape without a cancel it lets be held when nothing was
            // clicked since the last: shown again, it is asked about as any other close.
            if (open && leave && ref.current && !ref.current.open) {
                ref.current.showModal();
                askLater(leave);

                return;
            }

            onClose();
        },
        onCancel: (event: SyntheticEvent<HTMLDialogElement>) => {
            if (!leave)
                return;

            event.preventDefault();
            askLater(leave);
        },
        onClick: (event: MouseEvent<HTMLDialogElement>) => {
            if (event.target === ref.current)
                closeOrAsk(onClose, leave);
        },
    };
};

/** Closes, or first asks `leave` when there is one. */
export const closeOrAsk = (onClose: () => void, leave?: Question | null) => (leave ? ask(leave, onClose) : onClose());

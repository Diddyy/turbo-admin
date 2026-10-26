import { useRef, useState } from 'react';

/** Consecutive changes of one group (a number typed digit by digit, a colour dragged in the picker, a drag) within this are one step back. */
const GROUP_MS = 1500;

export interface OpsHistory {
    /** The ops changed to `next`: a step back, or part of the last one when it is of the same `group`. */
    change: (next: unknown[], group?: string) => void;
    undo: () => void;
    redo: () => void;
    canUndo: boolean;
    canRedo: boolean;
}

/** Undo and redo over a list of ops, `apply` making a list the current one. */
export const useOpsHistory = (ops: readonly unknown[], apply: (ops: unknown[]) => void): OpsHistory => {
    const [ steps, setSteps ] = useState<{ past: unknown[][]; future: unknown[][] }>({ past: [], future: [] });
    const last = useRef<{ group: string; at: number } | null>(null);

    return {
        change: (next, group) => {
            const now = Date.now();
            const joined = !!group && !!last.current && (last.current.group === group) && (now - last.current.at < GROUP_MS);

            last.current = group ? { group, at: now } : null;
            setSteps(was => ({ past: joined ? was.past : [ ...was.past, [ ...ops ] ], future: [] }));
            apply(next);
        },
        undo: () => {
            const previous = steps.past.at(-1);

            if (!previous) return;

            last.current = null;
            setSteps({ past: steps.past.slice(0, -1), future: [ ...steps.future, [ ...ops ] ] });
            apply(previous);
        },
        redo: () => {
            const next = steps.future.at(-1);

            if (!next) return;

            last.current = null;
            setSteps({ past: [ ...steps.past, [ ...ops ] ], future: steps.future.slice(0, -1) });
            apply(next);
        },
        canUndo: steps.past.length > 0,
        canRedo: steps.future.length > 0,
    };
};

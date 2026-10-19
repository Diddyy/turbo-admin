import { useState } from 'react';

const STORAGE_KEY = 'turbo-admin-catalog-tree-width';

/** How wide the page tree starts, and how narrow and wide it can be made, in pixels. */
export const TREE_WIDTH = { start: 336, min: 256, max: 576 };

const clamp = (width: number) => Math.round(Math.min(Math.max(width, TREE_WIDTH.min), TREE_WIDTH.max));

const load = () => {
    try {
        const saved = Number(localStorage.getItem(STORAGE_KEY));

        return saved ? clamp(saved) : TREE_WIDTH.start;
    } catch {
        return TREE_WIDTH.start;
    }
};

const save = (width: number) => {
    try {
        localStorage.setItem(STORAGE_KEY, String(width));
    } catch {
        // Storage blocked: kept for this visit only.
    }
};

/** The page tree's width, kept in this browser between visits. */
export const useTreeWidth = () => {
    const [ width, setWidth ] = useState(load);

    const set = (next: number) => {
        const clamped = clamp(next);

        setWidth(clamped);
        save(clamped);
    };

    return [ width, set ] as const;
};

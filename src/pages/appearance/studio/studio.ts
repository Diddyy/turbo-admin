import { createContext, useContext, useRef, useState } from 'react';

import type { DataWindowFile } from '#/api/dataWindows';
import type { PluginStyle } from '#/api/noCode';
import type { TemplateIndex } from '#/api/windows';
import type { DesignElementValues, DesignPathStep, DesignRects } from '#/preview/DesignPreview';

/**
 * A theme's unsaved changes in the studio, by what they change: nothing is written until Save, and
 * the preview draws them all as they are made.
 */
export interface StudioDraft {
    /** Per template (a window's, or a part's drawn inside windows), the ops of the theme's patch on it in place of its saved ones. */
    patches: Record<string, unknown[]>;
    /** Per style property, the value typed; null puts it back to the theme's default. */
    styles: Record<string, string | null>;
    /** Per text key, the text windows show. */
    texts: Record<string, string>;
    /** Per library bitmap (`asset.overlays` key), the address of the art uploaded into the theme for it; null gives the library's own back. */
    overlays: Record<string, string | null>;
    /** Per window of the theme's own (defined as data, by its name), its file in place of the saved one; null deletes it on Save. */
    windows: Record<string, DataWindowFile | null>;
}

export const EMPTY_DRAFT: StudioDraft = { patches: {}, styles: {}, texts: {}, overlays: {}, windows: {} };

/** How many things a draft changes: a template's patch, a style, a text, a bitmap, a window each count once. */
export const draftCount = (draft: StudioDraft) => Object.keys(draft.patches).length + Object.keys(draft.styles).length + Object.keys(draft.texts).length + Object.keys(draft.overlays).length + Object.keys(draft.windows).length;

/** Consecutive changes of one group (a colour dragged in the picker, a number typed digit by digit, a drag) within this are one step back. */
const GROUP_MS = 1500;

export interface DraftHistory {
    draft: StudioDraft;
    /** The draft changed to `next`: a step back, or part of the last one when it is of the same `group`. */
    change: (next: StudioDraft, group?: string) => void;
    undo: () => void;
    redo: () => void;
    /** Nothing unsaved again (after Save, or Discard). */
    clear: () => void;
    canUndo: boolean;
    canRedo: boolean;
}

/** The studio's draft with undo and redo over every change, whichever window, style or text it is of. */
export const useDraftHistory = (): DraftHistory => {
    const [ state, setState ] = useState<{ draft: StudioDraft; past: StudioDraft[]; future: StudioDraft[] }>({ draft: EMPTY_DRAFT, past: [], future: [] });
    const last = useRef<{ group: string; at: number } | null>(null);

    return {
        draft: state.draft,
        change: (next, group) => {
            const now = Date.now();
            const joined = !!group && !!last.current && (last.current.group === group) && (now - last.current.at < GROUP_MS);

            last.current = group ? { group, at: now } : null;
            setState(was => ({ draft: next, past: joined ? was.past : [ ...was.past, was.draft ], future: [] }));
        },
        undo: () => {
            last.current = null;
            setState(was => (was.past.length ? { draft: was.past.at(-1)!, past: was.past.slice(0, -1), future: [ ...was.future, was.draft ] } : was));
        },
        redo: () => {
            last.current = null;
            setState(was => (was.future.length ? { draft: was.future.at(-1)!, past: [ ...was.past, was.draft ], future: was.future.slice(0, -1) } : was));
        },
        clear: () => {
            last.current = null;
            setState({ draft: EMPTY_DRAFT, past: [], future: [] });
        },
        canUndo: state.past.length > 0,
        canRedo: state.future.length > 0,
    };
};

/** The element picked in the preview: the window it was picked in, and the template it belongs to (a part's, drawn inside the window). */
export interface StudioSelection {
    window: string;
    /** The template a patch on the element is on: the window's own, or the part's that drew it. */
    template: string;
    /** Null for an element no key reaches (one the window's code made). */
    key: string | null;
    tag: string;
    name: string | null;
    /** What it is drawn with, its patches applied (the client's own element). */
    element?: DesignElementValues;
    /** From the window's root down to it, each step's template and key. */
    path?: DesignPathStep[];
    /** Its style and caption as the client draws it, and the text it shows for each `${key}` of the caption. */
    style?: string | null;
    caption?: string | null;
    texts?: Record<string, string>;
}

/**
 * What the studio gives the editors beside its preview (the inspector, Theme settings, Changes):
 * the theme edited, the window and element picked, and the draft to read and change. Every change
 * is unsaved until the top bar's Save, undone with its Undo, and drawn in the preview at once.
 */
export interface Studio {
    /** The theme being edited: where Save writes. */
    theme: string;
    themeName: string;
    /** A theme's own files (its defaults), not the hotel's values of them. */
    intoTheme: boolean;
    canManage: boolean;
    /** The window shown; null before one is picked. */
    window: string | null;
    /**
     * The client's template index with the theme's own windows (defined as data, the draft's included) in it:
     * what an editor reads a window's element tree from, rather than the index query, which has only the game's.
     */
    index: TemplateIndex | undefined;
    selection: StudioSelection | null;
    select: (selection: StudioSelection | null) => void;
    /** The theme's ops on a template, the draft's when it changed them. */
    ops: (template: string) => readonly unknown[];
    /** Undefined drops the draft's ops (the saved ones again); an empty list takes the theme's patch on the template away on Save. */
    changeOps: (template: string, next: unknown[] | undefined, group?: string) => void;
    /** Several templates' ops changed at once (an edit of a window and a part drawn in it): one step back. */
    changeManyOps: (next: Record<string, unknown[]>, group?: string) => void;
    /** The theme's style properties, as saved. */
    styles: readonly PluginStyle[];
    /** A style's value: the draft's (null: back to its default) or the saved one. */
    style: (name: string) => string | null;
    /** Undefined drops the draft's value (the saved one again); null resets it to the default on Save. */
    setStyle: (name: string, value: string | null | undefined, group?: string) => void;
    /** A text's draft value; undefined when the draft leaves it. */
    text: (key: string) => string | undefined;
    setText: (key: string, value: string | undefined, group?: string) => void;
    /** A library bitmap's draft art (its `asset.overlays` address, null: the library's own again); undefined when the draft leaves it. */
    overlay: (key: string) => string | null | undefined;
    setOverlay: (key: string, url: string | null | undefined, group?: string) => void;
    /** Where the picked element is drawn in the preview, each time it moves. */
    rects: DesignRects | null;
    /** Picks the element at a point of the preview (its own pixels), as a press there would. */
    pick: (x: number, y: number) => void;
}

export const StudioContext = createContext<Studio | null>(null);

/** The studio around an editor; only inside the Theme studio page. */
export const useStudio = (): Studio => {
    const studio = useContext(StudioContext);

    if (!studio) throw new Error('useStudio is only for the Theme studio page.');

    return studio;
};

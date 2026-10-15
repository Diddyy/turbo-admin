import { create } from 'zustand';

/**
 * A client config dropped on the upload, waiting for the Variables tab's import to take it: the
 * import is where a config is looked at before it changes anything.
 */
export const useConfigHandoff = create<{ json: string | null; give: (json: string) => void; take: () => string | null }>((set, get) => ({
    json: null,
    give: json => set({ json }),
    take: () => {
        const { json } = get();

        set({ json: null });

        return json;
    },
}));

/**
 * A config as the import takes it, a JSON object: as it is when it is one already, or built from
 * `key=value` lines (the external variables' text form), each value a text.
 */
export const configJson = (text: string) => {
    // A byte order mark (U+FEFF) a file may open with is not part of the config.
    const trimmed = (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text).trim();

    if (trimmed.startsWith('{'))
        return trimmed;

    const entries = trimmed
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#') && line.includes('='))
        .map(line => [ line.slice(0, line.indexOf('=')).trim(), line.slice(line.indexOf('=') + 1).trim() ]);

    return JSON.stringify(Object.fromEntries(entries), null, 4);
};

import type { TemplateIndex, WindowElement } from '#/api/windows';

/**
 * Why a patch no longer fits the client the hotel runs: its window or an element it names is gone
 * from the client's `template-index.json` (a client update renamed or took it out). Found here,
 * before players' clients report it unmatched.
 */
export interface OutdatedReason {
    /** The element key, or null for the window itself. */
    element: string | null;
    text: string;
}

const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

/** Every element of a tree, depth first. */
const flat = (elements: readonly WindowElement[]): WindowElement[] => elements.flatMap(element => [ element, ...flat(element.children ?? []) ]);

/** Whether one part of a key (`name`, `#tag`, `@n`) finds an element in `scope` (its children for `@n`, its descendants otherwise). */
const step = (scope: readonly WindowElement[], part: string, parent: WindowElement | null): WindowElement | undefined => {
    if (/^@\d+$/.test(part)) {
        const children = parent ? parent.children ?? [] : scope[0]?.children ?? [];

        return children[Number(part.slice(1))];
    }

    const below = flat(parent ? parent.children ?? [] : scope);

    if (part.startsWith('#')) return below.find(element => element.tags?.some(tag => tag === part || `#${tag}` === part));

    return below.find(element => element.name === part);
};

/** Whether a key (docs/template-patches.md: `''`, `name`, `a/b`, `#tag`, `@n`) finds an element of the window. */
export const findsElement = (elements: readonly WindowElement[], key: string) => {
    if (key === '') return true;

    if (flat(elements).some(element => element.key === key)) return true;

    let parent: WindowElement | null = null;

    for (const part of key.split('/')) {
        const found = step(elements, part, parent);

        if (!found) return false;

        parent = found;
    }

    return true;
};

/** The names a patch's own `insert` / `wrap` ops add, which its later ops may name. */
const addedNames = (ops: readonly unknown[]) => new Set(ops.flatMap(op => (isObject(op) ? [ op.add, op.wrap ] : []).flatMap(made => (isObject(made) && typeof made.name === 'string' ? [ made.name ] : []))));

/**
 * What of a patch is gone from the client's template index: none for a patch that still fits, and
 * none for a frame id (a window Nitro draws itself has no elements to name).
 */
export const outdatedReasons = (index: TemplateIndex, template: string, ops: unknown): OutdatedReason[] => {
    if (index.frames[template]) return [];

    const window = index.templates[template];

    if (!window) return [ { element: null, text: `The window ${template} is not in this client: a client update renamed or removed it.` } ];

    const list = Array.isArray(ops) ? ops : [];
    const added = addedNames(list);
    const reasons: OutdatedReason[] = [];
    const named = list.flatMap(op => (isObject(op) ? [ op.element, op.to ] : [])).filter((key): key is string => typeof key === 'string');

    for (const key of [ ...new Set(named) ]) {
        if (findsElement(window.elements, key) || key.split('/').some(part => added.has(part))) continue;

        reasons.push({ element: key, text: `The element '${key}' is not in ${template} any more.` });
    }

    return reasons;
};

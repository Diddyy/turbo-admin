import { type TemplateIndex, type WindowElement, windowOf } from '#/api/windows';

/** Every keyed ancestor of the element `key` in a template's tree, the window first, the element last. */
export const ancestorsOf = (elements: readonly WindowElement[], key: string): WindowElement[] => {
    const visit = (list: readonly WindowElement[], trail: WindowElement[]): WindowElement[] | null => {
        for (const element of list) {
            const next = element.key !== undefined ? [ ...trail, element ] : trail;

            if (element.key === key) return next;

            const found = element.children ? visit(element.children, next) : null;

            if (found) return found;
        }

        return null;
    };

    return visit(elements, []) ?? [];
};

/** The element `key` names in a template, as the template index has it. */
export const elementOf = (index: TemplateIndex | undefined, template: string, key: string): WindowElement | undefined => {
    const found = index ? windowOf(index, template) : undefined;

    return found ? ancestorsOf(found.elements, key).at(-1) : undefined;
};

/** The text keys an element shows: its caption's `${key}`s and the keys its variables show. */
export const textKeysOf = (caption: string | null | undefined, element: WindowElement | undefined): string[] => {
    const keys = new Set<string>();

    for (const match of (caption ?? element?.caption ?? '').matchAll(/\$\{([^}]+)\}/g)) keys.add(match[1]!);

    for (const key of element?.texts ?? []) keys.add(key);

    return [ ...keys ];
};

/** Whether an element draws a picture a `bind` op's `asset` changes. */
export const isPicture = (tag: string) => /bitmap|image|icon/.test(tag);

/** Whether an element draws text a face can be picked for. */
export const isText = (tag: string, caption: string | null | undefined) => /text|label|button|link|caption|tab/.test(tag) || !!caption;

const isObject = (value: unknown): value is Record<string, unknown> => (typeof value === 'object') && (value !== null) && !Array.isArray(value);

/** Whether `op` only binds the element `key` names: the op a picture picked goes into. */
const isBindOf = (op: unknown, key: string): op is { element: string; bind: Record<string, unknown>; override?: boolean } => isObject(op)
    && (op.element === key)
    && isObject(op.bind)
    && Object.keys(op).every(name => [ 'element', 'bind', 'override' ].includes(name));

/** What the ops bind on the element `key` names, later ops over earlier ones. */
export const bindOf = (ops: readonly unknown[], key: string): Record<string, unknown> => Object.assign({}, ...ops.filter(op => isBindOf(op, key)).map(op => (op as { bind: Record<string, unknown> }).bind));

/**
 * The ops with `field` of the element's one `bind` op set to `value` (undefined takes it away), in
 * the place of its first. `override`: the window's code binds the element itself, so the op binds
 * over it (a picture the code draws, a caption it fills).
 */
export const withBind = (ops: readonly unknown[], key: string, field: string, value: unknown): unknown[] => {
    const values = { ...bindOf(ops, key) };

    if (value === undefined) delete values[field];
    else values[field] = value;

    const first = ops.findIndex(op => isBindOf(op, key));
    const others = ops.filter(op => !isBindOf(op, key));

    if (!Object.keys(values).length) return others;

    const op = { element: key, bind: values, override: true };

    if (first < 0) return [ ...others, op ];

    const before = ops.slice(0, first).filter(other => !isBindOf(other, key)).length;

    return [ ...others.slice(0, before), op, ...others.slice(before) ];
};

/** A part's template as staff read it: `badgeGridItem` is "Badge grid item", `layout_badge_display` "Page layout: badge display". */
export const partName = (template: string) => {
    const asset = (template.split('/').pop() ?? template).replace(/_xml$/, '');
    const layout = /^layout_(.+)$/.exec(asset);
    const words = (layout ? layout[1]! : asset).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').trim().toLowerCase();

    return layout ? `Page layout: ${words}` : words.charAt(0).toUpperCase() + words.slice(1);
};

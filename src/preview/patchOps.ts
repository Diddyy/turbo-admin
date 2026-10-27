/**
 * A patch's ops as a visual editor changes them: one `set` op per element, each change merged into
 * it. A value given again replaces the one there; a value taken away (undefined) leaves the op, and
 * an op with nothing left to set goes. `vars` and `params` are merged by name, as the client merges
 * them into the element's own. Ops of any other kind (insert, move, wrap, bind, remove) are kept as
 * they are, in their place.
 */

export type PatchOp = Record<string, unknown>;

const isObject = (value: unknown): value is Record<string, unknown> => (typeof value === 'object') && (value !== null) && !Array.isArray(value);

/** Whether `op` only sets values on the element `key` names: the op a visual edit goes into. */
const isSetOf = (op: unknown, key: string): op is { element: string; set: Record<string, unknown> } => isObject(op)
    && (op.element === key)
    && isObject(op.set)
    && Object.keys(op).every(name => (name === 'element') || (name === 'set'));

/** What the ops set on the element `key` names, later ops over earlier ones. */
export const setOf = (ops: readonly unknown[], key: string): Record<string, unknown> => {
    const values: Record<string, unknown> = {};

    for (const op of ops) {
        if (!isSetOf(op, key)) continue;

        for (const [ name, value ] of Object.entries(op.set)) values[name] = (isObject(value) && isObject(values[name])) ? { ...values[name], ...value } : value;
    }

    return values;
};

/**
 * The ops with the element's set ops made one, in the place of its first, holding `values`; with
 * no values left, the element has no set op.
 */
const withValues = (ops: readonly unknown[], key: string, values: Record<string, unknown>): unknown[] => {
    const first = ops.findIndex(op => isSetOf(op, key));
    const others = ops.filter(op => !isSetOf(op, key));
    const op = { element: key, set: values };

    if (!Object.keys(values).length) return others;

    if (first < 0) return [ ...others, op ];

    // Its place among the other ops: as many of them before it as there were before the first.
    const before = ops.slice(0, first).filter(other => !isSetOf(other, key)).length;

    return [ ...others.slice(0, before), op, ...others.slice(before) ];
};

/** The ops with `property` of the element `key` names set to `value`; undefined takes it away. */
export const withSet = (ops: readonly unknown[], key: string, property: string, value: unknown): unknown[] => {
    const values = { ...setOf(ops, key) };

    if (value === undefined) delete values[property];
    else values[property] = value;

    return withValues(ops, key, values);
};

/** The ops with several properties of one element set at once (a drag's x and width): one change. */
export const withSets = (ops: readonly unknown[], key: string, changes: Record<string, unknown>): unknown[] => {
    const values = { ...setOf(ops, key) };

    for (const [ property, value ] of Object.entries(changes)) {
        if (value === undefined) delete values[property];
        else values[property] = value;
    }

    return withValues(ops, key, values);
};

/** The ops with one entry of the element's `vars` or `params` set; undefined takes it away. */
export const withEntry = (ops: readonly unknown[], key: string, property: 'vars' | 'params', name: string, value: unknown): unknown[] => {
    const values = { ...setOf(ops, key) };
    const entries = { ...(isObject(values[property]) ? values[property] : {}) };

    if (value === undefined) delete entries[name];
    else entries[name] = value;

    if (Object.keys(entries).length) values[property] = entries;
    else delete values[property];

    return withValues(ops, key, values);
};

/** A colour as Habbo's windows take it, `0xAARRGGBB` as a number, in a picker's parts. */
export const colourParts = (argb: number) => ({
    hex: `#${(argb % 0x1000000).toString(16).padStart(6, '0')}`,
    alpha: Math.floor(argb / 0x1000000) % 0x100,
});

/** `#rrggbb` and an alpha (0-255) as Habbo's `0xAARRGGBB` number. */
export const colourOf = (hex: string, alpha: number) => (Math.max(0, Math.min(255, Math.round(alpha))) * 0x1000000) + (Number.parseInt(hex.replace('#', ''), 16) || 0);

/** A colour as a template gives it: a number, or `0xAARRGGBB` / `#RRGGBB` text. Null when it is none. */
export const colourValue = (value: unknown): number | null => {
    if ((typeof value === 'number') && Number.isFinite(value)) return value;

    if (typeof value !== 'string') return null;

    const text = value.trim().replace(/^(0x|#)/i, '');
    const parsed = Number.parseInt(text, 16);

    if (!Number.isFinite(parsed)) return null;

    // `#RRGGBB` has no alpha: drawn whole.
    return (text.length <= 6) ? (0xff * 0x1000000) + parsed : parsed;
};

/** A layout's `scale` per axis: how an element follows its parent's resize. */
export const SCALES = [ 'fixed', 'move', 'stretch', 'center' ];

/** A layout's `align`: the edge an element keeps when resized, across and down. */
export const ALIGN_H = [ 'left', 'center', 'right' ];
export const ALIGN_V = [ 'top', 'middle', 'bottom' ];

/** The skin component a template element's tag draws (`tab_button` -> `tabButton`). */
export const skinComponentOf = (tag: string) => tag.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());

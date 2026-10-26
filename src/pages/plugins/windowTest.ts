/**
 * The windows browser's **Test**: a patch's ops applied to a window's element tree from the client's
 * `template-index.json`, before the patch is saved, so staff see what it changes and which op names
 * nothing. Elements are found as nitro-theme's `findByKey` finds them (`templateBindings.ts`): each
 * `/`-separated part inside the last one - a name anywhere under it, children before grandchildren,
 * a `#TAG` part by its tag, an `@N` part the N-th child - a leading `@N` counting in the window
 * itself, `''` the window. The client applies the patch itself at a player's next load and reports
 * it: that report, beside the window, is the last word.
 */
import type { WindowElement } from '#/api/windows';

/** An element after the test: what the ops did to it. */
export interface TestElement extends WindowElement {
    /** `set`'s fields, as the op gave them. */
    set?: Record<string, unknown>;
    /** Made by `insert` or `wrap`. */
    added?: boolean;
    /** Put here by `move`. */
    moved?: boolean;
    /** `bind`'s values. */
    binds?: unknown[];
    children?: TestElement[];
}

export interface TestResult {
    elements: TestElement[];
    /** Each op that changed something, as a line. */
    applied: string[];
    /** Each op whose element (or `to`) the window does not have: the client reports these unmatched. */
    unmatched: string[];
    /** Each op the test does not read (not one of set, remove, insert, move, wrap, bind). */
    unknown: string[];
    /** The keys `remove` took away. */
    removed: string[];
}

// A header's own buttons, which no element is: the `header` holding them (`findChildByName` reaches into a header's layout).
const HEADER_BUTTONS = new Set([ 'header_button_close', 'header_button_help' ]);

const findWhere = (children: readonly TestElement[], test: (child: TestElement) => boolean): TestElement | undefined => {
    const direct = children.find(test);

    if (direct) return direct;

    for (const child of children) {
        const found = findWhere(child.children ?? [], test);

        if (found) return found;
    }

    return undefined;
};

/** The element a key names, as the client's `findByKey`. */
export const findByKey = (elements: readonly TestElement[], key: string): TestElement | undefined => {
    if (key === '') return elements[0];

    let scope: readonly TestElement[] = elements;
    let found: TestElement | undefined;

    if (key.startsWith('@')) {
        found = elements[0];
        scope = found?.children ?? [];
    }

    for (const name of key.split('/')) {
        if (name.startsWith('#')) found = findWhere(scope, child => !!child.tags?.includes(name.slice(1))) ?? findWhere(scope, child => !!child.tags?.includes(name));
        else if (name.startsWith('@') && (found !== undefined)) found = scope[Number(name.slice(1))];
        else found = findWhere(scope, child => child.name === name) ?? (HEADER_BUTTONS.has(name) ? findWhere(scope, child => child.tag === 'header') : undefined);

        if (!found) return undefined;

        scope = found.children ?? [];
    }

    return found;
};

const copy = (element: WindowElement): TestElement => ({ ...element, ...(element.children ? { children: element.children.map(copy) } : {}) });

/** The list holding an element, and where in it. */
const placeOf = (elements: TestElement[], target: TestElement): { list: TestElement[]; index: number } | undefined => {
    const index = elements.indexOf(target);

    if (index >= 0) return { list: elements, index };

    for (const element of elements) {
        const found = element.children && placeOf(element.children, target);

        if (found) return found;
    }

    return undefined;
};

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && (typeof value === 'object') && !Array.isArray(value);

/** A new element from an op's `add` (`insert`, `wrap`): its fields as given, `like` naming the element it copies. */
const built = (add: unknown, elements: TestElement[]): TestElement => {
    const input = isRecord(add) ? add : {};
    const like = (typeof input.like === 'string') ? findByKey(elements, input.like) : undefined;
    const name = (typeof input.name === 'string') ? input.name : (typeof input.bindAs === 'string') ? input.bindAs : undefined;
    const rect: TestElement['rect'] = [ Number(input.x ?? like?.rect[0] ?? 0), Number(input.y ?? like?.rect[1] ?? 0), Number(input.width ?? like?.rect[2] ?? 0), Number(input.height ?? like?.rect[3] ?? 0) ];

    return {
        tag: (typeof input.tag === 'string') ? input.tag : (like?.tag ?? '?'),
        ...(name ? { name, key: name } : {}),
        ...((typeof input.style === 'string') ? { style: input.style } : like?.style !== undefined ? { style: like.style } : {}),
        ...((typeof input.caption === 'string') ? { caption: input.caption } : {}),
        rect,
        added: true,
        ...(Array.isArray(input.children) ? { children: input.children.map(child => built(child, elements)) } : {}),
    };
};

const put = (elements: TestElement[], node: TestElement, where: string, at: TestElement): boolean => {
    if ((where === 'first') || (where === 'last')) {
        at.children = (where === 'first') ? [ node, ...(at.children ?? []) ] : [ ...(at.children ?? []), node ];

        return true;
    }

    const place = placeOf(elements, at);

    if (!place) return false;

    place.list.splice(place.index + ((where === 'after') ? 1 : 0), 0, node);

    return true;
};

/** The ops applied, in order, to a copy of the window's elements. */
export const testPatch = (source: readonly WindowElement[], ops: readonly unknown[]): TestResult => {
    const elements = source.map(copy);
    const result: TestResult = { elements, applied: [], unmatched: [], unknown: [], removed: [] };

    for (const op of ops) {
        if (!isRecord(op) || (typeof op.element !== 'string')) {
            result.unknown.push(JSON.stringify(op));
            continue;
        }

        const key = op.element;
        const target = findByKey(elements, key);
        const line = `'${key}'`;

        if (!target) {
            result.unmatched.push(`${line}: the window has no such element`);
            continue;
        }

        if (isRecord(op.set)) {
            const set = op.set;

            target.set = { ...target.set, ...set };

            if (typeof set.caption === 'string') target.caption = set.caption;
            if (typeof set.style === 'string') target.style = set.style;
            if (typeof set.hidden === 'boolean') target.hidden = set.hidden;
            target.rect = [ Number(set.x ?? target.rect[0]), Number(set.y ?? target.rect[1]), Number(set.width ?? target.rect[2]), Number(set.height ?? target.rect[3]) ];
            result.applied.push(`${line}: set ${Object.keys(set).join(', ')}`);
        } else if (op.remove === true) {
            const place = placeOf(elements, target);

            if (!place || (target === elements[0])) {
                result.unmatched.push(`${line}: the window itself is not removed`);
                continue;
            }

            place.list.splice(place.index, 1);
            result.removed.push(key);
            result.applied.push(`${line}: removed`);
        } else if (typeof op.insert === 'string') {
            const node = built(op.add, elements);

            if (put(elements, node, op.insert, target)) result.applied.push(`${line}: ${node.tag} ${node.name ?? ''} inserted ${op.insert}`.replace('  ', ' '));
            else result.unmatched.push(`${line}: nowhere to insert ${op.insert} it`);
        } else if ((typeof op.move === 'string') && (typeof op.to === 'string')) {
            const to = findByKey(elements, op.to);
            const place = placeOf(elements, target);

            if (!to || !place) {
                result.unmatched.push(`${line}: move ${op.move} '${op.to}', which the window has not`);
                continue;
            }

            place.list.splice(place.index, 1);
            target.moved = true;
            put(elements, target, op.move, to);
            result.applied.push(`${line}: moved ${op.move} '${op.to}'`);
        } else if (op.wrap !== undefined) {
            const place = placeOf(elements, target);

            if (!place || (target === elements[0])) {
                result.unmatched.push(`${line}: the window itself is not wrapped`);
                continue;
            }

            const node = built(op.wrap, elements);

            if (!isRecord(op.wrap) || (op.wrap.width === undefined)) node.rect = [ ...target.rect ];
            target.rect = [ 0, 0, target.rect[2], target.rect[3] ];
            node.children = [ target ];
            place.list.splice(place.index, 1, node);
            result.applied.push(`${line}: wrapped in ${node.tag} ${node.name ?? ''}`.trim());
        } else if (op.bind !== undefined) {
            target.binds = [ ...(target.binds ?? []), op.bind ];
            result.applied.push(`${line}: bound ${JSON.stringify(op.bind)}${op.items ? ' in each row' : ''}`);
        } else {
            result.unknown.push(JSON.stringify(op));
        }
    }

    return result;
};

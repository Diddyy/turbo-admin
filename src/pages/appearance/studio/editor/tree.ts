import type { WindowElement, WindowTemplate } from '#/api/windows';

/**
 * A window's tree with one theme's ops applied, as the window editor shows and changes it: each op
 * resolved where the client resolves it - against the tree the ops before it made, by the client's
 * own key rules (`templateBindings.ts` `findByKey`, `templateElementKey.ts`) - so the editor knows
 * which element each op is of, and names an element by the key that reaches it after every op. A key
 * like `@3` names another element once a move or an insert comes before it: the editor merges a
 * change into the op that is OF the element, never into one that merely has the same key text.
 */

export interface EditNode {
    /** Stable while the tree is read: the editor's handle on it. */
    uid: number;
    tag: string;
    name?: string;
    tags: string[];
    x: number;
    y: number;
    width: number;
    height: number;
    hidden: boolean;
    caption?: string;
    style?: string;
    children: EditNode[];
    parent: EditNode | null;
    /** The op index of the theme's `insert` that added it; none for the template's own. */
    insertedAt?: number;
}

export interface EditTree {
    template: string;
    owner: string;
    roots: EditNode[];
    /** Per op, the element it is of (undefined: it matched nothing). */
    targets: (EditNode | undefined)[];
}

type Op = Record<string, unknown>;

const isObject = (value: unknown): value is Op => (typeof value === 'object') && (value !== null) && !Array.isArray(value);

let uids = 0;

const fromElement = (element: WindowElement, parent: EditNode | null): EditNode => {
    const node: EditNode = {
        uid: ++uids,
        tag: element.tag,
        ...(element.name !== undefined ? { name: element.name } : {}),
        tags: element.tags ?? [],
        x: element.rect[0],
        y: element.rect[1],
        width: element.rect[2],
        height: element.rect[3],
        hidden: !!element.hidden,
        ...(element.caption !== undefined ? { caption: element.caption } : {}),
        ...(element.style !== undefined ? { style: element.style } : {}),
        children: [],
        parent,
    };

    node.children = (element.children ?? []).map(child => fromElement(child, node));

    return node;
};

const copyOf = (node: EditNode, parent: EditNode | null): EditNode => {
    const copy: EditNode = { ...node, uid: ++uids, tags: [ ...node.tags ], parent, children: [] };

    delete copy.insertedAt;
    copy.children = node.children.map(child => copyOf(child, copy));

    return copy;
};

/** `findTemplateChildWhere`: a direct child first, then each child's subtree in turn. */
const findWhere = (children: readonly EditNode[], test: (node: EditNode) => boolean): EditNode | undefined => {
    const direct = children.find(test);

    if (direct) return direct;

    for (const child of children) {
        const found = findWhere(child.children, test);

        if (found) return found;
    }

    return undefined;
};

/** `findByKey`: `''` the window, `/`-separated names, `#TAG`, `@N` (a leading one in the window's children). */
export const findByKey = (roots: readonly EditNode[], key: string): EditNode | undefined => {
    if (key === '') return roots[0];

    let scope: readonly EditNode[] = roots;
    let found: EditNode | undefined;

    if (key.startsWith('@')) {
        found = roots[0];
        scope = found?.children ?? [];
    }

    for (const name of key.split('/')) {
        if (name.startsWith('#')) found = findWhere(scope, node => node.tags.includes(name.slice(1)) || node.tags.includes(name));
        else if (name.startsWith('@') && (found !== undefined)) found = scope[Number(name.slice(1))];
        else found = findWhere(scope, node => node.name === name);

        if (!found) return undefined;

        scope = found.children;
    }

    return found;
};

/** The engine's `elementKey`: an owner names its own added elements by their short names. */
const ownedKey = (roots: readonly EditNode[], owner: string, key: string) => key.split('/').map(part => (findWhere(roots, node => node.name === `${owner}:${part}`) ? `${owner}:${part}` : part)).join('/');

const resolve = (tree: EditTree, key: string) => findByKey(tree.roots, ownedKey(tree.roots, tree.owner, key));

/** `templateElementKey`: the key that reaches `node` in the tree as it is now. */
export const keyOf = (roots: readonly EditNode[], node: EditNode): string | undefined => {
    const chain: EditNode[] = [];

    for (let at: EditNode | null = node; at; at = at.parent) chain.unshift(at);

    if (chain[0] !== roots[0]) return undefined;

    if (node === roots[0]) return '';

    const finds = (key: string) => findByKey(roots, key) === node;

    if (node.name && finds(node.name)) return node.name;

    const indexes = (from: number) => chain.slice(from + 1).map((step, at) => `@${chain[from + at]!.children.indexOf(step)}`);

    for (let at = chain.length - 2; at >= 1; at--) {
        const name = chain[at]!.name;

        if (!name || (findByKey(roots, name) !== chain[at])) continue;

        const key = [ name, ...indexes(at) ].join('/');

        if (finds(key)) return key;
    }

    const key = indexes(0).join('/');

    return finds(key) ? key : undefined;
};

/**
 * A key as an op of the owner's writes it: its own added elements by their short names, as the engine
 * reaches them (`elementKey`, `templateBindElement`) - so the ops mean the same in any theme they are
 * put in, not only the one whose key prefixes the names.
 */
export const portable = (key: string, owner: string) => key.split('/').map(part => (part.startsWith(`${owner}:`) ? part.slice(owner.length + 1) : part)).join('/');

const detach = (node: EditNode) => {
    const siblings = node.parent?.children;

    if (siblings) siblings.splice(siblings.indexOf(node), 1);

    node.parent = null;
};

const place = (node: EditNode, where: string, target: EditNode) => {
    if ((where === 'first') || (where === 'last')) {
        node.parent = target;

        if (where === 'first') target.children.unshift(node);
        else target.children.push(node);

        return;
    }

    const parent = target.parent;

    if (!parent) return;

    node.parent = parent;
    parent.children.splice(parent.children.indexOf(target) + (where === 'after' ? 1 : 0), 0, node);
};

const inside = (node: EditNode, maybeAncestor: EditNode) => {
    for (let at: EditNode | null = node; at; at = at.parent) if (at === maybeAncestor) return true;

    return false;
};

const applyFields = (node: EditNode, fields: Op) => {
    for (const name of [ 'x', 'y', 'width', 'height' ] as const) if (typeof fields[name] === 'number') node[name] = fields[name];

    if (typeof fields.hidden === 'boolean') node.hidden = fields.hidden;

    if (typeof fields.caption === 'string') node.caption = fields.caption;

    if ((typeof fields.style === 'string') || (typeof fields.style === 'number')) node.style = String(fields.style);

    if (Array.isArray(fields.tags)) node.tags = fields.tags.filter((tag): tag is string => typeof tag === 'string');
};

/** An `insert`'s or a `wrap`'s `add` built as the engine builds it: a copy of its `like`, else from its fields. */
const built = (tree: EditTree, add: Op): EditNode | undefined => {
    const like = typeof add.like === 'string' ? resolve(tree, add.like) : undefined;

    if ((typeof add.like === 'string') && !like) return undefined;

    if (!like && (typeof add.tag !== 'string')) return undefined;

    const node: EditNode = like
        ? copyOf(like, null)
        : { uid: ++uids, tag: add.tag as string, tags: [], x: 0, y: 0, width: 0, height: 0, hidden: false, children: [], parent: null };

    if (typeof add.tag === 'string') node.tag = add.tag;

    const short = typeof add.name === 'string' ? add.name : undefined;

    node.name = (typeof add.bindAs === 'string') && !short ? add.bindAs : short ? `${tree.owner}:${short}` : node.name;
    applyFields(node, add);

    if (Array.isArray(add.children)) node.children = add.children.filter(isObject).map(child => built(tree, child)).filter((child): child is EditNode => !!child).map(child => Object.assign(child, { parent: node }));

    return node;
};

/** The template's tree with `ops` (one owner's, in their order) applied. */
export const editTree = (template: string, layout: WindowTemplate | undefined, ops: readonly unknown[], owner: string): EditTree => {
    const tree: EditTree = { template, owner, roots: (layout?.elements ?? []).slice(0, 1).map(element => fromElement(element, null)), targets: [] };

    ops.forEach((op, at) => {
        if (!isObject(op) || (typeof op.element !== 'string')) {
            tree.targets.push(undefined);

            return;
        }

        const node = resolve(tree, op.element);

        tree.targets.push(node);

        if (!node) return;

        if (isObject(op.set)) applyFields(node, op.set);
        else if ((op.remove === true) && node.parent) detach(node);
        else if ((typeof op.insert === 'string') && isObject(op.add)) {
            const added = built(tree, op.add);

            if (added && (node.parent || (op.insert === 'first') || (op.insert === 'last'))) {
                added.insertedAt = at;
                place(added, op.insert, node);
            }
        } else if ((typeof op.move === 'string') && (typeof op.to === 'string')) {
            const to = resolve(tree, op.to);

            if (to && node.parent && !inside(to, node)) {
                detach(node);
                place(node, op.move, to);
            }
        } else if (isObject(op.wrap) && node.parent) {
            const wrapper = built(tree, op.wrap);

            if (wrapper) {
                if (!('x' in op.wrap)) Object.assign(wrapper, { x: node.x, y: node.y, width: node.width, height: node.height });

                place(wrapper, 'before', node);
                detach(node);
                Object.assign(node, { x: 0, y: 0 });
                place(node, 'last', wrapper);
            }
        }
    });

    return tree;
};

/** Every node, depth first, the window first. */
export const walk = (roots: readonly EditNode[]): EditNode[] => roots.flatMap(node => [ node, ...walk(node.children) ]);

/** The node a key reaches in the tree as it is now (an owner's short name for its own too). */
export const nodeOf = (tree: EditTree, key: string | null | undefined) => ((key === null) || (key === undefined) ? undefined : resolve(tree, key));

const isSetOp = (op: unknown): op is { element: string; set: Op } => isObject(op) && isObject(op.set) && Object.keys(op).every(name => (name === 'element') || (name === 'set'));

/** What the theme's set ops of `node` set, later over earlier (an added element's own fields first). */
export const valuesOf = (tree: EditTree, ops: readonly unknown[], node: EditNode): Op => {
    const values: Op = {};
    const add = (node.insertedAt !== undefined) && isObject(ops[node.insertedAt]) ? (ops[node.insertedAt] as Op).add : undefined;

    if (isObject(add)) Object.assign(values, add);

    ops.forEach((op, at) => {
        if (!isSetOp(op) || (tree.targets[at] !== node)) return;

        for (const [ name, value ] of Object.entries(op.set)) values[name] = (isObject(value) && isObject(values[name])) ? { ...values[name], ...value } : value;
    });

    return values;
};

/**
 * The ops with `changes` made to `node` (undefined takes a value away): into its own `add` when the
 * theme added it, else into the last set op OF it that no move or wrap of it follows, else a new set
 * op at the end named by the key that reaches it now.
 */
export const withNodeSets = (tree: EditTree, ops: readonly unknown[], node: EditNode, changes: Op): unknown[] => {
    const next = [ ...ops ];

    if (node.insertedAt !== undefined) {
        const op = next[node.insertedAt] as Op;
        const add: Op = { ...(op.add as Op) };

        for (const [ name, value ] of Object.entries(changes)) {
            if (value === undefined) delete add[name];
            else add[name] = value;
        }

        next[node.insertedAt] = { ...op, add };

        return next;
    }

    const own = next.map((op, at) => (isSetOp(op) && (tree.targets[at] === node) ? at : -1)).filter(at => at >= 0);
    const resets = Object.entries(changes).filter(([ , value ]) => value === undefined).map(([ name ]) => name);
    const values = Object.fromEntries(Object.entries(changes).filter(([ , value ]) => value !== undefined));

    for (const at of own) {
        const op = next[at] as { element: string; set: Op };
        const set = { ...op.set };

        for (const name of [ ...resets, ...Object.keys(values) ]) delete set[name];

        next[at] = { ...op, set };
    }

    const moved = (from: number) => next.slice(from + 1).some((op, offset) => isObject(op) && (tree.targets[from + 1 + offset] === node) && (('move' in op) || ('wrap' in op)));
    const into = [ ...own ].reverse().find(at => !moved(at));

    if (Object.keys(values).length) {
        if (into !== undefined) {
            const op = next[into] as { element: string; set: Op };

            next[into] = { ...op, set: { ...op.set, ...values } };
        } else {
            const key = keyOf(tree.roots, node);

            if (key !== undefined) next.push({ element: portable(key, tree.owner), set: values });
        }
    }

    // A set op left with nothing to set goes.
    return next.filter((op, at) => !(own.includes(at) && isSetOp(op) && !Object.keys(op.set).length));
};

/** The short names the owner's added elements already have, to give a new one its own. */
export const freeName = (tree: EditTree, base: string) => {
    const taken = new Set(walk(tree.roots).map(node => node.name));

    for (let n = 1; ; n++) if (!taken.has(`${tree.owner}:${base}${n}`) && !taken.has(`${base}${n}`)) return `${base}${n}`;
};

/** The ops without `node`: its insert gone with every op of it and of what it holds, or a `remove` op for the template's own. */
export const withoutNode = (tree: EditTree, ops: readonly unknown[], node: EditNode): unknown[] => {
    if (node.insertedAt !== undefined) {
        const gone = new Set(walk([ node ]));

        return ops.filter((_, at) => (at !== node.insertedAt) && !(tree.targets[at] && gone.has(tree.targets[at])));
    }

    const key = keyOf(tree.roots, node);

    return key === undefined ? [ ...ops ] : [ ...ops, { element: portable(key, tree.owner), remove: true } ];
};

/** The ops with `node` moved `where` (`before` / `after` / `last`) the node `to`: a move op at the end, named as they are reached now. */
export const withMove = (tree: EditTree, ops: readonly unknown[], node: EditNode, where: 'before' | 'after' | 'last', to: EditNode): unknown[] => {
    const key = keyOf(tree.roots, node);
    const target = keyOf(tree.roots, to);

    if ((key === undefined) || (target === undefined) || (node === to) || inside(to, node)) return [ ...ops ];

    return [ ...ops, { element: portable(key, tree.owner), move: where, to: portable(target, tree.owner) } ];
};

/** Whether `node` is `ancestor` or inside it. */
export const isInside = inside;

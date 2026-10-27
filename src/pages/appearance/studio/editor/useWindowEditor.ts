import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useRef, useState } from 'react';

import { imagesKey } from '#/api/noCode';
import { type TemplateIndex, windowOf } from '#/api/windows';
import type { DesignBox, DesignBoxes } from '#/preview/DesignPreview';
import { dragged, type DragKind, unionOf } from '#/preview/VisualEditor';

import { withBind } from '../inspector/model';
import type { Studio } from '../studio';
import { HUD_WINDOW } from '../windows';
import type { Move, Picked } from './EditorOverlay';
import type { DropWhere } from './Hierarchy';
import { type EditNode, type EditTree, editTree, freeName, isInside, keyOf, nodeOf, portable, walk, withMove, withNodeSets, withoutNode } from './tree';

type Op = Record<string, unknown>;

/** What the palette adds: a window type of Habbo's layouts with a size to start at, and what it shows. */
export const PALETTE: { kind: string; label: string; hint: string; add: Op }[] = [
    { kind: 'text', label: 'Text', hint: 'A line of text: its words in the inspector', add: { tag: 'text', width: 120, height: 16, caption: 'New text' } },
    { kind: 'image', label: 'Image', hint: 'A picture from the media library', add: { tag: 'container', width: 64, height: 64 } },
    { kind: 'button', label: 'Button', hint: 'A Habbo button', add: { tag: 'button', width: 90, height: 22, caption: 'Button' } },
    { kind: 'container', label: 'Container', hint: 'An empty box that holds others', add: { tag: 'container', width: 120, height: 80 } },
    { kind: 'border', label: 'Border', hint: 'A framed box (its skin in the inspector)', add: { tag: 'border', width: 120, height: 80 } },
    { kind: 'region', label: 'Region', hint: 'A clickable area', add: { tag: 'region', width: 80, height: 40 } },
    { kind: 'list', label: 'List', hint: 'A vertical list its rows go in', add: { tag: 'itemlist_vertical', width: 120, height: 100 } },
];

/** The window types that hold others: what a part is dropped into, or pasted into. */
const HOLDERS = /container|region|frame|border|itemlist|itemgrid|scrollable|header|tab_content|widget|bubble/;

/** What Copy holds, across windows: an element of a template, its fields as a new one's. */
let clipboard: { template: string; key: string; add: Op }[] = [];

const fieldsOf = (node: EditNode): Op => ({
    tag: node.tag,
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    ...(node.caption !== undefined ? { caption: node.caption } : {}),
    ...(node.style !== undefined ? { style: node.style } : {}),
    ...(node.hidden ? { hidden: true } : {}),
});

export interface WindowEditor {
    /** The window's tree and each part's, the theme's ops applied. */
    trees: { tree: EditTree; label: string }[];
    selected: Picked[];
    elements: DesignBoxes['elements'];
    onBoxes: (boxes: DesignBoxes) => void;
    /** Picks one (additive: adds it or takes it away); the studio's selection follows the last one picked. */
    pick: (picked: Picked, additive: boolean) => void;
    pickMany: (picked: Picked[], additive: boolean) => void;
    /** A press in the preview picked it (the studio's selection set from it): whether it is picked now. */
    pressed: (picked: Picked, additive: boolean) => boolean;
    clear: () => void;
    primary: { tree: EditTree; node: EditNode } | undefined;
    move: (move: Move) => void;
    resize: (kind: DragKind, dx: number, dy: number, done: boolean) => void;
    nudge: (dx: number, dy: number) => void;
    align: (edge: 'left' | 'right' | 'top' | 'bottom' | 'centerH' | 'centerV') => void;
    distribute: (axis: 'h' | 'v') => void;
    hide: (tree: EditTree, node: EditNode, hidden: boolean) => void;
    reorder: (tree: EditTree, node: EditNode, where: DropWhere, to: EditNode) => void;
    duplicate: () => void;
    copy: () => void;
    paste: () => void;
    remove: () => void;
    canPaste: boolean;
    /** A palette entry dropped at a point of the preview; the image's picture asked for after. */
    drop: (kind: string, x: number, y: number) => void;
    /** The image just added, its picture to pick (the picker open for it). */
    picturing: Picked | null;
    setPicture: (url: string | null) => void;
    /** Sets values of the primary element (undefined takes one away). */
    setValues: (changes: Op, group: string) => void;
    grid: number;
    setGrid: (grid: number) => void;
}

/**
 * The window editor's state and edits over the studio's draft: the picked elements, the boxes the
 * preview says they are drawn in, and every edit (move, resize, align, distribute, nudge, hide,
 * reorder, duplicate, copy, paste, delete, add from the palette) as patch ops into the theme's draft
 * - one step of undo each, a drag one step.
 */
export const useWindowEditor = (studio: Studio, index: TemplateIndex | undefined, parts: readonly string[], partName: (template: string) => string): WindowEditor => {
    const queryClient = useQueryClient();
    const [ selected, setSelected ] = useState<Picked[]>([]);
    const [ boxes, setBoxes ] = useState<DesignBoxes | null>(null);
    const [ grid, setGrid ] = useState(0);
    const [ picturing, setPicturing ] = useState<Picked | null>(null);
    const [ , setClip ] = useState(0);
    const dragStart = useRef<{ group: string; starts: Map<string, { x: number; y: number; width: number; height: number }> } | null>(null);
    const window = studio.window;
    const owner = studio.theme;
    const scale = boxes?.scale ?? 1;

    const templates = useMemo(() => (window ? [ window, ...parts.filter(part => part !== window) ] : []), [ window, parts ]);
    const opsKey = JSON.stringify(templates.map(template => studio.ops(template)));
    const trees = useMemo(() => (index
        ? templates.filter(template => windowOf(index, template)).map(template => ({
                tree: editTree(template, windowOf(index, template), studio.ops(template), owner),
                label: template === window ? 'The window' : `Drawn inside: ${partName(template)}`,
            }))
        : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the ops by value
    [ index, templates, opsKey, owner ]);

    // The studio's own pick (a press in the preview, the inspector's element list) is always one of the picked.
    const studioPick = studio.selection && (studio.selection.key !== null) ? { template: studio.selection.template, key: studio.selection.key } : null;
    const shownSelected = studioPick && !selected.some(each => (each.template === studioPick.template) && (each.key === studioPick.key)) ? [ studioPick ] : selected;

    const treeOf = (template: string) => trees.find(entry => entry.tree.template === template)?.tree;
    const resolved = (picks: readonly Picked[]) => picks.map(each => ({ each, tree: treeOf(each.template) })).map(({ each, tree }) => ({ tree, node: tree ? nodeOf(tree, each.key) : undefined })).filter((entry): entry is { tree: EditTree; node: EditNode } => !!entry.tree && !!entry.node);

    /**
     * The picked elements an edit moves: not the window itself, not one inside another picked one. A whole piece of the room
     * screen moves (its code places it; the client moves it by its root's x/y).
     */
    const movable = () => {
        const all = resolved(shownSelected).filter(({ node, tree }) => node.parent || ((window === HUD_WINDOW) && (tree.template !== window)));

        return all.filter(({ node, tree }) => !all.some(other => (other.node !== node) && (other.tree === tree) && isInside(node, other.node)));
    };

    const boxOf = (template: string, key: string): DesignBox | undefined => unionOf(boxes?.elements.find(element => (element.template === template) && (element.key === key))?.rects ?? []);

    /**
     * Where a holder's children are placed from, in the preview's pixels: a frame places them in its
     * content area, below its title, so a drawn child tells it (its box less its own x and y); a
     * holder with none drawn, its own corner.
     */
    const originOf = (tree: EditTree, holder: EditNode): { x: number; y: number } | undefined => {
        for (const child of holder.children) {
            const box = child.hidden ? undefined : boxOf(tree.template, keyOf(tree.roots, child) ?? '');

            if (box) return { x: box.x - (child.x / scale), y: box.y - (child.y / scale) };
        }

        const own = boxOf(tree.template, keyOf(tree.roots, holder) ?? '');

        return own && { x: own.x, y: own.y };
    };

    const selectStudio = (picked: Picked | null) => {
        if (!picked || !window) return studio.select(null);

        const tree = treeOf(picked.template);
        const node = tree ? nodeOf(tree, picked.key) : undefined;

        studio.select({ window, template: picked.template, key: picked.key, tag: node?.tag ?? '', name: node?.name ?? null });
    };

    const pick = (picked: Picked, additive: boolean) => {
        const was = shownSelected;
        const has = was.some(each => (each.template === picked.template) && (each.key === picked.key));
        const next = !additive ? [ picked ] : has ? was.filter(each => !((each.template === picked.template) && (each.key === picked.key))) : [ ...was, picked ];

        setSelected(next);
        selectStudio(next.at(-1) ?? null);
    };

    const pressed = (picked: Picked, additive: boolean) => {
        const has = shownSelected.some(each => (each.template === picked.template) && (each.key === picked.key));
        const next = !additive ? [ picked ] : has ? shownSelected.filter(each => !((each.template === picked.template) && (each.key === picked.key))) : [ ...shownSelected, picked ];

        setSelected(next);

        return !additive || !has;
    };

    const pickMany = (picked: Picked[], additive: boolean) => {
        const next = additive ? [ ...shownSelected, ...picked.filter(each => !shownSelected.some(other => (other.template === each.template) && (other.key === each.key))) ] : picked;

        setSelected(next);
        selectStudio(next.at(-1) ?? null);
    };

    /** Applies edits template by template, each over the ops the one before it left: one step of undo with `group`. */
    const edit = (changes: { template: string; change: (tree: EditTree, ops: unknown[]) => unknown[] }[], group?: string) => {
        const byTemplate = new Map<string, unknown[]>();

        for (const { template, change } of changes) {
            const ops = byTemplate.get(template) ?? [ ...studio.ops(template) ];
            const tree = editTree(template, index ? windowOf(index, template) : undefined, ops, owner);

            byTemplate.set(template, change(tree, ops));
        }

        // One draft change for every template touched: one step back.
        studio.changeManyOps(Object.fromEntries(byTemplate), group);
    };

    /** An edit of each node a pick names, found again in the tree each edit is made over (an earlier edit may have moved it). */
    const eachNode = (picks: readonly { tree: EditTree; node: EditNode }[], change: (tree: EditTree, ops: unknown[], node: EditNode, at: number) => unknown[]) => picks.map(({ tree, node }, at) => {
        const key = keyOf(tree.roots, node);

        return { template: tree.template, change: (now: EditTree, ops: unknown[]) => {
            const found = key === undefined ? undefined : nodeOf(now, key);

            return found ? change(now, ops, found, at) : ops;
        } };
    });

    const snapToGrid = (value: number) => (grid > 0 ? Math.round(value / grid) * grid : value);

    const move = ({ dx, dy, snapped, done }: Move) => {
        const picks = movable();

        if (!picks.length) return;

        if (!dragStart.current) dragStart.current = { group: `editor:move:${Date.now()}`, starts: new Map(picks.map(({ tree, node }) => [ `${tree.template}|${keyOf(tree.roots, node)}`, { x: node.x, y: node.y, width: node.width, height: node.height } ])) };

        const starts = dragStart.current.starts;
        let mx = Math.round(dx * scale);
        let my = Math.round(dy * scale);
        // On the grid: the first picked lands on it, the others keep their places to it.
        const lead = starts.get(`${picks[0]!.tree.template}|${keyOf(picks[0]!.tree.roots, picks[0]!.node)}`);

        if (lead && !snapped.x) mx = snapToGrid(lead.x + mx) - lead.x;
        if (lead && !snapped.y) my = snapToGrid(lead.y + my) - lead.y;

        edit(eachNode(picks, (tree, ops, node) => {
            const start = starts.get(`${tree.template}|${keyOf(tree.roots, node)}`);

            return start ? withNodeSets(tree, ops, node, { ...(mx ? { x: start.x + mx } : {}), ...(my ? { y: start.y + my } : {}) }) : ops;
        }), dragStart.current.group);

        if (done) dragStart.current = null;
    };

    const resize = (kind: DragKind, dx: number, dy: number, done: boolean) => {
        const [ only ] = movable();

        if (!only) return;

        if (!dragStart.current) dragStart.current = { group: `editor:resize:${Date.now()}`, starts: new Map([ [ 'resize', { x: only.node.x, y: only.node.y, width: only.node.width, height: only.node.height } ] ]) };

        const start = dragStart.current.starts.get('resize')!;
        const change = Object.fromEntries(Object.entries(dragged(kind, start, Math.round(dx * scale), Math.round(dy * scale))).map(([ name, value ]) => [ name, snapToGrid(value) ]));

        edit(eachNode([ only ], (tree, ops, node) => withNodeSets(tree, ops, node, change)), dragStart.current.group);

        if (done) dragStart.current = null;
    };

    const nudge = (dx: number, dy: number) => edit(eachNode(movable(), (tree, ops, node) => withNodeSets(tree, ops, node, { ...(dx ? { x: node.x + dx } : {}), ...(dy ? { y: node.y + dy } : {}) })), `editor:nudge:${shownSelected.map(each => each.key).join(',')}`);

    /** Each picked element's box in the preview, with it. */
    const withBoxes = () => movable().map(entry => ({ ...entry, box: boxOf(entry.tree.template, keyOf(entry.tree.roots, entry.node) ?? '') })).filter((entry): entry is typeof entry & { box: DesignBox } => !!entry.box);

    const shiftBy = (entries: { tree: EditTree; node: EditNode; shift: { x: number; y: number } }[]) => edit(eachNode(entries, (tree, ops, node, at) => {
        const { x, y } = entries[at]!.shift;
        const mx = Math.round(x * scale);
        const my = Math.round(y * scale);

        return (mx || my) ? withNodeSets(tree, ops, node, { ...(mx ? { x: node.x + mx } : {}), ...(my ? { y: node.y + my } : {}) }) : ops;
    }));

    const align = (edge: 'left' | 'right' | 'top' | 'bottom' | 'centerH' | 'centerV') => {
        const entries = withBoxes();

        if (entries.length < 2) return;

        const all = unionOf(entries.map(entry => entry.box))!;

        shiftBy(entries.map(entry => ({ ...entry, shift: {
            x: edge === 'left' ? all.x - entry.box.x : edge === 'right' ? (all.x + all.width) - (entry.box.x + entry.box.width) : edge === 'centerH' ? (all.x + (all.width / 2)) - (entry.box.x + (entry.box.width / 2)) : 0,
            y: edge === 'top' ? all.y - entry.box.y : edge === 'bottom' ? (all.y + all.height) - (entry.box.y + entry.box.height) : edge === 'centerV' ? (all.y + (all.height / 2)) - (entry.box.y + (entry.box.height / 2)) : 0,
        } })));
    };

    const distribute = (axis: 'h' | 'v') => {
        const entries = withBoxes().sort((a, b) => (axis === 'h' ? a.box.x - b.box.x : a.box.y - b.box.y));

        if (entries.length < 3) return;

        const size = (box: DesignBox) => (axis === 'h' ? box.width : box.height);
        const start = (box: DesignBox) => (axis === 'h' ? box.x : box.y);
        const first = entries[0]!.box;
        const last = entries.at(-1)!.box;
        const gap = ((start(last) + size(last)) - start(first) - entries.reduce((sum, entry) => sum + size(entry.box), 0)) / (entries.length - 1);
        let at = start(first);

        shiftBy(entries.map((entry) => {
            const shift = Math.round(at - start(entry.box));

            at += size(entry.box) + gap;

            return { ...entry, shift: axis === 'h' ? { x: shift, y: 0 } : { x: 0, y: shift } };
        }));
    };

    const hide = (tree: EditTree, node: EditNode, hidden: boolean) => edit(eachNode([ { tree, node } ], (now, ops, found) => withNodeSets(now, ops, found, { hidden })));

    const reorder = (tree: EditTree, node: EditNode, where: DropWhere, to: EditNode) => {
        const from = boxOf(tree.template, keyOf(tree.roots, node) ?? '');

        edit([ { template: tree.template, change: (now, ops) => {
            const moved = nodeOf(now, keyOf(tree.roots, node));
            const target = nodeOf(now, keyOf(tree.roots, to));

            if (!moved || !target) return ops;

            const next = withMove(now, ops, moved, where, target);
            // Into another parent: it stays where it was drawn, its x and y now its new parent's.
            const holder = (where === 'last') ? target : target.parent;
            const holderBox = holder && (holder !== moved.parent) ? originOf(now, holder) : undefined;

            if (!holderBox || !from || (next.length === ops.length)) return next;

            const after = editTree(now.template, index ? windowOf(index, now.template) : undefined, next, owner);
            // The move's own target, in the tree it made: the node moved.
            const placed = after.targets.at(-1);

            return placed ? withNodeSets(after, next, placed, { x: Math.round((from.x - holderBox.x) * scale), y: Math.round((from.y - holderBox.y) * scale) }) : next;
        } } ]);
    };

    const copy = () => {
        clipboard = movable().map(({ tree, node }) => ({ template: tree.template, key: keyOf(tree.roots, node) ?? '', add: fieldsOf(node) }));
        setClip(n => n + 1);
    };

    /** Inserts copies after each picked element: `like` it for the template's own (its look and children), its own fields for one the theme added. */
    const duplicate = () => {
        const picks = movable();
        const keys: Picked[] = [];

        edit(eachNode(picks, (tree, ops, node) => {
            const key = keyOf(tree.roots, node);

            if (key === undefined) return ops;

            const name = freeName(tree, node.tag.replace(/[^a-z]/gi, '') || 'part');
            const add = node.insertedAt !== undefined ? { ...((ops[node.insertedAt] as Op).add as Op), name, x: node.x + 10, y: node.y + 10 } : { like: portable(key, owner), name, x: node.x + 10, y: node.y + 10 };

            keys.push({ template: tree.template, key: `${owner}:${name}` });

            return [ ...ops, { element: portable(key, owner), insert: 'after', add } ];
        }));

        if (keys.length) pickMany(keys, false);
    };

    const paste = () => {
        if (!clipboard.length || !window) return;

        const [ target ] = resolved(shownSelected);
        const template = target?.tree.template ?? window;
        const keys: Picked[] = [];

        edit(clipboard.map(entry => ({ template, change: (tree, ops) => {
            const at = target ? nodeOf(tree, keyOf(target.tree.roots, target.node)) : tree.roots[0];
            const holder = at && (HOLDERS.test(at.tag) || !at.parent) ? at : at?.parent ?? tree.roots[0];
            const key = holder ? keyOf(tree.roots, holder) : undefined;

            if (key === undefined) return ops;

            const name = freeName(tree, String(entry.add.tag).replace(/[^a-z]/gi, '') || 'part');
            const add = (entry.template === template) && entry.key ? { like: portable(entry.key, owner), name, x: Number(entry.add.x) + 10, y: Number(entry.add.y) + 10 } : { ...entry.add, name, x: Number(entry.add.x) + 10, y: Number(entry.add.y) + 10 };

            keys.push({ template, key: `${owner}:${name}` });

            return [ ...ops, { element: portable(key, owner), insert: 'last', add } ];
        } })));

        if (keys.length) pickMany(keys, false);
    };

    const remove = () => {
        const picks = movable();

        // The deepest first: an element's removal never renames one still to go.
        edit(eachNode([ ...picks ].reverse(), (tree, ops, node) => withoutNode(tree, ops, node)));
        setSelected([]);
        studio.select(null);
    };

    const drop = (kind: string, x: number, y: number) => {
        const entry = PALETTE.find(each => each.kind === kind);
        const tree = window ? treeOf(window) : undefined;

        if (!entry || !tree) return;

        // The deepest holder of the window drawn under the point, else the window itself.
        const holders = (boxes?.elements ?? [])
            .filter(element => (element.template === tree.template) && HOLDERS.test(element.tag) && element.rects.some(box => (x >= box.x) && (y >= box.y) && (x <= box.x + box.width) && (y <= box.y + box.height)))
            .map(element => ({ element, node: nodeOf(tree, element.key) }))
            .filter((each): each is typeof each & { node: EditNode } => !!each.node);
        const deepest = holders.sort((a, b) => walkDepth(b.node) - walkDepth(a.node))[0];
        const holder = deepest?.node ?? tree.roots[0];
        const holderKey = holder ? keyOf(tree.roots, holder) : undefined;

        if (!holder || (holderKey === undefined)) return;

        const holderBox = originOf(tree, holder);

        const name = freeName(tree, entry.kind);
        // An image is its picture in a box of its own: the box is what is picked, moved and sized (the picture stretches with it).
        const picture = (kind === 'image') ? { tag: 'bitmap', name: `${name}_picture`, x: 0, y: 0, width: Number(entry.add.width), height: Number(entry.add.height), params: { scale: [ 'stretch', 'stretch' ] } } : undefined;
        const add = { ...entry.add, name, x: Math.max(0, Math.round((x - (holderBox?.x ?? 0)) * scale)), y: Math.max(0, Math.round((y - (holderBox?.y ?? 0)) * scale)), ...(picture ? { children: [ picture ] } : {}) };
        const picked = { template: tree.template, key: `${owner}:${name}` };

        edit([ { template: tree.template, change: (_, ops) => [ ...ops, { element: portable(holderKey, owner), insert: 'last', add } ] } ]);
        pickMany([ picked ], false);

        if (picture) setPicturing({ template: tree.template, key: `${owner}:${picture.name}` });
    };

    const setPicture = (url: string | null) => {
        const target = picturing;

        setPicturing(null);

        if (!target || !url) return;

        studio.changeOps(target.template, withBind(studio.ops(target.template), portable(target.key, owner), 'asset', url));
        // A picture uploaded in the picker is the theme's now: its list (where its files are) read again.
        void queryClient.invalidateQueries({ queryKey: imagesKey(owner) });
    };

    const primaryPick = shownSelected.at(-1);
    const primaryTree = primaryPick ? treeOf(primaryPick.template) : undefined;
    const primaryNode = primaryTree && primaryPick ? nodeOf(primaryTree, primaryPick.key) : undefined;

    const setValues = (changes: Op, group: string) => {
        if (!primaryTree || !primaryNode) return;

        edit(eachNode([ { tree: primaryTree, node: primaryNode } ], (tree, ops, node) => withNodeSets(tree, ops, node, changes)), `editor:${primaryPick?.key}:${group}`);
    };

    return {
        trees,
        selected: shownSelected,
        elements: boxes?.elements ?? [],
        onBoxes: setBoxes,
        pick,
        pickMany,
        pressed,
        clear: () => {
            setSelected([]);
            studio.select(null);
        },
        primary: primaryTree && primaryNode ? { tree: primaryTree, node: primaryNode } : undefined,
        move,
        resize,
        nudge,
        align,
        distribute,
        hide,
        reorder,
        duplicate,
        copy,
        paste,
        remove,
        canPaste: clipboard.length > 0,
        drop,
        picturing,
        setPicture,
        setValues,
        grid,
        setGrid,
    };
};

const walkDepth = (node: EditNode) => {
    let depth = 0;

    for (let at = node.parent; at; at = at.parent) depth++;

    return depth;
};

/** Every node of the trees, for a look-up by key. */
export const allNodes = (trees: readonly { tree: EditTree }[]) => trees.flatMap(({ tree }) => walk(tree.roots).map(node => ({ tree, node })));

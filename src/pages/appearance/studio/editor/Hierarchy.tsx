import { ChevronDown, ChevronRight, Eye, EyeOff } from 'lucide-react';
import { type DragEvent, useState } from 'react';

import type { Picked } from './EditorOverlay';
import { type EditNode, type EditTree, keyOf } from './tree';

/** What the drag of a row carries: its template and key. */
const ROW_MIME = 'application/x-turbo-window-row';

/** The window types that hold others, which a row dropped on its middle goes inside. */
const HOLDERS = /container|region|frame|border|itemlist|itemgrid|scrollable|header|tab_context|tab_content|selector|widget|bubble/;

export type DropWhere = 'before' | 'after' | 'last';

interface HierarchyProps {
    trees: readonly { tree: EditTree; label: string }[];
    selected: readonly Picked[];
    canEdit: boolean;
    onSelect: (picked: Picked, additive: boolean) => void;
    onHidden: (tree: EditTree, node: EditNode, hidden: boolean) => void;
    onMove: (tree: EditTree, node: EditNode, where: DropWhere, to: EditNode) => void;
}

const labelOf = (node: EditNode, key: string | undefined, owner: string) => {
    if (key === '') return 'the window';

    const name = node.name?.startsWith(`${owner}:`) ? node.name.slice(owner.length + 1) : node.name;

    return name ?? node.caption?.replace(/^\$\{(.+)\}$/, '$1') ?? key ?? node.tag;
};

/**
 * The window as a tree, the parts drawn inside it under it: each element with a box to show or hide
 * it, picked with a click (shift / ctrl adds it), dragged onto another row to go before it, after it
 * (its top or bottom edge) or inside it (its middle, a holder's). Hidden ones and the ones the
 * theme added are marked; the picked ones are those the preview outlines.
 */
export const Hierarchy = ({ trees, selected, canEdit, onSelect, onHidden, onMove }: HierarchyProps) => {
    const [ closed, setClosed ] = useState<Set<string>>(() => new Set());
    const [ over, setOver ] = useState<{ row: string; where: DropWhere } | null>(null);

    const whereOf = (event: DragEvent<HTMLElement>, node: EditNode): DropWhere => {
        const box = event.currentTarget.getBoundingClientRect();
        const at = (event.clientY - box.top) / box.height;

        if (HOLDERS.test(node.tag) && (at > 0.3) && (at < 0.7)) return 'last';

        return at < 0.5 ? 'before' : 'after';
    };

    const rows = (tree: EditTree, nodes: readonly EditNode[], depth: number) => nodes.map((node) => {
        const key = keyOf(tree.roots, node);
        const row = `${tree.template}|${key ?? node.uid}`;
        const isSelected = key !== undefined && selected.some(each => (each.template === tree.template) && (each.key === key));
        const open = !closed.has(row);
        const dropping = over?.row === row ? over.where : null;

        return (
            <li key={node.uid} role="treeitem" aria-selected={isSelected} aria-expanded={node.children.length ? open : undefined}>
                <div
                    data-row={key}
                    data-template={tree.template}
                    draggable={canEdit && (key !== undefined) && (key !== '')}
                    onDragStart={(event) => {
                        event.dataTransfer.setData(ROW_MIME, row);
                        event.dataTransfer.effectAllowed = 'move';
                    }}
                    onDragOver={(event) => {
                        if (!event.dataTransfer.types.includes(ROW_MIME) || (key === undefined)) return;

                        event.preventDefault();
                        setOver({ row, where: (key === '') ? 'last' : whereOf(event, node) });
                    }}
                    onDragLeave={() => setOver(previous => (previous?.row === row ? null : previous))}
                    onDrop={(event) => {
                        const from = event.dataTransfer.getData(ROW_MIME);

                        setOver(null);

                        if (!from || (key === undefined)) return;

                        event.preventDefault();

                        const [ template, ...rest ] = from.split('|');
                        const fromKey = rest.join('|');
                        const moved = (template === tree.template) ? findKeyed(tree, fromKey) : undefined;

                        if (moved && (moved !== node)) onMove(tree, moved, (key === '') ? 'last' : whereOf(event, node), node);
                    }}
                    onClick={event => (key !== undefined) && onSelect({ template: tree.template, key }, event.shiftKey || event.ctrlKey || event.metaKey)}
                    className={`group flex h-6 cursor-default items-center gap-1 rounded pr-1 text-xs ${isSelected ? 'bg-accent-soft text-accent' : 'hover:bg-subtle'} ${dropping === 'before' ? 'border-t-2 border-accent' : dropping === 'after' ? 'border-b-2 border-accent' : dropping === 'last' ? 'outline outline-2 outline-accent' : ''}`}
                    style={{ paddingLeft: depth * 12 }}
                >
                    <button
                        type="button"
                        aria-label={open ? 'Fold' : 'Unfold'}
                        className={`grid size-4 place-items-center text-muted ${node.children.length ? '' : 'invisible'}`}
                        onClick={(event) => {
                            event.stopPropagation();
                            setClosed((previous) => {
                                const next = new Set(previous);

                                if (next.has(row)) next.delete(row);
                                else next.add(row);

                                return next;
                            });
                        }}
                    >
                        {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
                    </button>
                    {key !== '' && (
                        <label className="grid size-4 place-items-center" title={node.hidden ? 'Hidden: show it' : 'Shown: hide it'} onClick={event => event.stopPropagation()}>
                            <input type="checkbox" aria-label={`Show ${labelOf(node, key, tree.owner)}`} className="sr-only" checked={!node.hidden} disabled={!canEdit || (key === undefined)} onChange={event => onHidden(tree, node, !event.target.checked)} />
                            {node.hidden ? <EyeOff className="size-3.5 text-muted" /> : <Eye className="size-3.5 opacity-60 group-hover:opacity-100" />}
                        </label>
                    )}
                    <span className={`truncate ${node.hidden ? 'text-muted line-through' : ''}`}>{labelOf(node, key, tree.owner)}</span>
                    <span className="ml-auto shrink-0 font-mono text-[10px] text-muted">{node.tag}</span>
                    {node.insertedAt !== undefined && <span className="shrink-0 rounded bg-good-soft px-1 text-[10px] text-good">new</span>}
                </div>
                {node.children.length > 0 && open && <ul role="group">{rows(tree, node.children, depth + 1)}</ul>}
            </li>
        );
    });

    return (
        <div className="flex flex-col gap-2" aria-label="Hierarchy">
            {trees.map(({ tree, label }) => (
                <section key={tree.template} aria-label={`Tree of ${label.toLowerCase()}`}>
                    <h3 className="mb-0.5 truncate text-[11px] font-medium tracking-wide text-muted uppercase" title={tree.template}>{label}</h3>
                    <ul role="tree" aria-label={label}>{rows(tree, tree.roots, 0)}</ul>
                </section>
            ))}
        </div>
    );
};

const findKeyed = (tree: EditTree, key: string): EditNode | undefined => {
    const visit = (nodes: readonly EditNode[]): EditNode | undefined => {
        for (const node of nodes) {
            if (keyOf(tree.roots, node) === key) return node;

            const found = visit(node.children);

            if (found) return found;
        }

        return undefined;
    };

    return visit(tree.roots);
};

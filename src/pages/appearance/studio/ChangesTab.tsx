import { CornerDownRight, RotateCcw, Undo2 } from 'lucide-react';

import type { HotelPatch, PluginStyle } from '#/api/noCode';
import type { TemplateIndex } from '#/api/windows';
import { windowOfStyle } from '#/appearance/styleValues';
import { Badge, EmptyState, IconButton } from '#/components/ui';

import { type StudioDraft, useStudio } from './studio';
import type { StudioWindow } from './windows';

/** One change of the theme: what it is, whether it is saved, and how to take it back. */
interface Change {
    id: string;
    what: string;
    detail: string;
    unsaved: boolean;
    /** Drops the draft's change: the saved state again. */
    drop?: () => void;
    /** Takes the saved change away (on Save): Habbo's own, or the default, again. */
    revert?: () => void;
}

/** The window a template's patch is seen in: its own, or the first window the part is drawn inside. */
const windowOfTemplate = (index: TemplateIndex, windows: readonly StudioWindow[], template: string) => windows.find(window => window.id === template)?.id
    ?? index.parts?.[template]?.windows[0]
    ?? windows.find(window => window.parts.includes(template))?.id
    ?? null;

const opsCount = (ops: unknown) => (Array.isArray(ops) ? ops.length : 0);

/**
 * The theme's changes by window (XenForo's "modified in this style", with a revert per change): its
 * saved patches and style values and the unsaved draft, each with a jump to its window and a way
 * back. Taking a saved change back is a change too: unsaved until Save, undone with Undo.
 */
export const ChangesTab = ({ index, windows, patches, draft, onJump }: { index: TemplateIndex; windows: readonly StudioWindow[]; patches: readonly HotelPatch[]; draft: StudioDraft; onJump: (window: string) => void }) => {
    const studio = useStudio();
    const groups = new Map<string, Change[]>();
    const add = (window: string | null, change: Change) => groups.set(window ?? '', [ ...(groups.get(window ?? '') ?? []), change ]);
    const templates = new Set([ ...patches.map(patch => patch.template), ...Object.keys(draft.patches) ]);
    const nameOf = (id: string) => windows.find(window => window.id === id)?.name ?? id;

    for (const template of templates) {
        const saved = patches.filter(patch => patch.template === template);
        const changed = draft.patches[template];
        const window = windowOfTemplate(index, windows, template);
        const part = window !== template;

        add(window, {
            id: `patch:${template}`,
            what: part ? `${template.split('/').pop()} (drawn inside)` : 'The window',
            detail: changed
                ? (changed.length ? `${changed.length} change(s), unsaved` : 'Back to Habbo\'s own on Save')
                : `${saved.reduce((sum, patch) => sum + opsCount(patch.ops), 0)} change(s)${saved.some(patch => patch.disabled) ? ', some off' : ''}`,
            unsaved: changed !== undefined,
            drop: changed !== undefined ? () => studio.changeOps(template, undefined) : undefined,
            revert: saved.length && (changed === undefined || changed.length) ? () => studio.changeOps(template, []) : undefined,
        });
    }

    for (const style of studio.styles as readonly PluginStyle[]) {
        const inDraft = style.name in draft.styles;

        if (!style.changed && !inDraft) continue;

        const target = windowOfStyle(index, style) ?? null;

        add(target && windows.some(window => window.id === target) ? target : null, {
            id: `style:${style.name}`,
            what: style.label ?? style.name,
            detail: inDraft ? (draft.styles[style.name] === null ? `back to ${style.default ?? 'Habbo\'s own'} on Save` : `${draft.styles[style.name]}, unsaved`) : (style.value ?? ''),
            unsaved: inDraft,
            drop: inDraft ? () => studio.setStyle(style.name, undefined) : undefined,
            revert: style.changed && draft.styles[style.name] !== null ? () => studio.setStyle(style.name, null) : undefined,
        });
    }

    for (const [ key, value ] of Object.entries(draft.texts)) add(null, { id: `text:${key}`, what: `Text ${key}`, detail: `${value}, unsaved`, unsaved: true, drop: () => studio.setText(key, undefined) });
    for (const [ key, url ] of Object.entries(draft.overlays)) add(null, { id: `art:${key}`, what: `Art of ${key.split('/').pop()}`, detail: url === null ? 'the library\'s own again on Save' : 'new art, unsaved', unsaved: true, drop: () => studio.setOverlay(key, undefined) });

    if (!groups.size) return <EmptyState>This theme changes nothing yet: pick a window and click what to change.</EmptyState>;

    const order = [ ...groups.keys() ].sort((a, b) => (a === '') ? 1 : (b === '') ? -1 : nameOf(a).localeCompare(nameOf(b)));

    return (
        <div className="flex flex-col">
            {order.map(window => (
                <section key={window} aria-label={window ? nameOf(window) : 'Theme settings and texts'} className="border-b border-line">
                    <div className="sticky top-0 z-10 flex items-center gap-1 bg-surface px-3 py-1.5">
                        <h3 className="truncate text-xs font-medium text-muted uppercase">{window ? nameOf(window) : 'Theme settings and texts'}</h3>
                        {window && <IconButton label={`Show ${nameOf(window)}`} icon={<CornerDownRight />} small className="ml-auto" onClick={() => onJump(window)} />}
                    </div>
                    <ul className="divide-y divide-line">
                        {groups.get(window)!.map(change => (
                            <li key={change.id} className="flex items-center gap-2 px-3 py-1.5 text-[13px]" data-change={change.id}>
                                <span className="flex min-w-0 flex-1 flex-col">
                                    <span className="flex items-center gap-1.5">
                                        <span className="truncate">{change.what}</span>
                                        {change.unsaved && <Badge tone="amber">unsaved</Badge>}
                                    </span>
                                    <span className="truncate text-xs text-muted">{change.detail}</span>
                                </span>
                                {studio.canManage && change.drop && <IconButton label="Drop the unsaved change" icon={<Undo2 />} small onClick={change.drop} />}
                                {studio.canManage && change.revert && <IconButton label="Revert: Habbo's own (or the default) again, on Save" icon={<RotateCcw />} small onClick={change.revert} />}
                            </li>
                        ))}
                    </ul>
                </section>
            ))}
        </div>
    );
};

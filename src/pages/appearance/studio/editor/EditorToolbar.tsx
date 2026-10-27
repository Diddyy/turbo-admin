import { AlignCenterHorizontal, AlignCenterVertical, AlignEndHorizontal, AlignEndVertical, AlignHorizontalDistributeCenter, AlignStartHorizontal, AlignStartVertical, AlignVerticalDistributeCenter, ClipboardPaste, Copy, CopyPlus, Grid3x3, Magnet, Tag, Trash2, Type } from 'lucide-react';

import { IconButton, Select } from '#/components/ui';

import { PALETTE_MIME } from './EditorOverlay';
import { PALETTE, type WindowEditor } from './useWindowEditor';

const GRIDS = [ 0, 2, 5, 8, 10, 16, 20 ];

export interface EditorView {
    rects: boolean;
    names: boolean;
    tags: boolean;
    snapToOthers: boolean;
}

const Toggle = ({ label, on, icon, onChange }: { label: string; on: boolean; icon: React.ReactNode; onChange: (on: boolean) => void }) => (
    <button
        type="button"
        aria-pressed={on}
        title={label}
        aria-label={label}
        onClick={() => onChange(!on)}
        className={`grid size-8 place-items-center rounded-lg border [&>svg]:size-4 ${on ? 'border-accent bg-accent-soft text-accent' : 'border-transparent text-muted hover:border-line hover:bg-subtle'}`}
    >
        {icon}
    </button>
);

/**
 * The window editor's tools over the preview: align the picked elements (edges, centres), spread them
 * evenly, duplicate / copy / paste / delete, the grid moves snap to and snapping to the others, the
 * debug drawing, and the palette - each entry dragged into the window to add it there.
 */
export const EditorToolbar = ({ editor, view, onView, canEdit }: { editor: WindowEditor; view: EditorView; onView: (view: EditorView) => void; canEdit: boolean }) => {
    const count = editor.selected.filter(each => each.key !== '').length;

    return (
        <div className="flex flex-col gap-1.5" aria-label="Window editor">
            <div role="toolbar" aria-label="Arrange" className="flex flex-wrap items-center gap-0.5">
                <IconButton label="Align left edges" icon={<AlignStartVertical />} small disabled={!canEdit || count < 2} onClick={() => editor.align('left')} />
                <IconButton label="Align centres across" icon={<AlignCenterVertical />} small disabled={!canEdit || count < 2} onClick={() => editor.align('centerH')} />
                <IconButton label="Align right edges" icon={<AlignEndVertical />} small disabled={!canEdit || count < 2} onClick={() => editor.align('right')} />
                <IconButton label="Align top edges" icon={<AlignStartHorizontal />} small disabled={!canEdit || count < 2} onClick={() => editor.align('top')} />
                <IconButton label="Align centres down" icon={<AlignCenterHorizontal />} small disabled={!canEdit || count < 2} onClick={() => editor.align('centerV')} />
                <IconButton label="Align bottom edges" icon={<AlignEndHorizontal />} small disabled={!canEdit || count < 2} onClick={() => editor.align('bottom')} />
                <IconButton label="Spread evenly across" icon={<AlignHorizontalDistributeCenter />} small disabled={!canEdit || count < 3} onClick={() => editor.distribute('h')} />
                <IconButton label="Spread evenly down" icon={<AlignVerticalDistributeCenter />} small disabled={!canEdit || count < 3} onClick={() => editor.distribute('v')} />
                <span className="mx-1 h-5 w-px bg-line" />
                <IconButton label="Duplicate (Ctrl+D)" icon={<CopyPlus />} small disabled={!canEdit || !count} onClick={editor.duplicate} />
                <IconButton label="Copy (Ctrl+C)" icon={<Copy />} small disabled={!count} onClick={editor.copy} />
                <IconButton label="Paste (Ctrl+V)" icon={<ClipboardPaste />} small disabled={!canEdit || !editor.canPaste} onClick={editor.paste} />
                <IconButton label="Delete (Del)" icon={<Trash2 />} small tone="bad" disabled={!canEdit || !count} onClick={editor.remove} />
                <span className="mx-1 h-5 w-px bg-line" />
                <label className="inline-flex items-center gap-1 text-xs text-muted" title="Moves and resizes land on this grid">
                    <Grid3x3 className="size-4" />
                    <Select aria-label="Grid" value={String(editor.grid)} className="h-7 w-auto py-0 text-xs" onChange={event => editor.setGrid(Number(event.target.value))}>
                        {GRIDS.map(grid => <option key={grid} value={grid}>{grid ? `${grid} px` : 'No grid'}</option>)}
                    </Select>
                </label>
                <Toggle label="Snap to the other elements" on={view.snapToOthers} icon={<Magnet />} onChange={on => onView({ ...view, snapToOthers: on })} />
                <span className="mx-1 h-5 w-px bg-line" />
                <Toggle label="Debug rects: every element's box" on={view.rects} icon={<Grid3x3 />} onChange={on => onView({ ...view, rects: on })} />
                <Toggle label="Show names" on={view.names} icon={<Type />} onChange={on => onView({ ...view, names: on })} />
                <Toggle label="Show types and tags" on={view.tags} icon={<Tag />} onChange={on => onView({ ...view, tags: on })} />
                <span className="ml-2 text-xs text-muted" aria-live="polite">{count ? `${count} picked` : 'Click, shift-click or draw a box to pick'}</span>
            </div>
            {canEdit && (
                <div role="toolbar" aria-label="Add" className="flex flex-wrap items-center gap-1">
                    <span className="text-xs text-muted">Drag into the window:</span>
                    {PALETTE.map(entry => (
                        <span
                            key={entry.kind}
                            role="button"
                            tabIndex={0}
                            draggable
                            data-palette={entry.kind}
                            title={entry.hint}
                            onDragStart={(event) => {
                                event.dataTransfer.setData(PALETTE_MIME, entry.kind);
                                event.dataTransfer.effectAllowed = 'copy';
                            }}
                            className="cursor-grab rounded-md border border-line bg-canvas px-2 py-0.5 text-xs hover:border-accent active:cursor-grabbing"
                        >
                            {entry.label}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
};

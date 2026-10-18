import { CheckCircle2, ChevronDown, History, Redo2, Send, Trash2, Undo2, Wand2 } from 'lucide-react';
import { type ReactNode, type Ref, useEffect, useRef, useState } from 'react';

import type { CatalogHistory } from '#/api/catalog';
import { Button } from '#/components/ui';
import { cx } from '#/lib/cx';

import { stepLabel } from './labels';

const ago = (utc: string) => {
    const seconds = Math.max(0, Math.round((Date.now() - new Date(utc).getTime()) / 1000));

    if (seconds < 60)
        return 'just now';

    if (seconds < 3600)
        return `${Math.floor(seconds / 60)} min ago`;

    return new Date(utc).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const IconAction = ({ label, title, disabled, onClick, children }: { label: string; title: string; disabled: boolean; onClick: () => void; children: ReactNode }) => (
    <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        title={title}
        className="grid size-10 place-items-center rounded-lg border border-line bg-subtle text-ink transition hover:border-muted/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-50 sm:size-8 [&>svg]:size-4"
    >
        {children}
    </button>
);

interface ChangesBarProps {
    history: CatalogHistory | undefined;
    unpublished: number;
    busy: boolean;
    onUndo: (steps: number) => void;
    onRedo: (steps: number) => void;
    onDiscard: () => void;
    onPublish: () => void;
    /** Opens the page builder, onto the open page or a new one. */
    onBuild: () => void;
    publishRef: Ref<HTMLDivElement>;
}

/**
 * What is waiting to go live, along the top of the editor: how many changes, the last of them, and
 * undoing and redoing them (Ctrl+Z, Ctrl+Shift+Z) one at a time or back to any point in the list;
 * throwing them all away, so the saved catalog is the one players have; and publishing them.
 */
export const ChangesBar = ({ history, unpublished, busy, onUndo, onRedo, onDiscard, onPublish, onBuild, publishRef }: ChangesBarProps) => {
    const [ open, setOpen ] = useState(false);
    const box = useRef<HTMLDivElement>(null);
    const undo = history?.undo ?? [];
    const redo = history?.redo ?? [];
    const last = undo[0];

    useEffect(() => {
        if (!open)
            return;

        const close = (event: MouseEvent) => {
            if (!box.current?.contains(event.target as Node))
                setOpen(false);
        };

        document.addEventListener('mousedown', close);

        return () => document.removeEventListener('mousedown', close);
    }, [ open ]);

    return (
        <div className={cx('flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2', unpublished > 0 ? 'border-accent/40 bg-accent-soft/40' : 'border-line bg-surface')}>
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
                {unpublished > 0
                    ? <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent font-mono text-xs font-bold text-on-accent tabular-nums">{unpublished > 99 ? '99+' : unpublished}</span>
                    : <CheckCircle2 className="size-5 shrink-0 text-good" />}
                <div className="min-w-0 text-sm">
                    <div className="truncate font-medium">
                        {unpublished > 0 ? `${unpublished} ${unpublished === 1 ? 'change' : 'changes'} waiting to go live` : 'Everything is live'}
                    </div>
                    <div className="truncate text-xs text-muted">
                        {last ? `Last: ${stepLabel(last)} · ${ago(last.atUtc)}` : unpublished > 0 ? 'Saved before the server last started, or limited series: these can\'t be undone.' : 'Edits are saved as you make them and go live when you publish.'}
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-1.5">
                <IconAction label="Undo" title={last ? `Undo: ${stepLabel(last)} (Ctrl+Z)` : 'Nothing to undo'} disabled={busy || undo.length === 0} onClick={() => onUndo(1)}>
                    <Undo2 />
                </IconAction>
                <IconAction label="Redo" title={redo[0] ? `Redo: ${stepLabel(redo[0])} (Ctrl+Shift+Z)` : 'Nothing to redo'} disabled={busy || redo.length === 0} onClick={() => onRedo(1)}>
                    <Redo2 />
                </IconAction>
                <div ref={box} className="relative">
                    <button
                        type="button"
                        onClick={() => setOpen(!open)}
                        disabled={undo.length + redo.length === 0}
                        aria-expanded={open}
                        className="flex h-10 items-center gap-1 rounded-lg border border-line bg-subtle px-2.5 text-sm text-ink sm:text-[13px] transition hover:border-muted/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-50 sm:h-8 [&>svg]:size-4"
                    >
                        <History />
                        <span className="max-sm:hidden">History</span>
                        <ChevronDown className="!size-3.5 text-muted" />
                    </button>
                    {open && (
                        <div className="absolute top-full right-0 z-40 mt-2 w-[min(24rem,calc(100vw-2rem))] animate-rise overflow-hidden rounded-xl border border-line bg-surface shadow-xl">
                            <div className="max-h-[50dvh] overflow-y-auto py-1">
                                {[ ...redo ].reverse().map((item, i, list) => (
                                    <button
                                        key={`redo-${i}`}
                                        type="button"
                                        disabled={busy}
                                        onClick={() => {
                                            setOpen(false);
                                            onRedo(list.length - i);
                                        }}
                                        className="flex w-full items-start gap-2.5 px-3 py-2 text-left text-sm text-muted hover:bg-subtle"
                                        title="Redo up to here"
                                    >
                                        <Redo2 className="mt-0.5 size-3.5 shrink-0" />
                                        <span className="min-w-0 flex-1 truncate line-through decoration-muted/50">{stepLabel(item)}</span>
                                        <span className="shrink-0 text-[11px]">undone</span>
                                    </button>
                                ))}
                                {undo.map((item, i) => (
                                    <button
                                        key={`undo-${i}`}
                                        type="button"
                                        disabled={busy}
                                        onClick={() => {
                                            setOpen(false);
                                            onUndo(i + 1);
                                        }}
                                        className={cx('flex w-full items-start gap-2.5 px-3 py-2 text-left text-sm hover:bg-subtle', i === 0 && 'bg-accent-soft/40')}
                                        title={i === 0 ? 'Undo this' : `Undo this and the ${i} after it`}
                                    >
                                        <Undo2 className="mt-0.5 size-3.5 shrink-0 text-muted" />
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate">{stepLabel(item)}</span>
                                            <span className="block text-[11px] text-muted">
                                                {ago(item.atUtc)}
                                                {item.edits > 1 && ` · ${item.edits} edits`}
                                            </span>
                                        </span>
                                    </button>
                                ))}
                            </div>
                            {history?.truncated && <p className="border-t border-line px-3 py-2 text-[11px] text-muted">Older steps were let go and can't be undone.</p>}
                        </div>
                    )}
                </div>
                <Button variant="ghost" icon={<Trash2 />} disabled={busy || undo.length === 0} onClick={onDiscard} title="Undo every change since the last publish" className="text-bad hover:text-bad">
                    <span className="max-sm:hidden">Discard</span>
                </Button>
                <Button variant="secondary" icon={<Wand2 />} disabled={busy} onClick={onBuild} title="Fill the open page, or a new one, from the hotel's furniture, pets and effects">
                    Build
                </Button>
                <div ref={publishRef}>
                    <Button icon={<Send />} variant={unpublished > 0 ? 'primary' : 'secondary'} disabled={busy} onClick={onPublish}>
                        Publish
                    </Button>
                </div>
            </div>
        </div>
    );
};

import { ChevronDown, ChevronRight, Download, RefreshCw } from 'lucide-react';
import { type ReactNode, useState } from 'react';

import { type FurnitureFieldChange, IMPORT_ACTIONS, useCheckHabbo, useImportJob } from '#/api/gamedata';
import { ask, type Question } from '#/components/confirm';
import { Badge, type BadgeTone, Button, ErrorNotice, Label, Loading, Panel, WarningNotice } from '#/components/ui';
import { cx } from '#/lib/cx';
import { fromNow } from '#/lib/time';

import { JobProgress } from './JobProgress';
import { showValue } from './labels';

const ACTION_TONES: Record<string, BadgeTone> = { add: 'green', update: 'accent', keep: 'amber' };

/** An import's action as its badge. */
export const ActionBadge = ({ action }: { action: number }) => {
    const name = IMPORT_ACTIONS[action] ?? String(action);

    return <Badge tone={ACTION_TONES[name] ?? 'neutral'}>{name}</Badge>;
};

/** The fields an import changes: Habbo's new value, or the hotel's kept over it. */
export const FieldChanges = ({ fields }: { fields: FurnitureFieldChange[] }) => (
    <ul className="flex flex-col gap-0.5 font-mono text-xs">
        {fields.map(field => (
            <li key={field.field} className={cx('break-all', field.kept ? 'text-warn' : 'text-muted')}>
                <span className="text-ink">{field.field}</span>{' '}
                {showValue(field.current)} {field.kept ? '· kept, Habbo has ' : '→ '}
                <span className={field.kept ? undefined : 'text-ink'}>{showValue(field.incoming)}</span>
            </li>
        ))}
    </ul>
);

interface Counts {
    added: number;
    updated: number;
    kept: number;
    unchanged: number;
    truncated: boolean;
}

interface HabboUpdateProps {
    /** What it is Habbo's of: furniture, product data... */
    title: string;
    /** The version Habbo serves now: its name and what it holds; null before Habbo was checked. */
    version: { name: string; holds: string; foundAt: string; importedAt: string | null } | null;
    /** What taking it in would do; undefined while it is worked out. */
    preview: (Counts & { listed: number }) | undefined;
    error: unknown;
    /** Something else taking it in does, beside the counts. */
    extra?: ReactNode;
    /** The job's file, to show its progress here and nowhere else. */
    file: string;
    canManage: boolean;
    /** Whether there is anything to take in at all. */
    canTake: boolean;
    /** Whether Take in waits for something besides that: a pick of none. */
    takeDisabled?: boolean;
    /** What to ask before taking it in; its button says "Take in". */
    confirm: Pick<Question, 'title' | 'body'>;
    onTake: () => void;
    taking: boolean;
    takeError: unknown;
    /** The changes, one per line, shown when reviewed. */
    children: ReactNode;
    /** Start with the changes shown, as the Updates tab does. */
    defaultOpen?: boolean;
}

/**
 * Habbo's newest version of a file, in one bar: whether the hotel has it all, what taking it in
 * would add, update and keep, the changes to review, and taking it in. Every data tab heads with
 * one, so each reads the same way.
 */
export const HabboUpdate = ({ title, version, preview, error, extra, file, canManage, canTake, takeDisabled = false, confirm, onTake, taking, takeError, children, defaultOpen = false }: HabboUpdateProps) => {
    const [ open, setOpen ] = useState(defaultOpen);
    const check = useCheckHabbo();
    const { data: jobData } = useImportJob();
    const job = jobData?.job?.file === file ? jobData.job : null;
    const running = (jobData?.job?.phase ?? 2) < 2;

    if (!version)
        return (
            <Panel>
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                    <span className="text-muted">Habbo hasn't been checked yet, so there is nothing of Habbo's {title.toLowerCase()} to take in.</span>
                    {canManage && <Button variant="secondary" icon={<RefreshCw />} disabled={check.isPending} onClick={() => check.mutate()}>{check.isPending ? 'Checking' : 'Check Habbo'}</Button>}
                </div>
                {check.error && <div className="px-4 pb-3"><ErrorNotice error={check.error} /></div>}
            </Panel>
        );

    const pending = preview ? preview.added + preview.updated + preview.kept : 0;
    const upToDate = preview !== undefined && !canTake;

    return (
        <Panel>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                <div className="min-w-0 flex-[1_1_16rem]">
                    <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-[13px] font-semibold tracking-wide">Habbo's {title}</h2>
                        {!preview && !error && <Badge>checking</Badge>}
                        {upToDate && <Badge tone="green">up to date</Badge>}
                        {preview && !upToDate && <Badge tone="amber">{version.importedAt ? 'changes waiting' : 'not taken in'}</Badge>}
                    </div>
                    <div className="mt-0.5 truncate font-mono text-[11px] text-muted">
                        {version.name} · {version.holds} · found {fromNow(version.foundAt)}{version.importedAt ? ` · taken in ${fromNow(version.importedAt)}` : ''}
                    </div>
                </div>
                {preview && !upToDate && (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs text-muted tabular-nums">
                        <span><span className="text-good">+{preview.added.toLocaleString()}</span> added</span>
                        <span><span className="text-accent">{preview.updated.toLocaleString()}</span> updated</span>
                        {preview.kept > 0 && <span><span className="text-warn">{preview.kept.toLocaleString()}</span> kept as yours</span>}
                        {extra}
                    </div>
                )}
                <div className="flex items-center gap-2">
                    {preview && preview.listed > 0 && (
                        <Button variant="ghost" icon={open ? <ChevronDown /> : <ChevronRight />} onClick={() => setOpen(!open)}>
                            Review
                        </Button>
                    )}
                    {canManage && preview && !upToDate && (
                        <Button
                            icon={<Download />}
                            disabled={taking || running || !canTake || takeDisabled}
                            onClick={() => ask({ ...confirm, confirm: 'Take in', danger: false }, onTake)}
                        >
                            {running && job ? 'Taking in' : 'Take in'}
                        </Button>
                    )}
                </div>
            </div>
            {error !== null && error !== undefined && <div className="border-t border-line p-4"><ErrorNotice error={error} /></div>}
            {takeError !== null && takeError !== undefined && <div className="border-t border-line p-4"><ErrorNotice error={takeError} /></div>}
            {job && <div className="border-t border-line"><JobProgress job={job} /></div>}
            {open && preview && (
                <div className="border-t border-line">
                    {preview.truncated && <div className="p-3"><WarningNotice>Only the first {preview.listed.toLocaleString()} of {pending.toLocaleString()} are listed.</WarningNotice></div>}
                    <ul className="max-h-96 divide-y divide-line overflow-y-auto text-sm">{children}</ul>
                </div>
            )}
            {!preview && !error && <div className="border-t border-line"><Loading /></div>}
        </Panel>
    );
};

/** One change in a review: its badge, what it is, and what changes. */
export const ReviewItem = ({ action, name, kind, children }: { action: number; name: ReactNode; kind?: ReactNode; children?: ReactNode }) => (
    <li className="grid gap-x-3 gap-y-1 px-4 py-2.5 sm:grid-cols-[5.5rem_minmax(10rem,1fr)_2fr]">
        <span><ActionBadge action={action} /></span>
        <span className="min-w-0 truncate font-mono text-xs">
            {name}
            {kind && <span className="ml-2 text-muted">{kind}</span>}
        </span>
        <div className="min-w-0">{children}</div>
    </li>
);

/**
 * A row of a list that opens in place to edit what it is: one open at a time, chosen by the
 * list. Closed it is a summary, a line a hand can hit; open, its editor under it.
 */
export const OpenRow = ({ open, onToggle, summary, children }: { open: boolean; onToggle: () => void; summary: ReactNode; children: ReactNode }) => (
    <li className={cx(open && 'bg-subtle/40')}>
        <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-subtle/60 [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-muted"
        >
            {open ? <ChevronDown /> : <ChevronRight />}
            <div className="min-w-0 flex-1">{summary}</div>
        </button>
        {open && <div className="border-t border-line px-4 py-4 sm:pl-11">{children}</div>}
    </li>
);

/** Habbo's value beside one the hotel changed, with a way to put Habbo's back. */
export const HabboDiffers = ({ habbo, onUse, canManage }: { habbo: ReactNode; onUse: () => void; canManage: boolean }) => (
    <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-warn">Habbo: {habbo}</span>
        {canManage && <button type="button" onClick={onUse} className="font-medium text-accent hover:underline">Use Habbo's</button>}
    </div>
);

/** A small heading over a group of fields in an editor. */
export const FieldGroup = ({ title, children, className }: { title: string; children: ReactNode; className?: string }) => (
    <section className={cx('flex flex-col gap-3', className)}>
        <Label as="h3">{title}</Label>
        {children}
    </section>
);

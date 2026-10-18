import { ChevronDown, ChevronLeft, ChevronRight, Undo2 } from 'lucide-react';
import { useState } from 'react';

import { CHANGE_KINDS, type ChangeSet, RECORD_TYPES, useChanges, useHistory, useRollback } from '#/api/gamedata';
import { ask } from '#/components/confirm';
import { Badge, type BadgeTone, Button, EmptyState, ErrorNotice, Loading, Panel, SuccessNotice, WarningNotice } from '#/components/ui';
import { cx } from '#/lib/cx';
import { fromNow } from '#/lib/time';

import { showValue } from './labels';

const KIND_TONES: Record<string, BadgeTone> = { import: 'accent', edit: 'green', rollback: 'amber', 'habbo values': 'accent' };

/** The hotel's own records; Habbo's as taken in are only the base the next import compares with. */
const HOTEL_RECORDS = new Set([ 0, 2, 4, 6 ]);

/** A change's fields that differ, before and after, from the JSON objects the server keeps. */
const fieldsOf = (before: string | null, after: string | null) => {
    const parse = (json: string | null) => {
        if (!json)
            return {} as Record<string, unknown>;

        try {
            return JSON.parse(json) as Record<string, unknown>;
        } catch {
            return {} as Record<string, unknown>;
        }
    };

    const was = parse(before);
    const now = parse(after);

    return [ ...new Set([ ...Object.keys(was), ...Object.keys(now) ]) ]
        .map(key => ({
            key,
            before: key in was ? JSON.stringify(was[key]) : null,
            after: key in now ? JSON.stringify(now[key]) : null,
        }))
        .filter(field => field.before !== field.after);
};

const Changes = ({ set }: { set: ChangeSet }) => {
    const { data: changes, error } = useChanges(set.id);

    if (error)
        return <div className="p-4"><ErrorNotice error={error} /></div>;

    if (!changes)
        return <Loading />;

    const shown = changes.filter(change => HOTEL_RECORDS.has(change.recordType));

    if (shown.length === 0)
        return <EmptyState>Only Habbo's records as they were taken in changed.</EmptyState>;

    return (
        <ul className="max-h-[28rem] divide-y divide-line overflow-y-auto">
            {shown.map(change => (
                <li key={`${change.recordType}:${change.recordId}:${change.label}`} className="grid gap-x-4 gap-y-1 px-4 py-2.5 text-sm sm:grid-cols-[minmax(10rem,16rem)_1fr] sm:pl-11">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className="truncate font-mono text-[13px]">{change.label}</span>
                        <span className="text-[11px] text-muted">{RECORD_TYPES[change.recordType]}</span>
                    </div>
                    <div className="min-w-0">
                        {change.before === null && <Badge tone="green">made</Badge>}
                        {change.after === null && <Badge tone="red">removed</Badge>}
                        {change.before !== null && change.after !== null && (
                            <ul className="flex flex-col gap-0.5 font-mono text-xs text-muted">
                                {fieldsOf(change.before, change.after).map(field => (
                                    <li key={field.key} className="break-all">
                                        <span className="text-ink">{field.key}</span> {showValue(field.before)} → <span className="text-ink">{showValue(field.after)}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </li>
            ))}
        </ul>
    );
};

/** Every gamedata change, newest first; a set opens to its changes and rolls back as a whole. */
export const HistoryTab = ({ canManage }: { canManage: boolean }) => {
    const [ page, setPage ] = useState(0);
    const [ open, setOpen ] = useState<number | null>(null);
    const { data: sets, error, isFetching } = useHistory(page);
    const rollback = useRollback();

    return (
        <Panel
            className="overflow-clip"
            title="History"
            description="Imports, edits and rollbacks, newest first. Rolling back leaves anything changed again since as it is."
            actions={(
                <div className="flex items-center gap-1 text-xs text-muted">
                    <span className="mr-1 tabular-nums">Page {page + 1}</span>
                    <Button variant="ghost" icon={<ChevronLeft />} disabled={page === 0} onClick={() => setPage(page - 1)}>Newer</Button>
                    <Button variant="ghost" disabled={!sets || sets.length === 0} onClick={() => setPage(page + 1)}>
                        Older
                        <ChevronRight />
                    </Button>
                </div>
            )}
        >
            {error && <div className="p-4"><ErrorNotice error={error} /></div>}
            {rollback.error && <div className="border-b border-line p-4"><ErrorNotice error={rollback.error} /></div>}
            {rollback.data && (
                <div className="flex flex-col gap-2 border-b border-line p-4">
                    <SuccessNotice>{rollback.data.changeSet.summary}</SuccessNotice>
                    {rollback.data.skipped.length > 0 && <WarningNotice>Left as they are: {rollback.data.skipped.join(' ')}</WarningNotice>}
                </div>
            )}
            {!sets && !error && <Loading />}
            {sets?.length === 0 && <EmptyState>{page === 0 ? 'No gamedata changes yet.' : 'Nothing older.'}</EmptyState>}
            {sets && sets.length > 0 && (
                <ul className={cx('divide-y divide-line transition-opacity', isFetching && 'opacity-60')}>
                    {sets.map((set) => {
                        const kind = CHANGE_KINDS[set.kind] ?? String(set.kind);
                        const canRollBack = canManage && kind !== 'rollback' && set.rolledBackById === null;

                        return (
                            <li key={set.id} className={cx(open === set.id && 'bg-subtle/40')}>
                                <div className="flex flex-wrap items-center gap-x-2 pr-3 hover:bg-subtle/60">
                                    <button
                                        type="button"
                                        onClick={() => setOpen(open === set.id ? null : set.id)}
                                        aria-expanded={open === set.id}
                                        className="flex min-w-0 grow basis-full flex-wrap items-center sm:basis-0 gap-x-3 gap-y-1 px-4 py-2.5 text-left text-sm [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-muted"
                                    >
                                        {open === set.id ? <ChevronDown /> : <ChevronRight />}
                                        <Badge tone={KIND_TONES[kind] ?? 'neutral'} className="justify-center sm:min-w-24">{kind}</Badge>
                                        <span className={cx('min-w-0 flex-[1_1_16rem] truncate', set.rolledBackById !== null && 'text-muted line-through decoration-muted/50')}>{set.summary}</span>
                                        <span className="font-mono text-[11px] text-muted tabular-nums">#{set.id} · {set.changeCount.toLocaleString()} rows · {fromNow(set.createdAt)}</span>
                                    </button>
                                    {(set.rolledBackById !== null || canRollBack) && (
                                        // On a phone the actions go under the summary, in line with it.
                                        <span className="flex items-center gap-2 max-sm:pb-2 max-sm:pl-11">
                                            {set.rolledBackById !== null && <Badge tone="amber">undone by #{set.rolledBackById}</Badge>}
                                            {canRollBack && (
                                                <Button
                                                    variant="ghost"
                                                    icon={<Undo2 />}
                                                    disabled={rollback.isPending}
                                                    onClick={() => ask({ title: `Roll back #${set.id}?`, body: set.summary, confirm: 'Roll back' }, () => rollback.mutate(set.id))}
                                                >
                                                    Roll back
                                                </Button>
                                            )}
                                        </span>
                                    )}
                                </div>
                                {open === set.id && <div className="border-t border-line"><Changes set={set} /></div>}
                            </li>
                        );
                    })}
                </ul>
            )}
        </Panel>
    );
};

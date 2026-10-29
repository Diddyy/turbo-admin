import { RefreshCw, RotateCcw, X } from 'lucide-react';
import { useState } from 'react';

import { ApiError } from '#/api/client';
import { useVendingRepair, useVendingRepairPreview, type VendingRepairItem } from '#/api/gamedata';
import { ask } from '#/components/confirm';
import { Button, Checkbox, EmptyState, ErrorNotice, IconButton, Loading, Panel, SuccessNotice, WarningNotice } from '#/components/ui';

import { USAGE_POLICIES } from './fields';

const policyName = (value: number) => USAGE_POLICIES.find(policy => policy.value === value)?.label ?? `Unknown (${value})`;
const fieldsOf = (serialized: string) => {
    try {
        const value = JSON.parse(serialized) as { logic?: unknown; extradata?: unknown; usagepolicy?: unknown };
        return { logic: String(value.logic ?? 'unknown'), extradata: value.extradata == null ? null : String(value.extradata), usagepolicy: Number(value.usagepolicy) };
    } catch {
        return { logic: 'unreadable JSON', extradata: null, usagepolicy: Number.NaN };
    }
};

const RepairRow = ({ item, checked, useDefault, disabled, onCheck, onDefault }: {
    item: VendingRepairItem;
    checked: boolean;
    useDefault: boolean;
    disabled: boolean;
    onCheck: (checked: boolean) => void;
    onDefault: (checked: boolean) => void;
}) => {
    const before = fieldsOf(item.before);
    const after = item.after === null ? null : fieldsOf(item.after);
    const eligible = item.after !== null;
    const displayedAfter = after && useDefault
        ? JSON.stringify({ logic: after.logic, extradata: after.extradata, usagepolicy: item.defaultUsagePolicy }, null, 2)
        : item.after;

    return (
        <li className="space-y-2 border-b border-line p-3 last:border-0 sm:p-4">
            <div className="flex items-start gap-3">
                <label className="grid size-6 shrink-0 cursor-pointer place-items-center" title={`Select ${item.className} (ID ${item.id})`}>
                    <input
                        type="checkbox"
                        checked={checked}
                        onChange={event => onCheck(event.target.checked)}
                        disabled={!eligible || disabled}
                        aria-label={`Select ${item.className} (ID ${item.id})`}
                        className="size-4 accent-accent"
                    />
                </label>
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <strong className="break-all font-mono text-[13px]">{item.className}</strong>
                        <span className="font-mono text-xs text-muted">ID {item.id}</span>
                        {item.animates && <span className="text-xs text-muted">Animates</span>}
                    </div>
                    <p className="mt-1 text-xs text-muted">{eligible ? 'Proposed hand items' : 'Known hand items'}: {item.handItems.join(', ') || 'none'}</p>
                    {eligible
                        ? <p className="mt-1 text-xs">Logic: <code>{before.logic}</code> → <code>{after!.logic}</code></p>
                        : <WarningNotice>{item.reason || 'This row needs manual correction and cannot be repaired automatically.'}</WarningNotice>}
                    <p className="mt-1 text-xs text-muted">Access: {policyName(item.currentUsagePolicy)} → {policyName(useDefault ? item.defaultUsagePolicy : (after?.usagepolicy ?? item.currentUsagePolicy))}</p>
                </div>
            </div>
            {eligible && (
                <div className="pl-7">
                    <Checkbox
                        label={`Use default access: ${policyName(item.defaultUsagePolicy)}`}
                        checked={useDefault}
                        onChange={onDefault}
                        disabled={!checked || disabled}
                    />
                    <details className="mt-2 text-xs text-muted">
                        <summary className="cursor-pointer">Raw JSON details</summary>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                            <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-canvas p-2">Before: {item.before}</pre>
                            <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-canvas p-2">After: {displayedAfter}</pre>
                        </div>
                    </details>
                </div>
            )}
        </li>
    );
};

export const VendingRepairPanel = ({ onClose }: { onClose: () => void }) => {
    const [ page, setPage ] = useState(0);
    const [ selected, setSelected ] = useState<Record<number, { version: string; useDefaultUsagePolicy: boolean }>>({});
    const preview = useVendingRepairPreview(page);
    const repair = useVendingRepair();
    const items = preview.data?.items ?? [];
    const eligible = items.filter(item => item.after !== null);
    const currentPage = preview.data?.page ?? page;
    const changedSelection = Object.entries(selected).some(([ id, choice ]) => !items.some(item => item.id === Number(id) && item.version === choice.version));
    const stale = changedSelection || (repair.error instanceof ApiError && repair.error.status === 409);
    const changePage = (nextPage: number) => {
        setSelected({});
        setPage(nextPage);
    };
    const refresh = async () => {
        setSelected({});
        repair.reset();
        await preview.refetch();
    };
    const submit = () => {
        if (stale || repair.isPending || preview.isFetching) return;
        const choices = items.filter(item => selected[item.id]?.version === item.version).map(item => ({
            id: item.id,
            version: item.version,
            useDefaultUsagePolicy: selected[item.id]!.useDefaultUsagePolicy,
        }));
        if (!choices.length || choices.length > 100)
            return;
        ask({ title: `Repair ${choices.length} vending ${choices.length === 1 ? 'definition' : 'definitions'}?`, body: 'Only the selected definitions and access choice will be applied. The change can be rolled back from history.', confirm: 'Repair vending' }, () => {
            repair.mutate({ items: choices }, {
                onSuccess: () => setSelected({}),
                onError: (error) => {
                    if (error instanceof ApiError && error.status === 409)
                        setSelected({});
                },
            });
        });
    };

    return (
        <Panel
            title="Repair known vending"
            description="Preview known floor vending definitions missing hand items. Rows needing manual correction are shown but cannot be selected."
            actions={(
                <>
                    <Button variant="secondary" icon={<RefreshCw />} disabled={preview.isFetching || repair.isPending} onClick={() => void refresh()}>Refresh preview</Button>
                    <Button icon={<RotateCcw />} disabled={!Object.keys(selected).length || Object.keys(selected).length > 100 || stale || repair.isPending || preview.isFetching} onClick={submit}>Repair selected ({Object.keys(selected).length})</Button>
                    <IconButton label="Close" icon={<X />} onClick={onClose} />
                </>
            )}
        >
            {(preview.error || repair.error || stale) && (
                <div className="space-y-2 p-4">
                    {preview.error && <ErrorNotice error={preview.error} />}
                    {repair.error && <ErrorNotice error={repair.error} />}
                    {stale && <WarningNotice>The preview is out of date. Refresh it, review the current values, then select rows again before applying.</WarningNotice>}
                    {stale && <div><Button variant="secondary" icon={<RefreshCw />} onClick={() => void refresh()}>Get a fresh preview</Button></div>}
                </div>
            )}
            {repair.data && <div className="space-y-2 p-4"><SuccessNotice>{repair.data.changeSet?.summary ?? 'No definitions needed changes.'}</SuccessNotice><p className="text-xs text-muted">Loaded rooms use the new definitions when they reload. The change can be rolled back from history.</p></div>}
            {preview.isLoading && <Loading />}
            {preview.data && preview.data.total === 0 && <EmptyState>No known vending definitions need repair.</EmptyState>}
            {preview.data && items.length > 0 && (
                <>
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2 text-xs text-muted">
                        <span>{preview.data.total.toLocaleString()} definitions · {eligible.length} eligible on this page</span>
                        <div className="flex items-center gap-2">
                            <Button variant="ghost" disabled={currentPage <= 0 || preview.isFetching || repair.isPending} onClick={() => changePage(currentPage - 1)}>Previous</Button>
                            <span>Page {currentPage + 1} of {Math.max(1, Math.ceil(preview.data.total / preview.data.pageSize))}</span>
                            <Button variant="ghost" disabled={(currentPage + 1) * preview.data.pageSize >= preview.data.total || preview.isFetching || repair.isPending} onClick={() => changePage(currentPage + 1)}>Next</Button>
                        </div>
                        <Button
                            variant="ghost"
                            disabled={!eligible.length || eligible.length > 100 || repair.isPending || preview.isFetching || stale}
                            onClick={() => setSelected((current) => {
                                const allSelected = eligible.every(item => current[item.id]);
                                const next = { ...current };
                                eligible.forEach(item => allSelected ? delete next[item.id] : (next[item.id] ??= { version: item.version, useDefaultUsagePolicy: false }));
                                return next;
                            })}
                        >{eligible.every(item => selected[item.id]) ? 'Clear page selection' : 'Select eligible page'}
                        </Button>
                    </div>
                    <ul className={preview.isFetching ? 'opacity-60' : ''}>
                        {items.map(item => (
                            <RepairRow
                                key={item.id}
                                item={item}
                                disabled={repair.isPending || preview.isFetching || stale}
                                checked={!!selected[item.id]}
                                useDefault={!!selected[item.id]?.useDefaultUsagePolicy}
                                onCheck={checked => setSelected((current) => {
                                    const next = { ...current };
                                    if (checked) next[item.id] = { version: item.version, useDefaultUsagePolicy: false };
                                    else delete next[item.id];
                                    return next;
                                })}
                                onDefault={checked => setSelected(current => ({ ...current, [item.id]: { version: item.version, useDefaultUsagePolicy: checked } }))}
                            />
                        ))}
                    </ul>
                </>
            )}
        </Panel>
    );
};

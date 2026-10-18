import { Download, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { downloadPluginData, type PluginDataItem, type PluginUninstallMode, usePluginUninstallPlan, useUninstallPlugin } from '#/api/plugins';
import { Modal } from '#/components/Modal';
import { toast, toastError } from '#/components/toast';
import { Button, ErrorNotice, Field, Labeled, Loading, Segmented, WarningNotice } from '#/components/ui';

const MODES: { value: PluginUninstallMode; label: string }[] = [
    { value: 'keep-data', label: 'Keep its data' },
    { value: 'delete-data', label: 'Delete its data' },
];

const KINDS: Record<PluginDataItem['kind'], string> = {
    table: 'Tables',
    setting: 'Settings set in the panel',
    grant: 'Permission grants',
};

/** How much of one item: a table's rows, a grant's holders, a setting's value. */
const amount = (item: PluginDataItem) => {
    if (item.kind === 'table')
        return `${item.count.toLocaleString()} ${item.count === 1 ? 'row' : 'rows'}`;

    if (item.kind === 'setting')
        return item.detail ?? 'secret';

    return item.detail ?? `${item.count.toLocaleString()} assignments`;
};

/** A list under a heading, or nothing when it is empty. */
const Section = ({ title, items }: { title: string; items: { name: string; detail?: string }[] }) => items.length === 0
    ? null
    : (
            <Labeled label={title}>
                <ul className="flex flex-col gap-1 text-xs">
                    {items.map(item => (
                        <li key={item.name} className="flex flex-wrap items-baseline justify-between gap-x-3">
                            <code className="font-mono break-all">{item.name}</code>
                            {item.detail && <span className="text-muted break-all">{item.detail}</span>}
                        </li>
                    ))}
                </ul>
            </Labeled>
        );

/**
 * Uninstalls a plugin: first the dry run of what would go, then keeping or deleting its data, with
 * its key typed again. Its tables can be saved as SQL before they are dropped.
 */
export const PluginUninstall = ({ pluginKey, onClose }: { pluginKey: string; onClose: () => void }) => {
    const { data: plan, error } = usePluginUninstallPlan(pluginKey);
    const uninstall = useUninstallPlugin();
    const [ mode, setMode ] = useState<PluginUninstallMode>('keep-data');
    const [ confirm, setConfirm ] = useState('');
    const [ exporting, setExporting ] = useState(false);
    const name = plan?.plugin.name ?? pluginKey;
    const tables = plan?.data.filter(item => item.kind === 'table') ?? [];
    const deleting = mode === 'delete-data';

    const exportData = () => {
        setExporting(true);
        downloadPluginData(pluginKey).catch(toastError).finally(() => setExporting(false));
    };

    const submit = () => uninstall.mutate({ key: pluginKey, mode, confirm }, {
        onSuccess: (result) => {
            toast(result.message);
            onClose();
        },
    });

    return (
        <Modal open onClose={onClose} title={`Uninstall ${name}`} className="sm:h-fit! sm:max-w-xl">
            <form
                className="flex flex-col gap-4 p-4 sm:p-5"
                onSubmit={(event) => {
                    event.preventDefault();
                    submit();
                }}
            >
                {error && <ErrorNotice error={error} />}
                {!plan && !error && <Loading />}
                {plan && (
                    <>
                        {plan.refusal && <ErrorNotice error={new Error(plan.refusal)} />}
                        {plan.notes.map(note => <WarningNotice key={note}>{note}</WarningNotice>)}

                        <Section title="Its code" items={plan.files.map(file => ({ name: file }))} />
                        <Section title="Linked from GitHub" items={plan.sources.map(source => ({ name: source }))} />

                        <Labeled label="Its data">
                            <Segmented label="Its data" value={mode} onChange={value => setMode(value as PluginUninstallMode)} options={MODES} />
                        </Labeled>
                        <p className="text-xs text-muted">
                            {deleting
                                ? 'Deleted with it, and not brought back by installing it again:'
                                : 'Kept, so installing it again picks it up:'}
                            {plan.data.length === 0 && ' none.'}
                        </p>
                        {(Object.keys(KINDS) as PluginDataItem['kind'][]).map(kind => (
                            <Section
                                key={kind}
                                title={KINDS[kind]}
                                items={plan.data.filter(item => item.kind === kind).map(item => ({ name: item.name, detail: amount(item) }))}
                            />
                        ))}

                        {tables.length > 0 && (
                            <Button variant="secondary" icon={<Download />} disabled={exporting} onClick={exportData} className="self-start">
                                Download its tables as SQL
                            </Button>
                        )}

                        <Field
                            label={`Type ${pluginKey} to uninstall it`}
                            name="uninstall-confirm"
                            value={confirm}
                            onChange={event => setConfirm(event.target.value)}
                            autoComplete="off"
                            disabled={!!plan.refusal}
                            className="w-full font-mono"
                        />
                    </>
                )}

                {uninstall.error && <ErrorNotice error={uninstall.error} />}

                <div className="flex justify-end gap-2 border-t border-line pt-4">
                    <Button variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button
                        type="submit"
                        variant="danger"
                        icon={<Trash2 />}
                        disabled={!plan || !!plan.refusal || confirm.trim() !== pluginKey || uninstall.isPending}
                    >
                        {deleting ? 'Uninstall and delete data' : 'Uninstall, keep data'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
};

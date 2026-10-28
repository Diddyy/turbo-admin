import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { type AiProvider, setAiKey, testAi, useAi } from '#/api/ai';
import { type ServerSetting, useSaveSetting, useSettings } from '#/api/settings';
import { toast, toastError } from '#/components/toast';
import { Badge, Button, EmptyState, ErrorNotice, Loading, PageBody, PageHeader, Panel } from '#/components/ui';
import { useHubTabs } from '#/layout/nav';

const Provider = ({ provider, canManage }: { provider: AiProvider; canManage: boolean }) => {
    const [ key, setKey ] = useState('');
    const client = useQueryClient();
    const change = useMutation({
        mutationFn: (value: string | null) => setAiKey(provider.name, value),
        onSuccess: () => {
            setKey('');
            toast('Key updated.');
            void client.invalidateQueries({ queryKey: [ 'plugins', 'ai' ] });
        },
        onError: toastError,
    });
    const test = useMutation({ mutationFn: () => testAi(provider.name), onError: toastError });

    return (
        <div className="flex flex-col gap-3 border-b border-line p-4">
            <div className="flex flex-wrap items-center gap-3">
                <strong>{provider.name}</strong>
                <Badge tone={provider.usable ? 'green' : 'amber'}>{provider.usable ? 'ready' : 'needs configuration'}</Badge>
                <span className="text-sm text-muted">{provider.driver} · {provider.model} · {provider.hasKey ? 'key set' : 'no key'}</span>
            </div>
            {provider.url && <p className="text-sm break-all text-muted">{provider.url}</p>}
            {canManage && (
                <div className="flex flex-wrap items-center gap-2">
                    <input aria-label={`New key for ${provider.name}`} type="password" autoComplete="new-password" value={key} onChange={event => setKey(event.target.value)} placeholder="New API key" className="rounded border border-line bg-panel px-3 py-2 text-sm" />
                    <Button disabled={!key.trim() || change.isPending} onClick={() => change.mutate(key)}>Save key</Button>
                    <Button variant="secondary" disabled={!provider.hasKey || change.isPending} onClick={() => change.mutate(null)}>Remove key</Button>
                    <Button variant="secondary" disabled={test.isPending} onClick={() => test.mutate()}>{test.isPending ? 'Testing…' : 'Test connection'}</Button>
                </div>
            )}
            {test.data && <p role="status" className={test.data.ok ? 'text-sm text-muted' : 'text-sm text-red-500'}>{test.data.message}</p>}
        </div>
    );
};

const Setting = ({ setting, canManage }: { setting: ServerSetting; canManage: boolean }) => {
    const [ value, setValue ] = useState(setting.value ?? setting.default ?? '');
    const save = useSaveSetting();
    const client = useQueryClient();

    return (
        <form
            className="flex flex-col gap-2 p-4"
            onSubmit={(event) => {
                event.preventDefault();
                try {
                    JSON.parse(value);
                    save.mutate({ path: setting.path, value }, {
                        onSuccess: () => {
                            toast('Setting saved.');
                            void client.invalidateQueries({ queryKey: [ 'plugins', 'ai' ] });
                        },
                        onError: toastError,
                    });
                } catch {
                    toastError(new Error('Enter a valid JSON value.'));
                }
            }}
        >
            <label htmlFor={setting.path} className="font-medium">{setting.path.split(':').at(-1)}</label>
            <p className="text-sm text-muted">{setting.summary}</p>
            {!setting.live && <p className="text-sm text-muted">Applies after a server restart.{setting.pendingRestart ? ' A restart is pending.' : ''}</p>}
            <textarea id={setting.path} value={value} readOnly={!canManage} rows={setting.kind === 'map' ? 10 : 2} onChange={event => setValue(event.target.value)} className="w-full rounded border border-line bg-panel p-3 font-mono text-sm" />
            {canManage && <Button type="submit" disabled={save.isPending} className="self-start">Save</Button>}
        </form>
    );
};

export const PluginAiPage = () => {
    const [ days, setDays ] = useState(30);
    const { data, error, isPending } = useAi(days);
    const settings = useSettings();
    const tabs = useHubTabs('plugins');
    const canManage = settings.data?.canManage ?? false;

    return (
        <>
            <PageHeader title="Plugins" description="Language models, access and usage" tabs={tabs} />
            <PageBody className="flex flex-col gap-4">
                {error && <ErrorNotice error={error} />}
                {isPending && <Loading />}
                {!isPending && !data && !error && <EmptyState>The server has no AI module.</EmptyState>}
                {data && (
                    <>
                        <Panel title="Providers" description={`Failover: ${data.failover.length ? data.failover.join(' → ') : 'every provider by name'}`}>
                            {!data.providers.length && <EmptyState>Add a provider below to get started.</EmptyState>}
                            {data.providers.map(provider => <Provider key={provider.name} provider={provider} canManage={canManage} />)}
                        </Panel>
                        <Panel title="Plugin access">
                            {!data.plugins.length && <EmptyState>No loaded plugin declares AI.</EmptyState>}
                            {data.plugins.map(plugin => <div key={plugin.key} className="p-4"><strong>{plugin.name}</strong> · {plugin.allowed ? 'allowed' : 'blocked'}<p className="text-sm text-muted">{plugin.purpose}</p></div>)}
                        </Panel>
                        <Panel title="Configuration" description="Providers, models, failover, allowed plugin keys and limits. Values use JSON. API keys are entered above.">
                            {settings.error && <ErrorNotice error={settings.error} />}
                            {settings.isPending && <Loading />}
                            {settings.data?.settings.filter(setting => setting.section === 'Turbo:Ai' && !setting.secret).map(setting => <Setting key={`${setting.path}:${setting.value}`} setting={setting} canManage={canManage} />)}
                        </Panel>
                        <Panel title="Usage">
                            <label className="m-4 block">Period <select aria-label="Usage period" value={days} onChange={event => setDays(Number(event.target.value))}><option value={7}>7 days</option><option value={30}>30 days</option><option value={90}>90 days</option></select></label>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm"><thead><tr>{[ 'UTC day', 'Plugin', 'Provider / model', 'Calls / failed', 'Input / output tokens', 'Cost' ].map(label => <th key={label} className="p-3">{label}</th>)}</tr></thead>
                                    <tbody>{data.usage.map(row => <tr key={`${row.day}:${row.plugin}:${row.provider}:${row.model}`}><td className="p-3">{row.day.slice(0, 10)}</td><td className="p-3">{row.plugin}</td><td className="p-3">{row.provider} / {row.model}</td><td className="p-3">{row.calls} / {row.failed}</td><td className="p-3">{row.inputTokens} / {row.outputTokens}</td><td className="p-3">{row.cost.toLocaleString(undefined, { maximumFractionDigits: 6 })}</td></tr>)}</tbody>
                                </table>
                            </div>
                            {!data.usage.length && <EmptyState>No usage in this period.</EmptyState>}
                        </Panel>
                    </>
                )}
            </PageBody>
        </>
    );
};

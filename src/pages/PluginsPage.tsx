import { Power, PowerOff, RefreshCw, ScanSearch, Upload } from 'lucide-react';
import { useState } from 'react';

import { type Plugin, type PluginActionResponse, type PluginState, useInstallPlugin, usePlugins, useReloadPlugin, useRescanPlugins, useSetPluginEnabled } from '#/api/plugins';
import { ask } from '#/components/confirm';
import { toast, toastError } from '#/components/toast';
import { Badge, type BadgeTone, Button, EmptyState, ErrorNotice, Loading, PageBody, PageHeader, Panel, WarningNotice } from '#/components/ui';
import { cx } from '#/lib/cx';
import { fromNow } from '#/lib/time';
import { OpenRow } from '#/pages/gamedata/parts';

const STATES: Record<PluginState, { label: string; tone: BadgeTone }> = {
    loaded: { label: 'loaded', tone: 'green' },
    failed: { label: 'failed', tone: 'red' },
    disabled: { label: 'off', tone: 'amber' },
    not_loaded: { label: 'not loaded', tone: 'neutral' },
};

/** What an action came to, as a toast: a refusal or a failed load is thrown with why. */
const said = {
    onSuccess: (result: PluginActionResponse) => toast(result.message),
    onError: toastError,
};

/** A list of names or numbers, or a dash for none. */
const Items = ({ items }: { items: (string | number)[] }) =>
    items.length === 0
        ? <span className="text-muted">none</span>
        : <span className="flex flex-wrap gap-1.5">{items.map(item => <code key={item} className="rounded bg-subtle px-1.5 py-0.5 text-xs">{item}</code>)}</span>;

/** A plugin open: its manifest, what it added, why it failed, and what may be done with it. */
const PluginDetail = ({ plugin, canManage }: { plugin: Plugin; canManage: boolean }) => {
    const reload = useReloadPlugin();
    const setEnabled = useSetPluginEnabled();
    const busy = reload.isPending || setEnabled.isPending;
    const known = plugin.name !== null;

    return (
        <div className="flex flex-col gap-3">
            {plugin.error && <ErrorNotice error={new Error(plugin.error)} />}
            <dl className="grid gap-x-4 gap-y-1.5 text-xs sm:grid-cols-[9rem_1fr]">
                <dt className="text-muted">Key</dt>
                <dd className="font-mono break-all">{plugin.key}</dd>
                {known && (
                    <>
                        <dt className="text-muted">Author</dt>
                        <dd>{plugin.author}</dd>
                    </>
                )}
                <dt className="text-muted">Folder</dt>
                <dd className="font-mono break-all">{plugin.folder}{plugin.dev && <span className="ml-2 text-muted">(development path)</span>}</dd>
                {known && (
                    <>
                        <dt className="text-muted">Depends on</dt>
                        <dd><Items items={plugin.dependencies} /></dd>
                        <dt className="text-muted">Capabilities</dt>
                        <dd><Items items={plugin.capabilities} /></dd>
                        <dt className="text-muted">Incoming headers</dt>
                        <dd><Items items={plugin.incomingHeaders} /></dd>
                        <dt className="text-muted">Outgoing headers</dt>
                        <dd><Items items={plugin.outgoingHeaders} /></dd>
                        <dt className="text-muted">Migrations</dt>
                        <dd><Items items={plugin.migrations} /></dd>
                    </>
                )}
                {plugin.loadedAtUtc && (
                    <>
                        <dt className="text-muted">Loaded</dt>
                        <dd title={plugin.loadedAtUtc}>{fromNow(plugin.loadedAtUtc)}</dd>
                    </>
                )}
            </dl>
            {canManage && known && (
                <div className="flex flex-wrap items-center gap-2">
                    {plugin.state !== 'disabled' && (
                        <Button variant="secondary" icon={<RefreshCw />} disabled={busy} onClick={() => reload.mutate(plugin.key, said)}>
                            Reload
                        </Button>
                    )}
                    {plugin.state === 'disabled'
                        ? (
                                <Button icon={<Power />} disabled={busy} onClick={() => setEnabled.mutate({ key: plugin.key, enabled: true }, said)}>
                                    Turn on
                                </Button>
                            )
                        : (
                                <Button
                                    variant="ghost"
                                    icon={<PowerOff />}
                                    disabled={busy}
                                    onClick={() => ask(
                                        { title: `Turn ${plugin.name} off?`, body: 'It is unloaded now, and stays off after a restart until it is turned on here.', confirm: 'Turn off' },
                                        () => setEnabled.mutate({ key: plugin.key, enabled: false }, said),
                                    )}
                                >
                                    Turn off
                                </Button>
                            )}
                </div>
            )}
        </div>
    );
};

/** Installs a zip chosen from disk, after saying what it does. */
const InstallButton = ({ maxBytes }: { maxBytes: number }) => {
    const install = useInstallPlugin();

    return (
        <label className={cx('inline-flex h-11 cursor-pointer items-center gap-2 rounded-lg border border-line px-3 text-sm font-medium text-ink hover:bg-subtle sm:h-9 [&>svg]:size-4', install.isPending && 'pointer-events-none opacity-60')}>
            <Upload />
            Install
            <input
                type="file"
                accept=".zip,application/zip"
                className="sr-only"
                onChange={(event) => {
                    const file = event.target.files?.[0];

                    if (file)
                        ask(
                            {
                                title: `Install ${file.name}?`,
                                body: `A plugin is server code: it runs with the hotel's own access. One with the same key is replaced. Up to ${Math.floor(maxBytes / (1024 * 1024))} MB.`,
                                confirm: 'Install',
                            },
                            () => install.mutate(file, said),
                        );

                    event.target.value = '';
                }}
            />
        </label>
    );
};

/**
 * The server's plugins: each one's manifest, whether it loaded and why not, and the capabilities,
 * packet headers and migrations it added. Staff who manage them reload one, scan the folders
 * again and turn one off or on; installing a package needs its own node and the server's leave.
 * Every action is in the command log.
 */
export const PluginsPage = () => {
    const { data, error } = usePlugins();
    const rescan = useRescanPlugins();
    const [ open, setOpen ] = useState<string | null>(null);
    const loaded = data?.plugins.filter(plugin => plugin.state === 'loaded').length ?? 0;

    return (
        <>
            <PageHeader title="Plugins" description="What the server loaded from its plugin folders, and what each added">
                {data?.canManage && (
                    <Button variant="secondary" icon={<ScanSearch />} disabled={rescan.isPending} onClick={() => rescan.mutate(undefined, said)}>
                        Rescan
                    </Button>
                )}
                {data?.canInstall && data.uploadEnabled && <InstallButton maxBytes={data.maxUploadBytes} />}
            </PageHeader>
            <PageBody className="flex flex-col gap-4 lg:gap-5">
                {error && <ErrorNotice error={error} />}
                {!data && !error && <Loading />}
                {data?.canInstall && !data.uploadEnabled && (
                    <WarningNotice>Installing plugins from the panel is off. The server allows it with Turbo:Plugin:UploadEnabled.</WarningNotice>
                )}
                {data && (
                    <Panel title="Plugins" description={`${data.plugins.length.toLocaleString()} found, ${loaded.toLocaleString()} loaded.`} className="overflow-clip">
                        {data.plugins.length === 0 && <EmptyState>No plugin is in the plugin folders.</EmptyState>}
                        <ul className="divide-y divide-line">
                            {data.plugins.map(plugin => (
                                <OpenRow
                                    key={`${plugin.folder}|${plugin.key}`}
                                    open={open === plugin.key}
                                    onToggle={() => setOpen(open === plugin.key ? null : plugin.key)}
                                    summary={(
                                        <div className="grid items-center gap-x-4 gap-y-1 sm:grid-cols-[minmax(12rem,20rem)_1fr_auto]">
                                            <span className="flex min-w-0 items-baseline gap-2">
                                                <span className="truncate font-medium">{plugin.name ?? plugin.folder}</span>
                                                {plugin.version && <span className="font-mono text-xs text-muted">{plugin.version}</span>}
                                            </span>
                                            <span className="truncate font-mono text-xs text-muted">{plugin.key}</span>
                                            <span className="flex flex-wrap gap-1.5 sm:justify-end">
                                                {plugin.dev && <Badge>dev</Badge>}
                                                <Badge tone={STATES[plugin.state].tone}>{STATES[plugin.state].label}</Badge>
                                            </span>
                                        </div>
                                    )}
                                >
                                    <PluginDetail plugin={plugin} canManage={data.canManage} />
                                </OpenRow>
                            ))}
                        </ul>
                    </Panel>
                )}
            </PageBody>
        </>
    );
};

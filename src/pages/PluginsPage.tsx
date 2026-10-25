import { Download, ExternalLink, History, Link2, Pencil, Power, PowerOff, RefreshCw, ScanSearch, Trash2, Unlink, Upload } from 'lucide-react';
import { useState } from 'react';

import { type Plugin, type PluginActionResponse, type PluginSource, type PluginSourceActionResponse, type PluginState, useCheckPluginSource, useInstallPlugin, usePluginContributions, usePlugins, useReloadPlugin, useRemovePluginSource, useRescanPlugins, useRollbackPlugin, useSetPluginEnabled, useUpdatePluginSource } from '#/api/plugins';
import { ask } from '#/components/confirm';
import { Tabs } from '#/components/Tabs';
import { toast, toastError } from '#/components/toast';
import { Badge, type BadgeTone, Button, EmptyState, ErrorNotice, Loading, PageBody, PageHeader, Panel, WarningNotice } from '#/components/ui';
import { useHubTabs } from '#/layout/nav';
import { cx } from '#/lib/cx';
import { fromNow } from '#/lib/time';
import { JobPanel } from '#/pages/assets/JobPanel';
import { OpenRow } from '#/pages/gamedata/parts';

import { PluginSourceForm } from './PluginSourceForm';
import { PluginUninstall } from './PluginUninstall';

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

/** What a link action came to, as a toast: a refusal is thrown with why. */
const sourceSaid = {
    onSuccess: (result: PluginSourceActionResponse) => toast(result.message),
    onError: toastError,
};

/** A list of names or numbers, or a dash for none. */
const Items = ({ items }: { items: (string | number)[] }) =>
    items.length === 0
        ? <span className="text-muted">none</span>
        : <span className="flex flex-wrap gap-1.5">{items.map(item => <code key={item} className="rounded bg-subtle px-1.5 py-0.5 text-xs">{item}</code>)}</span>;

/** What clients report, in words. */
const ISSUE_LABELS: Record<string, string> = {
    'module.refused': 'module refused',
    'module.failed': 'module threw',
    'patch.unmatched': 'patch matched nothing',
    'patch.conflict': 'patch clash',
    'patch.applied': 'patch applied',
};

/**
 * The extension inspector's tabs on an open plugin: everything it contributes by kind, with the
 * names another live plugin registers too; and what players' clients report of its client half.
 */
const PluginInspector = ({ pluginKey }: { pluginKey: string }) => {
    const [ tab, setTab ] = useState('contributions');
    const contributions = usePluginContributions(pluginKey);
    const data = contributions.data;
    const kinds = new Map<string, { name: string; detail: string | null }[]>();

    for (const item of data?.items ?? []) kinds.set(item.kind, [ ...(kinds.get(item.kind) ?? []), item ]);

    const problems = (data?.clientIssues ?? []).filter(issue => issue.kind !== 'patch.applied').length;

    return (
        <div className="flex flex-col gap-2">
            <Tabs
                value={tab}
                onChange={setTab}
                label="Inspector"
                tabs={[
                    { value: 'contributions', label: 'Contributions', count: data?.items.length, title: 'What its last load registered' },
                    { value: 'clients', label: 'Client reports', count: problems || undefined, title: 'What players\' clients report of its client half' },
                ]}
            />
            {contributions.isLoading && <Loading />}
            {contributions.error && <ErrorNotice error={contributions.error} />}
            {data && tab === 'contributions' && (
                <div className="flex flex-col gap-2 text-xs">
                    {data.conflicts.map(conflict => <WarningNotice key={conflict}>{conflict}</WarningNotice>)}
                    {kinds.size === 0
                        ? <span className="text-muted">It registers nothing{data.state === 'failed' ? ' (its load failed before anything was registered)' : ''}.</span>
                        : (
                                <dl className="grid gap-x-4 gap-y-1.5 sm:grid-cols-[9rem_1fr]">
                                    {[ ...kinds ].map(([ kind, items ]) => (
                                        <div key={kind} className="contents">
                                            <dt className={cx('text-muted', kind === 'override' && 'font-medium text-amber-700')}>{kind}</dt>
                                            <dd className="flex flex-wrap gap-1.5">
                                                {items.map(item => (
                                                    <code key={`${item.name} ${item.detail ?? ''}`} className="rounded bg-subtle px-1.5 py-0.5" title={item.detail ?? undefined}>
                                                        {item.name}
                                                        {item.detail && <span className="ml-1 text-muted">{item.detail}</span>}
                                                    </code>
                                                ))}
                                            </dd>
                                        </div>
                                    ))}
                                </dl>
                            )}
                </div>
            )}
            {data && tab === 'clients' && (
                data.clientIssues.length === 0
                    ? <span className="text-xs text-muted">No client has reported anything since the server started.</span>
                    : (
                            <ul className="flex flex-col gap-1.5 text-xs">
                                {data.clientIssues.map(issue => (
                                    <li key={`${issue.kind} ${issue.subject} ${issue.message}`} className="flex flex-col gap-0.5">
                                        <span className="flex flex-wrap items-center gap-2">
                                            <Badge tone={issue.kind === 'patch.applied' ? 'green' : issue.kind === 'patch.conflict' ? 'amber' : 'red'}>{ISSUE_LABELS[issue.kind] ?? issue.kind}</Badge>
                                            <code className="break-all">{issue.subject}</code>
                                            <span className="text-muted" title={issue.lastReportedUtc}>{issue.clients} {issue.clients === 1 ? 'player' : 'players'}, {fromNow(issue.lastReportedUtc)}</span>
                                        </span>
                                        <span className="break-words">{issue.message}</span>
                                    </li>
                                ))}
                            </ul>
                        )
            )}
        </div>
    );
};

/** A plugin open: its manifest, what it added, why it failed, and what may be done with it. */
const PluginDetail = ({ plugin, source, canManage, canInstall, canUninstall }: { plugin: Plugin; source: PluginSource | undefined; canManage: boolean; canInstall: boolean; canUninstall: boolean }) => {
    const [ uninstalling, setUninstalling ] = useState(false);
    const reload = useReloadPlugin();
    const setEnabled = useSetPluginEnabled();
    const rollback = useRollbackPlugin();
    const busy = reload.isPending || setEnabled.isPending || rollback.isPending;
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
                {source && (
                    <>
                        <dt className="text-muted">From</dt>
                        <dd className="font-mono break-all">{source.repository}{source.installedTag && ` ${source.installedTag}`}</dd>
                    </>
                )}
                {known && (
                    <>
                        <dt className="text-muted">Earlier versions</dt>
                        <dd>
                            {plugin.versions.length === 0
                                ? <span className="text-muted">none kept</span>
                                : (
                                        <span className="flex flex-wrap items-center gap-1.5">
                                            {plugin.versions.map(version => (
                                                <span key={version} className="inline-flex items-center gap-1">
                                                    <code className="rounded bg-subtle px-1.5 py-0.5 text-xs">{version}</code>
                                                    {canInstall && (
                                                        <Button
                                                            variant="ghost"
                                                            icon={<History />}
                                                            disabled={busy}
                                                            aria-label={`Roll back to ${version}`}
                                                            onClick={() => ask(
                                                                { title: `Roll ${plugin.name} back to ${version}?`, body: `${plugin.version} is replaced and kept, to go forward again.${source?.autoUpdate ? ' Updating on its own leaves this release alone; a newer one is taken.' : ''}`, confirm: 'Roll back' },
                                                                () => rollback.mutate({ key: plugin.key, version }, said),
                                                            )}
                                                        >
                                                            Roll back
                                                        </Button>
                                                    )}
                                                </span>
                                            ))}
                                        </span>
                                    )}
                        </dd>
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
                    {canUninstall && !plugin.dev && (
                        <Button variant="ghost" icon={<Trash2 />} disabled={busy} onClick={() => setUninstalling(true)}>
                            Uninstall
                        </Button>
                    )}
                </div>
            )}
            {known && <PluginInspector pluginKey={plugin.key} />}
            {uninstalling && <PluginUninstall pluginKey={plugin.key} onClose={() => setUninstalling(false)} />}
        </div>
    );
};

/** Installs a zip chosen from disk, after saying what it does. */
const InstallButton = ({ maxBytes }: { maxBytes: number }) => {
    const install = useInstallPlugin();

    return (
        <label className={cx('inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-lg border border-line px-3 text-sm font-medium text-ink hover:bg-subtle sm:h-8 sm:text-[13px] [&>svg]:size-4', install.isPending && 'pointer-events-none opacity-60')}>
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

/** One linked repository: what it follows, what is installed from it and what GitHub offers. */
const SourceRow = ({ source, canManage, canInstall, onEdit }: { source: PluginSource; canManage: boolean; canInstall: boolean; onEdit: () => void }) => {
    const check = useCheckPluginSource();
    const update = useUpdatePluginSource();
    const unlink = useRemovePluginSource();
    const busy = check.isPending || update.isPending || unlink.isPending;

    return (
        <li className="flex flex-col gap-2 px-4 py-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-mono text-sm font-medium break-all">{source.repository}</span>
                <span className="text-xs text-muted">{source.follow === 'tag' ? `tag ${source.tag}` : 'newest release'}</span>
                {source.hasToken && <Badge>token set</Badge>}
                {source.autoUpdate && <Badge>updates on its own</Badge>}
                {source.updateAvailable && !source.error && <Badge tone="accent">update available: {source.latestTag}</Badge>}
                {source.error && <Badge tone="red">failed</Badge>}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                <span>Installed: <span className="font-mono">{source.installedTag ?? (source.installedVersion ? `version ${source.installedVersion}` : 'nothing yet')}</span>{source.key && <span className="font-mono"> ({source.key})</span>}</span>
                {source.latestTag && (
                    <span>
                        Newest:
                        {' '}
                        {source.latestUrl
                            ? <a href={source.latestUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-accent hover:underline">{source.latestTag}<ExternalLink className="size-3" /></a>
                            : <span className="font-mono">{source.latestTag}</span>}
                        {source.latestPublishedAtUtc && <span title={source.latestPublishedAtUtc}>{`, published ${fromNow(source.latestPublishedAtUtc)}`}</span>}
                    </span>
                )}
                {source.checkedAtUtc && <span title={source.checkedAtUtc}>Checked {fromNow(source.checkedAtUtc)}</span>}
            </div>
            {source.error && <ErrorNotice error={new Error(source.error)} />}
            {canManage && (
                <div className="flex flex-wrap items-center gap-2">
                    {canInstall && source.updateAvailable && (
                        <Button
                            icon={<Download />}
                            disabled={busy}
                            onClick={() => ask(
                                { title: `Install ${source.latestTag} from ${source.repository}?`, body: 'A plugin is server code: it runs with the hotel\'s own access. The version installed now is kept to roll back to, and put back if the new one does not load.', confirm: 'Update' },
                                () => update.mutate(source.id, sourceSaid),
                            )}
                        >
                            Update
                        </Button>
                    )}
                    <Button variant="secondary" icon={<RefreshCw />} disabled={busy} onClick={() => check.mutate(source.id, sourceSaid)}>
                        Check now
                    </Button>
                    {canInstall && (
                        <Button variant="ghost" icon={<Pencil />} disabled={busy} onClick={onEdit}>
                            Edit
                        </Button>
                    )}
                    <Button
                        variant="ghost"
                        icon={<Unlink />}
                        disabled={busy}
                        onClick={() => ask(
                            { title: `Unlink ${source.repository}?`, body: 'It is no longer checked for updates. Its plugin stays installed.', confirm: 'Unlink' },
                            () => unlink.mutate(source.id, sourceSaid),
                        )}
                    >
                        Unlink
                    </Button>
                </div>
            )}
        </li>
    );
};

/**
 * The server's plugins: each one's manifest, whether it loaded and why not, and the capabilities,
 * packet headers and migrations it added. Staff who manage them reload one, scan the folders
 * again and turn one off or on; installing a package needs its own node and the server's leave,
 * and uninstalling one (keeping or deleting its data) its own node too.
 * Every action is in the command log.
 */
export const PluginsPage = () => {
    const { data, error } = usePlugins();
    const rescan = useRescanPlugins();
    const checkAll = useCheckPluginSource();
    const [ open, setOpen ] = useState<string | null>(null);
    const [ editing, setEditing ] = useState<PluginSource | 'new' | null>(null);
    const loaded = data?.plugins.filter(plugin => plugin.state === 'loaded').length ?? 0;
    const canLink = !!data?.canInstall && data.uploadEnabled;
    const sourceOf = (key: string) => data?.sources.find(source => source.key?.toLowerCase() === key.toLowerCase());
    const tabs = useHubTabs('plugins');

    return (
        <>
            <PageHeader title="Plugins" description="What the server loaded from its plugin folders, and what each added" tabs={tabs}>
                {data?.canManage && (
                    <Button variant="secondary" icon={<ScanSearch />} disabled={rescan.isPending} onClick={() => rescan.mutate(undefined, said)}>
                        Rescan
                    </Button>
                )}
                {canLink && (
                    <Button variant="secondary" icon={<Link2 />} onClick={() => setEditing('new')}>
                        Link from GitHub
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
                {data?.job && <JobPanel job={data.job} canManage={data.canManage} compact={data.job.status !== 'running'} />}
                {data && (data.sources.length > 0 || canLink) && (
                    <Panel
                        title="Linked from GitHub"
                        description={data.checkMinutes > 0 ? `Checked for a new release every ${data.checkMinutes === 1 ? 'minute' : `${data.checkMinutes.toLocaleString()} minutes`}.` : 'Checked only when asked (Turbo:Plugin:UpdateCheckMinutes is 0).'}
                        actions={data.canManage && data.sources.length > 0 && (
                            <Button variant="secondary" icon={<RefreshCw />} disabled={checkAll.isPending} onClick={() => checkAll.mutate(null, sourceSaid)}>
                                Check all
                            </Button>
                        )}
                        className="overflow-clip"
                    >
                        {data.sources.length === 0 && <EmptyState>No repository is linked. Link one to install its plugin from its releases and keep it up to date.</EmptyState>}
                        <ul className="divide-y divide-line">
                            {data.sources.map(source => (
                                <SourceRow key={source.id} source={source} canManage={data.canManage} canInstall={canLink} onEdit={() => setEditing(source)} />
                            ))}
                        </ul>
                    </Panel>
                )}
                {editing && data && (
                    <PluginSourceForm source={editing === 'new' ? null : editing} allowed={data.allowedSources} onClose={() => setEditing(null)} />
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
                                                {sourceOf(plugin.key)?.updateAvailable && <Badge tone="accent">update available</Badge>}
                                                {plugin.dev && <Badge>dev</Badge>}
                                                <Badge tone={STATES[plugin.state].tone}>{STATES[plugin.state].label}</Badge>
                                            </span>
                                        </div>
                                    )}
                                >
                                    <PluginDetail plugin={plugin} source={sourceOf(plugin.key)} canManage={data.canManage} canInstall={canLink} canUninstall={data.canUninstall} />
                                </OpenRow>
                            ))}
                        </ul>
                    </Panel>
                )}
            </PageBody>
        </>
    );
};

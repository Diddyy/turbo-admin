import { Lock, RotateCcw, Save } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { type ServerSetting, SOURCE, useResetSetting, useSaveSetting, useSettingHistory, useSettings } from '#/api/settings';
import { ask } from '#/components/confirm';
import { ListToolbar } from '#/components/ListToolbar';
import { RestartServer } from '#/components/RestartServer';
import { SearchInput } from '#/components/SearchInput';
import { Badge, Button, EmptyState, ErrorNotice, Input, Labeled, Loading, PageBody, PageHeader, Panel, Segmented, Select, Switch, Textarea, WarningNotice } from '#/components/ui';
import { cx } from '#/lib/cx';
import { fromNow } from '#/lib/time';
import { OpenRow } from '#/pages/gamedata/parts';

const TABS = [
    { value: 'settings', label: 'Settings' },
    { value: 'history', label: 'History' },
];

const FILTERS = [
    { value: 'all', label: 'All' },
    { value: 'panel', label: 'Set here' },
    { value: 'restart', label: 'Waiting on restart' },
    { value: 'plugins', label: 'Plugins' },
];

/** The setting's name within its section: `MaxUsersPerRoom`, `Discord:ClientSecret`. */
const nameOf = (setting: ServerSetting) => setting.path.slice(setting.section.length + 1);

/** A JSON value as staff would type it: text without its quotes. */
const shown = (setting: ServerSetting, json: string | null) => {
    if (json === null) return '';

    if (setting.kind === 'string' || setting.kind === 'enum' || setting.kind === 'duration') {
        try {
            const value: unknown = JSON.parse(json);

            return typeof value === 'string' ? value : json;
        } catch {
            return json;
        }
    }

    return json;
};

/** What a setting holds, on one line: a secret only whether it is set. */
const ValueText = ({ setting }: { setting: ServerSetting }) => {
    if (setting.secret)
        return <span className="text-xs text-muted">{setting.isSet ? 'set, hidden' : 'not set'}</span>;

    const text = shown(setting, setting.value);

    return <span className="truncate font-mono text-xs text-muted">{text === '' ? '""' : text}</span>;
};

const SourceBadge = ({ setting }: { setting: ServerSetting }) => {
    if (setting.source === SOURCE.environment)
        return <Badge tone="amber" className="max-w-56 truncate normal-case!"><Lock className="size-3" /> {setting.sourceName}</Badge>;

    if (setting.source === SOURCE.panel)
        return <Badge tone="accent">set here</Badge>;

    if (setting.source === SOURCE.appSettings)
        return <Badge className="normal-case!">{setting.sourceName}</Badge>;

    return null;
};

/** The value typed as JSON for the server, or why it isn't one. */
const toJson = (setting: ServerSetting, text: string): { json: string } | { problem: string } => {
    switch (setting.kind) {
        case 'string':
        case 'enum':
        case 'duration':
            return { json: JSON.stringify(text) };
        case 'integer':
        case 'number':
            return text.trim() !== '' && Number.isFinite(Number(text)) && (setting.kind === 'number' || Number.isInteger(Number(text)))
                ? { json: String(Number(text)) }
                : { problem: setting.kind === 'integer' ? 'A whole number.' : 'A number.' };
        case 'bool':
            return { json: text === 'true' ? 'true' : 'false' };
        default:
            try {
                JSON.parse(text);

                return { json: text };
            } catch {
                return { problem: setting.kind === 'list' ? 'A JSON list: ["a", "b"].' : setting.kind === 'map' ? 'A JSON object: { "key": 1 }.' : 'JSON.' };
            }
    }
};

/** The field a setting is changed in, by its kind. */
const ValueInput = ({ setting, text, onChange }: { setting: ServerSetting; text: string; onChange: (text: string) => void }) => {
    switch (setting.kind) {
        case 'bool':
            return <Switch label={text === 'true' ? 'On' : 'Off'} checked={text === 'true'} onChange={checked => onChange(checked ? 'true' : 'false')} />;
        case 'enum':
            return (
                <Select value={text} onChange={event => onChange(event.target.value)} className="w-full sm:max-w-72">
                    {setting.options.map(option => <option key={option} value={option}>{option}</option>)}
                </Select>
            );
        case 'integer':
        case 'number':
            return <Input type="number" step={setting.kind === 'integer' ? 1 : 'any'} value={text} onChange={event => onChange(event.target.value)} className="w-full sm:max-w-48" />;
        case 'list':
        case 'map':
        case 'json':
            return <Textarea value={text} onChange={event => onChange(event.target.value)} rows={Math.min(12, Math.max(3, text.split('\n').length))} className="font-mono text-xs" />;
        default:
            return (
                <Input
                    type={setting.secret ? 'password' : 'text'}
                    autoComplete="off"
                    value={text}
                    onChange={event => onChange(event.target.value)}
                    placeholder={setting.secret ? 'A new value; the old one is never shown' : setting.kind === 'duration' ? '00:05:00' : undefined}
                    className="w-full font-mono sm:max-w-[36rem]"
                />
            );
    }
};

/** A setting open: what it does, where it comes from, and its value to change. */
const SettingEditor = ({ setting, canManage }: { setting: ServerSetting; canManage: boolean }) => {
    const start = setting.secret ? '' : setting.kind === 'list' || setting.kind === 'map' || setting.kind === 'json' ? JSON.stringify(JSON.parse(setting.value ?? 'null'), null, 4) : shown(setting, setting.value);
    const [ text, setText ] = useState(start);
    const save = useSaveSetting();
    const reset = useResetSetting();
    const typed = toJson(setting, text);
    const locked = setting.startup || setting.source === SOURCE.environment;
    const editable = canManage && !locked;

    return (
        <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
                event.preventDefault();

                if ('json' in typed) save.mutate({ path: setting.path, value: typed.json });
            }}
        >
            {setting.summary && <p className="text-sm text-muted">{setting.summary}</p>}
            <dl className="grid gap-x-4 gap-y-1 text-xs sm:grid-cols-[8rem_1fr]">
                <dt className="text-muted">Path</dt>
                <dd className="font-mono break-all">{setting.path}</dd>
                {!setting.secret && (
                    <>
                        <dt className="text-muted">Default</dt>
                        <dd className="font-mono break-all">{setting.default}</dd>
                    </>
                )}
                {setting.pendingRestart && !setting.secret && (
                    <>
                        <dt className="text-muted">Running now</dt>
                        <dd className="font-mono break-all">{setting.running}</dd>
                    </>
                )}
            </dl>
            {setting.startup && <WarningNotice>The panel stands on this setting, so it is changed in appsettings.json or the environment, not here.</WarningNotice>}
            {!setting.startup && setting.source === SOURCE.environment && <WarningNotice>{setting.sourceName} sets this, and the environment always wins over the panel. Change it there.</WarningNotice>}
            {editable && (
                <>
                    <Labeled label={setting.secret ? 'New value' : 'Value'} hint={setting.kind === 'list' ? 'A list starts with its default items: they can be added to, not taken away.' : undefined}>
                        <ValueInput setting={setting} text={text} onChange={setText} />
                    </Labeled>
                    {'problem' in typed && text !== '' && <p className="text-xs text-warn">{typed.problem}</p>}
                    <div className="flex flex-wrap items-center gap-2">
                        <Button type="submit" icon={<Save />} disabled={!('json' in typed) || save.isPending || (!setting.secret && text === start) || (setting.secret && text === '')}>Save</Button>
                        {setting.source === SOURCE.panel && (
                            <Button
                                variant="ghost"
                                icon={<RotateCcw />}
                                disabled={reset.isPending}
                                onClick={() => ask({ title: `Put ${setting.path} back to what appsettings.json says?`, body: setting.live ? 'It applies at once.' : 'It applies after a restart.', confirm: 'Put back' }, () => reset.mutate(setting.path))}
                            >
                                Put back
                            </Button>
                        )}
                        <span className="text-xs text-muted">{setting.live ? 'Applies at once.' : 'Applies after a restart.'}</span>
                    </div>
                </>
            )}
            {(save.error || reset.error) && <ErrorNotice error={save.error ?? reset.error} />}
        </form>
    );
};

/** Every setting, by section: found by name, path, text or value. */
const SettingsTab = () => {
    const [ params ] = useSearchParams();
    const [ text, setText ] = useState(() => params.get('q') ?? '');
    const [ filter, setFilter ] = useState('all');
    const [ open, setOpen ] = useState<string | null>(() => params.get('open'));
    const { data, error } = useSettings();

    const found = useMemo(() => {
        const words = text.trim().toLowerCase();

        return (data?.settings ?? []).filter(setting =>
            (filter === 'all' || (filter === 'panel' && setting.source === SOURCE.panel) || (filter === 'restart' && setting.pendingRestart) || (filter === 'plugins' && !!setting.plugin))
            && (!words || setting.path.toLowerCase().includes(words) || setting.summary.toLowerCase().includes(words) || (!setting.secret && (setting.value ?? '').toLowerCase().includes(words))));
    }, [ data, text, filter ]);

    const sections = useMemo(() => {
        const bySection = new Map<string, ServerSetting[]>();

        for (const setting of found) bySection.set(setting.section, [ ...(bySection.get(setting.section) ?? []), setting ]);

        return [ ...bySection.entries() ];
    }, [ found ]);

    const waiting = data?.settings.filter(x => x.pendingRestart).length ?? 0;

    if (error) return <ErrorNotice error={error} />;

    if (!data) return <Loading />;

    return (
        <>
            {waiting > 0 && (
                <WarningNotice>
                    <div className="flex flex-col gap-3">
                        <span>{waiting === 1 ? 'One setting is' : `${waiting} settings are`} configured differently from what the server is running with. They apply when it restarts.</span>
                        <RestartServer compact />
                    </div>
                </WarningNotice>
            )}
            <Panel className="overflow-clip">
                <ListToolbar watch={[ text, filter ]}>
                    <SearchInput value={text} onValueChange={setText} placeholder="Name, text or value" aria-label="Find settings" className="min-w-48 flex-1 sm:max-w-96" />
                    <div className="w-full sm:w-96"><Segmented label="Show" value={filter} onChange={setFilter} options={FILTERS} /></div>
                </ListToolbar>
                {sections.length === 0 && <EmptyState>No setting matches.</EmptyState>}
            </Panel>
            {sections.map(([ section, settings ]) => (
                <Panel
                    key={section}
                    title={section}
                    description={settings[0].plugin ? <>From the plugin <Link to="/plugins" className="font-mono underline-offset-2 hover:underline">{settings[0].plugin}</Link>: listed while it is loaded, and applied as it reads them.</> : undefined}
                    actions={settings[0].plugin ? <Badge>plugin</Badge> : undefined}
                    className="overflow-clip"
                >
                    <ul className="divide-y divide-line">
                        {settings.map(setting => (
                            <OpenRow
                                key={setting.path}
                                open={open === setting.path}
                                onToggle={() => setOpen(open === setting.path ? null : setting.path)}
                                summary={(
                                    <div className="grid items-center gap-x-4 gap-y-1 sm:grid-cols-[minmax(12rem,20rem)_1fr_minmax(0,16rem)]">
                                        <span className="flex min-w-0 items-center gap-1.5 font-mono text-[13px]">
                                            <span className="truncate">{nameOf(setting)}</span>
                                            {setting.startup && <Lock className="size-3.5 shrink-0 text-muted" aria-label="Changed in appsettings.json or the environment" />}
                                        </span>
                                        <ValueText setting={setting} />
                                        <span className={cx('flex flex-wrap gap-1.5 sm:justify-end')}>
                                            {setting.pendingRestart && <Badge tone="amber">after restart</Badge>}
                                            {setting.live && <Badge tone="green">applies now</Badge>}
                                            <SourceBadge setting={setting} />
                                        </span>
                                    </div>
                                )}
                            >
                                <SettingEditor key={`${setting.value}|${setting.source}`} setting={setting} canManage={data.canManage} />
                            </OpenRow>
                        ))}
                    </ul>
                </Panel>
            ))}
        </>
    );
};

/** The changes made here, newest first. */
const HistoryTab = () => {
    const [ page, setPage ] = useState(0);
    const { data, error, isFetching } = useSettingHistory(page);
    const size = data?.pageSize ?? 1;

    return (
        <Panel className="overflow-clip">
            <ListToolbar watch={[ page ]} page={{ offset: page * size, limit: size, total: data?.total, onChange: offset => setPage(Math.floor(offset / size)) }} />
            {error && <div className="p-4"><ErrorNotice error={error} /></div>}
            {!data && isFetching && <Loading />}
            {data && data.items.length === 0 && <EmptyState>Nothing has been changed here yet.</EmptyState>}
            {data && data.items.length > 0 && (
                <ul className={cx('divide-y divide-line transition-opacity', isFetching && 'opacity-60')}>
                    {data.items.map(change => (
                        <li key={change.id} className="grid gap-x-4 gap-y-1 px-4 py-2.5 sm:grid-cols-[8rem_minmax(12rem,20rem)_1fr_6rem]">
                            <span className="text-xs text-muted" title={change.changedAt}>{fromNow(change.changedAt)}</span>
                            <span className="truncate font-mono text-[13px]">{change.path}</span>
                            <span className="min-w-0 font-mono text-xs break-words">
                                {change.secret && <span className="text-muted">secret replaced</span>}
                                {!change.secret && change.after === null && <span className="text-muted">put back (was {change.before})</span>}
                                {!change.secret && change.after !== null && <>{change.before !== null && <span className="text-muted">{change.before} → </span>}{change.after}</>}
                            </span>
                            <span className="text-xs sm:text-right">{change.playerId !== null && <Link to={`/players/${change.playerId}`} className="text-accent hover:underline">#{change.playerId}</Link>}</span>
                        </li>
                    ))}
                </ul>
            )}
        </Panel>
    );
};

/**
 * The server's settings: every option of every config section, where its value comes from
 * (its default, appsettings.json, this panel or the environment), and what waits on a restart.
 * The environment always wins over the panel; secrets can be replaced but are never shown.
 */
export const SettingsPage = () => {
    const [ params, setParams ] = useSearchParams();
    const tab = TABS.some(x => x.value === params.get('tab')) ? params.get('tab')! : 'settings';

    return (
        <>
            <PageHeader
                title="Settings"
                description="The server's settings: appsettings.json, overridden here, the environment over both"
                tabs={{ items: TABS, value: tab, onChange: value => setParams({ tab: value }, { replace: true }) }}
            />
            <PageBody className="flex flex-col gap-4 lg:gap-5">
                {tab === 'settings' && <SettingsTab />}
                {tab === 'history' && <HistoryTab />}
            </PageBody>
        </>
    );
};

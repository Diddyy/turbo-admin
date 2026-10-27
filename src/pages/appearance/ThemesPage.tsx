import { AppWindow, CopyPlus, FolderPen, ImageIcon, Layers, Palette, Plus, Power, PowerOff } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';

import { useThemes } from '#/api/appearance';
import { type PluginActionResponse, useSetPluginEnabled } from '#/api/plugins';
import { folderOf, useWorkingOn } from '#/appearance/workingOn';
import { ask } from '#/components/confirm';
import { toast, toastError } from '#/components/toast';
import { Badge, Button, EmptyState, ErrorNotice, Loading, PageBody, PageHeader, Panel } from '#/components/ui';
import { plural } from '#/lib/plural';

import { NewThemeDialog } from './NewThemeDialog';
import { ThemeAudienceControls } from './ThemeAudience';
import { themeName, themeTree } from './themes';

/** A plugin action's answer as a toast: what it did, or why not. */
const said = { onSuccess: (answer: PluginActionResponse) => (answer.ok ? toast(answer.message) : toastError(new Error(answer.message))), onError: toastError };

const link = 'inline-flex items-center gap-1 px-2 text-sm text-accent hover:underline';

/**
 * The themes as a tree (XenForo's Styles): Habbo's own look at the root, each theme under the one it
 * extends, with what it declares, what this hotel changed, whether it is on, and its pages.
 */
export const ThemesPage = () => {
    const { data, error } = useThemes();
    const setEnabled = useSetPluginEnabled();
    const tree = data ? themeTree(data.themes, data.base) : [];
    const working = useWorkingOn();
    const [ params, setParams ] = useSearchParams();
    // ?new=1 opens New theme (the Working on picker links here), ?copy=<key> Duplicate.
    const making = params.has('new') || params.has('copy');
    const closeMaking = () => setParams({}, { replace: true });

    return (
        <>
            <PageHeader title="Themes" description="Every theme the hotel runs, under the one it extends. Players draw the default theme, or one they chose; a theme in development (a new one too) reaches only the players and groups you give it. The one you work on is where every appearance editor saves.">
                {data?.canManage && <Button icon={<Plus />} onClick={() => setParams({ new: '1' }, { replace: true })}>New theme</Button>}
            </PageHeader>
            <PageBody className="flex flex-col gap-4 lg:gap-5">
                {error && <ErrorNotice error={error} />}
                {!data && !error && <Loading />}
                {data && (
                    <Panel>
                        <ul className="divide-y divide-line">
                            <li className="flex flex-wrap items-center gap-3 px-4 py-3">
                                <Palette className="size-4 text-muted" />
                                <span className="font-medium">{data.base}</span>
                                <Badge>built in</Badge>
                                <span className="text-xs text-muted">Habbo&apos;s own look as style properties, each the client&apos;s own until a theme or staff set it.</span>
                            </li>
                            {tree.map(({ theme, depth }) => (
                                <li key={theme.key} className="flex flex-wrap items-center gap-3 py-3 pr-4" style={{ paddingLeft: `${1 + depth * 1.5}rem` }} data-theme={theme.key}>
                                    <span className="text-muted">{depth > 0 ? '└' : ''}</span>
                                    <span className="font-medium">{themeName(theme)}</span>
                                    <span className="font-mono text-xs text-muted">{theme.key}</span>
                                    {theme.state === 'loaded' ? <Badge tone="green">on</Badge> : <Badge>{theme.state.replace('_', ' ')}</Badge>}
                                    {working.key === theme.key && <Badge tone="amber">{`working on: saves land in ${folderOf(theme.key)}`}</Badge>}
                                    {theme.error
                                        ? <span className="text-xs text-bad">{theme.error}</span>
                                        : (
                                                <span className="text-xs text-muted">
                                                    {`${theme.extends ? `extends ${theme.extends}, ` : ''}${plural(theme.styles, 'style property', 'style properties')} (${theme.own} its own), ${theme.changed} changed by this hotel`}
                                                </span>
                                            )}
                                    <ThemeAudienceControls themeKey={theme.key} />
                                    <span className="ml-auto flex flex-wrap items-center gap-1">
                                        <Link to={`/appearance/studio?${new URLSearchParams({ tab: 'settings', theme: theme.key })}`} className={link}><Palette className="size-4" />Edit in the studio</Link>
                                        <Link to={`/appearance/images/${encodeURIComponent(theme.key)}`} className={link}><ImageIcon className="size-4" />Images</Link>
                                        <Link to={`/appearance/patches#${encodeURIComponent(theme.key)}`} className={link}><Layers className="size-4" />Patches</Link>
                                        {data.canManage && working.key !== theme.key && <Button variant="ghost" icon={<FolderPen />} title={`Save every appearance edit into ${folderOf(theme.key)}`} onClick={() => working.setKey(theme.key)}>Work on it</Button>}
                                        {data.canManage && <Button variant="ghost" icon={<CopyPlus />} onClick={() => setParams({ copy: theme.key }, { replace: true })}>Duplicate</Button>}
                                        {data.canManage && theme.key !== 'hotel' && (theme.state === 'loaded'
                                            ? (
                                                    <Button
                                                        variant="ghost"
                                                        icon={<PowerOff />}
                                                        onClick={() => ask(
                                                            { title: `Turn ${themeName(theme)} off?`, body: 'Its styles, patches and images are taken away at each player\'s next load.', confirm: 'Turn off' },
                                                            () => setEnabled.mutate({ key: theme.key, enabled: false }, said),
                                                        )}
                                                    >
                                                        Turn off
                                                    </Button>
                                                )
                                            : <Button variant="ghost" icon={<Power />} onClick={() => setEnabled.mutate({ key: theme.key, enabled: true }, said)}>Turn on</Button>)}
                                    </span>
                                </li>
                            ))}
                        </ul>
                        {tree.length === 0 && <EmptyState>No theme yet.</EmptyState>}
                    </Panel>
                )}
                <NewThemeDialog open={making} copyOf={params.get('copy')} onClose={closeMaking} />
                <p className="flex items-center gap-1 text-xs text-muted">
                    <AppWindow className="size-3.5" />
                    A theme is a data plugin with a theme.json; this hotel&apos;s own changes are the theme &quot;This hotel&quot;, which extends Habbo&apos;s.
                </p>
            </PageBody>
        </>
    );
};

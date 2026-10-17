import { Download, Hammer, MonitorDown, RefreshCw, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { type HabboClientBuiltLibrary, useAssetJob, useHabboClientBuild, useStartClientBuild } from '#/api/bundles';
import { type HabboClientRelease, useCheckHabboClient, useForgetHabboClientRelease, useHabboClient } from '#/api/gamedata';
import { ask } from '#/components/confirm';
import { toastError } from '#/components/toast';
import { Badge, Button, ErrorNotice, IconButton, Loading, Panel } from '#/components/ui';
import { fromNow } from '#/lib/time';

const megabytes = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

const size = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : megabytes(bytes));

const KINDS: Record<HabboClientBuiltLibrary['kind'], string> = {
    avatar: 'avatar data',
    'variable-fx': 'Variable FX',
    texts: 'texts',
    chat: 'chat styles',
    template: 'templates',
    'window-manager': 'templates and theme',
};

/** The bundles built from the release followed, what the last build left out, and the templates' problems. */
const BuiltLibraries = ({ canManage }: { canManage: boolean }) => {
    const { data } = useHabboClientBuild();
    const { data: job } = useAssetJob();
    const build = useStartClientBuild();
    const [ showProblems, setShowProblems ] = useState(false);

    if (!data)
        return null;

    return (
        <>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line px-4 pt-3 pb-1">
                <span className="font-mono text-[11px] font-medium tracking-[0.08em] text-muted uppercase">Built from the client</span>
                <span className="text-xs text-muted">
                    {data.builtAt ? `${data.version}, ${fromNow(data.builtAt)}` : 'not built yet'}
                </span>
                {canManage && (
                    <Button
                        variant="secondary"
                        icon={<Hammer />}
                        className="ml-auto"
                        disabled={build.isPending || job?.status === 'running'}
                        title="Builds every library from the release followed again, whether it changed or not"
                        onClick={() => build.mutate(undefined, { onError: toastError })}
                    >
                        Build now
                    </Button>
                )}
            </div>
            {data.libraries.length > 0 && (
                <ul className="divide-y divide-line">
                    {data.libraries.map(x => (
                        <li key={x.library} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2">
                            <span className="min-w-0 font-mono text-sm">{x.library}</span>
                            <Badge>{KINDS[x.kind]}</Badge>
                            {x.uploaded && <span title="An upload in the library stands in its place: a build leaves it alone. Delete the upload to have it built."><Badge tone="red">your upload, not built</Badge></span>}
                            <span className="ml-auto text-xs text-muted">{[ size(x.size), x.updatedAt ? fromNow(x.updatedAt) : null ].filter(Boolean).join(' · ')}</span>
                        </li>
                    ))}
                </ul>
            )}
            {data.notes.length > 0 && (
                <ul className="border-t border-line px-4 py-2 text-xs text-muted">
                    {data.notes.map(x => <li key={x}>{x}</li>)}
                </ul>
            )}
            {data.problems.length > 0 && (
                <div className="border-t border-line px-4 py-2 text-xs">
                    <button type="button" className="text-muted hover:text-accent" onClick={() => setShowProblems(!showProblems)}>
                        {`${data.problems.length} template ${data.problems.length === 1 ? 'problem' : 'problems'}: a bitmap no library has, or a layout the client would refuse`}
                    </button>
                    {showProblems && <ul className="mt-1 font-mono text-[11px] leading-5 text-muted">{data.problems.map(x => <li key={x}>{x}</li>)}</ul>}
                </div>
            )}
        </>
    );
};

/** A release kept, and - opened - the client libraries in it. */
const ReleaseRow = ({ release, followed, canManage }: { release: HabboClientRelease; followed: boolean; canManage: boolean }) => {
    const [ open, setOpen ] = useState(false);
    const forget = useForgetHabboClientRelease();

    return (
        <li className="px-4 py-2.5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <button type="button" onClick={() => setOpen(!open)} className="min-w-0 text-left font-mono text-sm hover:text-accent">{release.version}</button>
                {followed && <Badge tone="green">built from</Badge>}
                {release.environments.map(x => <Badge key={x}>{x}</Badge>)}
                <span className="text-xs text-muted">
                    {[ `${release.libraries.length} libraries`, megabytes(release.size), release.builtAt ? `built ${fromNow(release.builtAt)}` : null, `taken ${fromNow(release.downloadedAt)}` ].filter(Boolean).join(' · ')}
                </span>
                {canManage && !followed && (
                    <IconButton
                        label={`Forget ${release.version}`}
                        icon={<Trash2 />}
                        tone="bad"
                        className="ml-auto"
                        disabled={forget.isPending}
                        onClick={() => ask(
                            { title: `Forget the release ${release.version}?`, body: 'Its files are removed; it is downloaded again if an environment serves it.', confirm: 'Forget' },
                            () => forget.mutate(release.version, { onError: toastError }),
                        )}
                    />
                )}
            </div>
            {open && <p className="mt-2 font-mono text-[11px] leading-5 text-muted">{release.libraries.map(x => x.replace(/^.*\//, '').replace(/\.hab$/, '')).join(' · ')}</p>}
        </li>
    );
};

/**
 * Habbo's HTML client, as the hotel takes it: what each environment serves, the releases kept,
 * and the one the hotel's client libraries are built from (Turbo:Gamedata:ClientEnvironment).
 */
export const HabboClientPanel = ({ canManage }: { canManage: boolean }) => {
    const { data, error } = useHabboClient();
    const check = useCheckHabboClient();

    if (error)
        return <ErrorNotice error={error} />;

    if (!data)
        return <Loading />;

    return (
        <Panel
            title="Habbo's HTML client"
            description={data.followed
                ? `The hotel's client libraries are built from ${data.followed}, ${data.follow}'s release.`
                : 'No release is downloaded yet: the client libraries are not built from Habbo\'s client.'}
            actions={canManage && (
                <Button variant="secondary" icon={<RefreshCw />} disabled={check.isPending} onClick={() => check.mutate(undefined, { onError: toastError })}>
                    {check.isPending ? 'Asking' : 'Check the client'}
                </Button>
            )}
        >
            <ul className="divide-y divide-line">
                {data.environments.map(x => (
                    <li key={x.environment} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
                        <MonitorDown className="size-4 text-muted" />
                        <span className="w-24 text-sm font-medium capitalize">{x.environment}</span>
                        <span className="font-mono text-sm">{x.liveVersion ?? <span className="text-muted">serves none</span>}</span>
                        {x.downloading && <Badge tone="accent"><Download className="mr-1 inline size-3" />downloading</Badge>}
                        {!x.downloading && x.liveVersion && x.version === x.liveVersion && <Badge tone="green">downloaded</Badge>}
                        {x.error && <Badge tone="red">{`can't ask: ${x.error}`}</Badge>}
                        {x.downloadError && !x.downloading && <Badge tone="red">{`not downloaded: ${x.downloadError}`}</Badge>}
                        <span className="ml-auto text-xs text-muted">{x.checkedAt ? `asked ${fromNow(x.checkedAt)}` : 'never asked'}</span>
                    </li>
                ))}
            </ul>
            {data.releases.length > 0 && (
                <>
                    <div className="border-t border-line px-4 pt-3 pb-1 font-mono text-[11px] font-medium tracking-[0.08em] text-muted uppercase">Releases kept</div>
                    <ul className="divide-y divide-line">
                        {data.releases.map(x => <ReleaseRow key={x.version} release={x} followed={x.version === data.followed} canManage={canManage} />)}
                    </ul>
                </>
            )}
            <BuiltLibraries canManage={canManage} />
        </Panel>
    );
};

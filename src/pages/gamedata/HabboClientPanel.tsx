import { Download, MonitorDown, RefreshCw, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { type HabboClientRelease, useCheckHabboClient, useForgetHabboClientRelease, useHabboClient } from '#/api/gamedata';
import { ask } from '#/components/confirm';
import { toastError } from '#/components/toast';
import { Badge, Button, ErrorNotice, IconButton, Loading, Panel } from '#/components/ui';
import { fromNow } from '#/lib/time';

const megabytes = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

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
        </Panel>
    );
};

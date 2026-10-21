import { Trash2 } from 'lucide-react';
import { useState } from 'react';

import type { HabboClientBuild, HabboClientBuiltLibrary } from '#/api/bundles';
import { type HabboClientRelease, type HabboClientStatus, useForgetHabboClientRelease } from '#/api/gamedata';
import { ask } from '#/components/confirm';
import { toastError } from '#/components/toast';
import { Badge, IconButton, Label } from '#/components/ui';
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
                    {[ `${release.libraries.length} libraries`, megabytes(release.size), release.builtAt ? `Habbo built it ${fromNow(release.builtAt)}` : null, `downloaded ${fromNow(release.downloadedAt)}` ].filter(Boolean).join(' · ')}
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
 * Habbo's HTML client in full, folded under its source on the Sources tab: the releases kept, the
 * bundles built from the one followed (Turbo:Gamedata:ClientEnvironment), what the last build left
 * out, and the templates' problems.
 */
export const HabboClientDetails = ({ client, build, canManage }: { client: HabboClientStatus; build: HabboClientBuild | undefined; canManage: boolean }) => {
    const [ showProblems, setShowProblems ] = useState(false);

    return (
        <div className="divide-y divide-line">
            {client.releases.length > 0 && (
                <div>
                    <Label as="div" className="px-4 pt-3 pb-1">Releases kept</Label>
                    <ul className="divide-y divide-line">
                        {client.releases.map(x => <ReleaseRow key={x.version} release={x} followed={x.version === client.followed} canManage={canManage} />)}
                    </ul>
                </div>
            )}
            {build && build.libraries.length > 0 && (
                <div>
                    <Label as="div" className="px-4 pt-3 pb-1">{build.version ? `Bundles built from ${build.version}` : 'Bundles built from the client'}</Label>
                    <ul className="divide-y divide-line">
                        {build.libraries.map(x => (
                            <li key={x.library} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2">
                                <span className="min-w-0 font-mono text-sm">{x.library}</span>
                                <Badge>{KINDS[x.kind]}</Badge>
                                {x.uploaded && <span title="An upload in the library stands in its place: a build leaves it alone. Delete the upload to have it built."><Badge tone="red">your upload, not built</Badge></span>}
                                <span className="ml-auto text-xs text-muted">{[ size(x.size), x.updatedAt ? `updated ${fromNow(x.updatedAt)}` : null ].filter(Boolean).join(' · ')}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            {build && build.notes.length > 0 && (
                <div className="px-4 py-2.5">
                    <Label as="div" className="pb-1">What the last build said</Label>
                    <ul className="text-xs leading-5 text-muted">
                        {build.notes.map(x => <li key={x}>{x}</li>)}
                    </ul>
                </div>
            )}
            {build && build.problems.length > 0 && (
                <div className="px-4 py-2.5 text-xs">
                    <button type="button" className="text-muted hover:text-accent" onClick={() => setShowProblems(!showProblems)}>
                        {`${build.problems.length} template ${build.problems.length === 1 ? 'problem' : 'problems'}: a bitmap no library has, or a layout the client would refuse`}
                    </button>
                    {showProblems && <ul className="mt-1 font-mono text-[11px] leading-5 text-muted">{build.problems.map(x => <li key={x}>{x}</li>)}</ul>}
                </div>
            )}
        </div>
    );
};

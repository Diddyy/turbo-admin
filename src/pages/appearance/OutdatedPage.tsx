import { useQueries } from '@tanstack/react-query';
import { CircleCheck } from 'lucide-react';
import { Link } from 'react-router';

import type { PluginTemplatePatch } from '#/api/appearance';
import { api } from '#/api/client';
import { usePatches } from '#/api/noCode';
import { usePlugins } from '#/api/plugins';
import { useTemplateIndex } from '#/api/windows';
import { useWorkingOn } from '#/appearance/workingOn';
import { Badge, EmptyState, ErrorNotice, Loading, PageBody, PageHeader, Panel } from '#/components/ui';

import { outdatedReasons } from './outdated';

/** One patch to check: whose it is, its window and ops, and where staff edit it. */
interface Checked {
    owner: string;
    name: string;
    template: string;
    ops: unknown;
}

/**
 * The patches a client update broke (XenForo's Outdated templates): each whose window, or an element
 * it names, is gone from the client the hotel runs now, with why, so a client update never silently
 * breaks a theme. Checked against the client's template index, before any player's client reports it.
 */
export const OutdatedPage = () => {
    const { data: index, error } = useTemplateIndex();
    const { data: hotel } = usePatches(useWorkingOn().key);
    const { data: plugins } = usePlugins();
    const others = (plugins?.plugins ?? []).filter(plugin => plugin.key !== (hotel?.key ?? 'hotel') && plugin.state === 'loaded');
    const files = useQueries({
        queries: others.map(plugin => ({
            queryKey: [ 'plugins', plugin.key, 'template-patches' ],
            queryFn: () => api<{ key: string; patches: PluginTemplatePatch[] }>(`/plugins/${encodeURIComponent(plugin.key)}/template-patches`),
        })),
    });
    const all: Checked[] = [
        ...(hotel?.patches.filter(patch => !patch.disabled).map(patch => ({ owner: hotel.key, name: patch.name, template: patch.template, ops: patch.ops })) ?? []),
        ...files.flatMap(file => file.data?.patches.map(patch => ({ owner: file.data.key, name: patch.template, template: patch.template, ops: patch.ops })) ?? []),
    ];
    const outdated = index ? all.map(patch => ({ patch, reasons: outdatedReasons(index, patch.template, patch.ops) })).filter(each => each.reasons.length > 0) : [];
    const loading = !index || !hotel || !plugins || files.some(file => file.isPending);

    return (
        <>
            <PageHeader title="Outdated patches" description="Patches naming a window or an element the client the hotel runs no longer has: a client update renamed or took it out. Fix the key (Windows & skins has the current ones) or remove the patch." />
            <PageBody className="flex flex-col gap-4 lg:gap-5">
                {error && <ErrorNotice error={error} />}
                {loading && !error && <Loading />}
                {!loading && (
                    <Panel title={`${outdated.length} of ${all.length} patch(es) outdated`} description="Checked against this client's template-index.json; the hotel's turned-off patches are left out.">
                        {outdated.length === 0 && <EmptyState icon={<CircleCheck />}>Every patch still finds its window and elements.</EmptyState>}
                        <ul className="divide-y divide-line">
                            {outdated.map(({ patch, reasons }, at) => (
                                <li key={`${patch.owner}-${patch.name}-${at}`} className="flex flex-col gap-1 px-4 py-3" data-outdated={patch.template}>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Badge tone="red">outdated</Badge>
                                        <span className="font-medium">{patch.name}</span>
                                        <span className="font-mono text-xs text-muted">{patch.template}</span>
                                        <span className="text-xs text-muted">{`by ${patch.owner === 'hotel' ? 'this hotel' : patch.owner}`}</span>
                                        <Link to={`/appearance/patches#${encodeURIComponent(patch.owner)}`} className="ml-auto text-xs text-accent hover:underline">Edit</Link>
                                        {index?.templates[patch.template] && <Link to={`/appearance/windows/windows?${new URLSearchParams({ id: patch.template })}`} className="text-xs text-accent hover:underline">Current elements</Link>}
                                    </div>
                                    {reasons.map(reason => <p key={reason.element ?? ''} className="text-sm text-bad">{reason.text}</p>)}
                                </li>
                            ))}
                        </ul>
                    </Panel>
                )}
            </PageBody>
        </>
    );
};

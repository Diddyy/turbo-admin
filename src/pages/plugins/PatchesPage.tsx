import { AppWindow, Package, Plus, Power, PowerOff, Save, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { type HotelPatch, useHotelPatches, useRemoveHotelPatch, useSaveHotelPatch } from '#/api/noCode';
import { type Plugin, usePluginContributions, usePlugins } from '#/api/plugins';
import { ask } from '#/components/confirm';
import { toast, toastError } from '#/components/toast';
import { Badge, Button, EmptyState, ErrorNotice, Input, Labeled, Loading, PageBody, PageHeader, Panel, Textarea } from '#/components/ui';

import { PackageDialog } from './PackageDialog';
import { PatchTest } from './PatchTest';

/** How a patch stands in players' clients, by the reports' kinds. */
const TONES: Record<string, 'green' | 'amber' | 'red'> = { 'patch.applied': 'green', 'patch.unmatched': 'amber', 'patch.conflict': 'amber', 'patch.ineffective': 'amber', 'module.failed': 'red' };

/**
 * What a pasted text is as a patch: the inspector's "copy patch" (`api.templates.patch('<id>', [ ...ops ])`
 * or a file entry `{ "template", "ops" }`) or the ops alone. Null when it is no JSON at all.
 */
const readPasted = (text: string): { template?: string; ops: unknown } | null => {
    const call = /templates\.patch\(\s*['"]([^'"]+)['"]\s*,\s*([\s\S]*)\)\s*;?\s*$/.exec(text.trim());

    try {
        if (call) return { template: call[1], ops: JSON.parse(call[2]!.replace(/([{,]\s*)([A-Za-z_]\w*)\s*:/g, '$1"$2":').replace(/'/g, '"')) as unknown };

        const parsed = JSON.parse(text) as unknown;

        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && 'ops' in parsed)
            return parsed as { template?: string; ops: unknown };

        return { ops: Array.isArray(parsed) ? parsed : [ parsed ] };
    } catch {
        return null;
    }
};

/** A patch's form; a `patch` with no id (a draft from the windows browser) is saved as a new one. */
export const PatchEditor = ({ patch, onDone }: { patch: HotelPatch | null; onDone: () => void }) => {
    const [ name, setName ] = useState(patch?.name ?? '');
    const [ template, setTemplate ] = useState(patch?.template ?? '');
    const [ order, setOrder ] = useState(patch?.order === null || patch?.order === undefined ? '' : String(patch.order));
    const [ ops, setOps ] = useState(patch ? JSON.stringify(patch.ops, null, 2) : '[\n  { "element": "help_button", "set": { "color": 4281244476 } }\n]');
    const save = useSaveHotelPatch();
    const pasted = readPasted(ops);
    const problem = pasted === null ? 'The ops are not JSON yet.' : !Array.isArray(pasted.ops) ? 'The ops are a list: [ { "element": ..., "set": { ... } } ].' : null;

    return (
        <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
                event.preventDefault();

                if (!pasted || problem) return;

                save.mutate(
                    { id: patch?.id ?? '', name, template: pasted.template ?? template, order: order === '' ? null : Number(order), ops: pasted.ops, disabled: patch?.disabled ?? false },
                    { onSuccess: () => {
                        toast(`${name}: saved. Players get it at their next load.`);
                        onDone();
                    } },
                );
            }}
        >
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_8rem]">
                <Labeled label="Name"><Input value={name} onChange={event => setName(event.target.value)} placeholder="Green help button" className="w-full" /></Labeled>
                <Labeled label="Template" hint={<>{'<library>/<asset>, as '}<Link to="/plugins/windows" className="text-accent hover:underline">Windows &amp; skins</Link>{' lists it.'}</>}><Input value={pasted?.template ?? template} onChange={event => setTemplate(event.target.value)} placeholder="habbo-toolbar-com/purse_xml" className="w-full font-mono" /></Labeled>
                <Labeled label="Order" hint="Lower first; a theme takes a negative one."><Input type="number" value={order} onChange={event => setOrder(event.target.value)} className="w-full" /></Labeled>
            </div>
            <Labeled label="Ops" hint="JSON: each names its element and does one of set, remove, insert, move, wrap or bind (a value per window or per list row, from placeholders such as ctx.key and item.key). Paste the client's alt-click &quot;copy patch&quot; straight in.">
                <Textarea value={ops} onChange={event => setOps(event.target.value)} rows={10} className="font-mono text-xs" spellCheck={false} />
            </Labeled>
            {problem && <p className="text-xs text-warn">{problem}</p>}
            {!problem && pasted && <PatchTest template={pasted.template ?? template} ops={pasted.ops as unknown[]} />}
            {save.error && <ErrorNotice error={save.error} />}
            <div className="flex gap-2">
                <Button type="submit" icon={<Save />} disabled={save.isPending || !!problem || !name.trim()}>{save.isPending ? 'Saving...' : 'Save'}</Button>
                <Button variant="ghost" icon={<X />} onClick={onDone}>Cancel</Button>
                {/* The hotel's plugin is loaded again to serve the new file, which takes a few seconds: said, so a click is not taken for nothing. */}
                {save.isPending && <span className="self-center text-xs text-muted">Loading the hotel plugin again with it; this takes a few seconds.</span>}
            </div>
        </form>
    );
};

/** The hotel's own patches: made, edited, turned off and removed here; held by its data plugin. */
const HotelPatches = () => {
    const { data, error } = useHotelPatches();
    const save = useSaveHotelPatch();
    const remove = useRemoveHotelPatch();
    const [ open, setOpen ] = useState<string | null>(null);
    const [ packaging, setPackaging ] = useState(false);

    return (
        <Panel
            title="This hotel's patches"
            description="Kept in the hotel's own data plugin (hotel): turning it off on the Plugins page takes them all away at once."
            actions={data?.canManage && (
                <div className="flex gap-2">
                    <Button variant="secondary" icon={<Package />} disabled={!data.patches.length} onClick={() => setPackaging(true)}>Make a plugin</Button>
                    <Button icon={<Plus />} onClick={() => setOpen('new')}>New patch</Button>
                </div>
            )}
        >
            {error && <div className="p-4"><ErrorNotice error={error} /></div>}
            {!data && !error && <Loading />}
            {open === 'new' && <div className="border-b border-line p-4"><PatchEditor patch={null} onDone={() => setOpen(null)} /></div>}
            {data && data.patches.length === 0 && open !== 'new' && <EmptyState>No patches of the hotel&apos;s own yet.</EmptyState>}
            <ul className="divide-y divide-line">
                {data?.patches.map(patch => (
                    <li key={patch.id} className="flex flex-col gap-2 px-4 py-3">
                        <div className="flex flex-wrap items-center gap-3">
                            <button type="button" className="font-medium hover:text-accent" onClick={() => setOpen(open === patch.id ? null : patch.id)}>{patch.name}</button>
                            <span className="font-mono text-xs text-muted">{patch.template}</span>
                            <span className="text-xs text-muted">{Array.isArray(patch.ops) ? patch.ops.length : 0} op(s)</span>
                            {patch.disabled ? <Badge>off</Badge> : <Badge tone="green">on</Badge>}
                            {data.canManage && (
                                <span className="ml-auto flex gap-1">
                                    <Button variant="ghost" icon={patch.disabled ? <Power /> : <PowerOff />} disabled={save.isPending} onClick={() => save.mutate({ ...patch, disabled: !patch.disabled }, { onError: toastError })}>
                                        {patch.disabled ? 'Turn on' : 'Turn off'}
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        icon={<Trash2 />}
                                        className="text-bad hover:text-bad"
                                        onClick={() => ask({ title: `Remove the patch ${patch.name}?`, confirm: 'Remove', danger: true }, () => remove.mutate(patch.id, { onError: toastError }))}
                                    >
                                        Remove
                                    </Button>
                                </span>
                            )}
                        </div>
                        {open === patch.id && <PatchEditor patch={patch} onDone={() => setOpen(null)} />}
                    </li>
                ))}
            </ul>
            <PackageDialog pluginKey={data?.key ?? 'hotel'} open={packaging} onClose={() => setPackaging(false)} />
        </Panel>
    );
};

/** One plugin's patches per window, with what players' clients report of them. */
const PluginPatches = ({ plugin }: { plugin: Plugin }) => {
    const { data } = usePluginContributions(plugin.key);
    const patches = data?.items.filter(item => item.kind === 'template-patch') ?? [];
    const issues = data?.clientIssues.filter(issue => issue.kind.startsWith('patch.')) ?? [];

    if (patches.length === 0 && issues.length === 0) return null;

    return (
        <li className="flex flex-col gap-1.5 px-4 py-3">
            <div className="flex items-center gap-2">
                <span className="font-medium">{plugin.name ?? plugin.key}</span>
                <span className="font-mono text-xs text-muted">{plugin.key}</span>
                <Link to={`/plugins/${encodeURIComponent(plugin.key)}/theme`} className="ml-auto text-xs text-accent hover:underline">Theme</Link>
            </div>
            {patches.map(patch => (
                <div key={patch.name} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-mono">{patch.name}</span>
                    <span className="text-xs text-muted">{patch.detail}</span>
                    {issues.filter(issue => issue.subject === patch.name).map(issue => (
                        <Badge key={issue.kind} tone={TONES[issue.kind] ?? 'neutral'}>{`${issue.kind.slice('patch.'.length)} - ${issue.clients} client(s)`}</Badge>
                    ))}
                </div>
            ))}
            {issues.filter(issue => issue.kind !== 'patch.applied').map(issue => <p key={`${issue.kind}-${issue.subject}`} className="text-xs text-warn">{`${issue.subject}: ${issue.message}`}</p>)}
        </li>
    );
};

/**
 * Every window patch the hotel's clients are given: each plugin's (with what clients report of
 * them: applied, unmatched by a new client release, conflicting with another owner's), and the
 * hotel's own, which staff make here.
 */
export const PatchesPage = () => {
    const { data, error } = usePlugins();
    const live = data?.plugins.filter(plugin => plugin.state === 'loaded') ?? [];

    return (
        <>
            <PageHeader title="Template patches" description="Changes to the game's windows, as data: by plugin and by this hotel. Players get a change at their next load." back={{ to: '/plugins', label: 'Plugins' }}>
                <Link to="/plugins/windows" className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-subtle">
                    <AppWindow className="size-4" />
                    Windows &amp; skins
                </Link>
            </PageHeader>
            <PageBody className="flex flex-col gap-4 lg:gap-5">
                {error && <ErrorNotice error={error} />}
                <HotelPatches />
                <Panel title="Plugins' patches" description="From each loaded plugin's wwwroot/template-patches.json; what clients report beside each window.">
                    {!data && !error && <Loading />}
                    <ul className="divide-y divide-line">{live.map(plugin => <PluginPatches key={plugin.key} plugin={plugin} />)}</ul>
                </Panel>
            </PageBody>
        </>
    );
};

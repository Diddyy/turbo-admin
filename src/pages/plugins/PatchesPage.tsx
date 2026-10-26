import { AppWindow, Package, Plus, Power, PowerOff, Save, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { usePluginTemplatePatches } from '#/api/appearance';
import { type HotelPatch, useHotelPatches, useRemoveHotelPatch, useSaveHotelPatch } from '#/api/noCode';
import { type Plugin, type PluginActionResponse, type PluginClientIssue, usePluginContributions, usePlugins, useSetPluginEnabled } from '#/api/plugins';
import { useTemplateIndex } from '#/api/windows';
import { ask } from '#/components/confirm';
import { useSaved } from '#/components/SaveFeedback';
import { toast, toastError } from '#/components/toast';
import { Badge, Button, EmptyState, ErrorNotice, Input, Labeled, Loading, PageBody, PageHeader, Panel, Textarea } from '#/components/ui';
import { outdatedReasons } from '#/pages/appearance/outdated';
import { DesignPreview, type DesignSelection } from '#/preview/DesignPreview';

import { PackageDialog } from './PackageDialog';
import { PatchTest } from './PatchTest';

/** How a patch stands in players' clients, by the reports' kinds. */
const TONES: Record<string, 'green' | 'amber' | 'red'> = { 'patch.applied': 'green', 'patch.unmatched': 'amber', 'patch.conflict': 'amber', 'patch.ineffective': 'amber', 'module.failed': 'red' };

/** The reports a window's patches get, in the order the counts read: applied / unmatched / ineffective, then a clash. */
const COUNTED = [ 'patch.applied', 'patch.unmatched', 'patch.ineffective' ] as const;

/**
 * The reports that are about one patch: its window's applied figure, and each other report whose
 * element (the client's reason: `name`, `name:what`, `name.property`) one of its ops names.
 */
const issuesOf = (issues: readonly PluginClientIssue[], template: string, ops: unknown) => {
    const elements = (Array.isArray(ops) ? ops : []).flatMap(op => (op && typeof op === 'object' && typeof (op as { element?: unknown }).element === 'string' ? [ (op as { element: string }).element ] : []));

    return issues.filter(issue => issue.subject === template && (issue.kind === 'patch.applied' || elements.some(element => issue.reason === element || issue.reason.startsWith(`${element}:`) || issue.reason.startsWith(`${element}.`))));
};

/**
 * How many players' clients report a patch applied, unmatched and ineffective (XenForo's 1/0/0,
 * but live), a clash with another owner's beside them; what a client said of a patch that does not
 * apply is under it.
 */
const ClientCounts = ({ issues, template, ops }: { issues: readonly PluginClientIssue[]; template: string; ops: unknown }) => {
    const mine = issuesOf(issues, template, ops);
    const count = (kind: string) => mine.filter(issue => issue.kind === kind).reduce((sum, issue) => sum + issue.clients, 0);
    const conflicts = count('patch.conflict');

    return (
        <span className="inline-flex flex-wrap items-center gap-1" title="Players' clients reporting this window's patches: applied / unmatched / ineffective">
            {COUNTED.map(kind => <Badge key={kind} tone={count(kind) > 0 ? TONES[kind] : 'neutral'}>{`${kind.slice('patch.'.length)} ${count(kind)}`}</Badge>)}
            {conflicts > 0 && <Badge tone="amber">{`conflict ${conflicts}`}</Badge>}
        </span>
    );
};

/** What clients said of a patch that did not apply, one line each. */
const ClientWords = ({ issues, template, ops }: { issues: readonly PluginClientIssue[]; template: string; ops: unknown }) => issuesOf(issues, template, ops)
    .filter(issue => issue.kind !== 'patch.applied')
    .map(issue => <p key={`${issue.kind}-${issue.reason}`} className="text-xs text-warn">{issue.message}</p>);

/** What of a patch is gone from the client the hotel runs, said in place (Outdated patches lists them all). */
const Outdated = ({ template, ops }: { template: string; ops: unknown }) => {
    const { data: index } = useTemplateIndex();
    const reasons = index ? outdatedReasons(index, template, ops) : [];

    return reasons.map(reason => (
        <p key={reason.element ?? ''} className="text-xs text-bad">
            <Badge tone="red">outdated</Badge>
            {` ${reason.text}`}
        </p>
    ));
};

/** A plugin action's answer as a toast: what it did, or why not. */
const said = { onSuccess: (answer: PluginActionResponse) => (answer.ok ? toast(answer.message) : toastError(new Error(answer.message))), onError: toastError };

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
    const saved = useSaved();
    const hotel = useHotelPatches().data;
    const [ picked, setPicked ] = useState<DesignSelection | null>(null);
    const pasted = readPasted(ops);
    const problem = pasted === null ? 'The ops are not JSON yet.' : !Array.isArray(pasted.ops) ? 'The ops are a list: [ { "element": ..., "set": { ... } } ].' : null;
    const target = pasted?.template ?? template;
    // The hotel's patch file as players would get it with this draft saved: its other patches that are on, and this one.
    const others = hotel?.patches.filter(other => !other.disabled && other.id !== patch?.id).map(other => ({ template: other.template, ops: other.ops, order: other.order })) ?? [];
    const draft = (!problem && pasted && hotel)
        ? { patches: { [hotel.key]: { patches: [ ...others, { template: target, ops: pasted.ops, order: order === '' ? null : Number(order) } ] } } }
        : undefined;

    return (
        <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
                event.preventDefault();

                if (!pasted || problem) return;

                save.mutate(
                    { id: patch?.id ?? '', name, template: pasted.template ?? template, order: order === '' ? null : Number(order), ops: pasted.ops, disabled: patch?.disabled ?? false },
                    { onSuccess: () => {
                        saved(name);
                        onDone();
                    } },
                );
            }}
        >
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_8rem]">
                <Labeled label="Name"><Input value={name} onChange={event => setName(event.target.value)} placeholder="Green help button" className="w-full" /></Labeled>
                <Labeled label="Template" hint={<>{'<library>/<asset>, as '}<Link to="/appearance/windows" className="text-accent hover:underline">Windows &amp; skins</Link>{' lists it.'}</>}><Input value={pasted?.template ?? template} onChange={event => setTemplate(event.target.value)} placeholder="habbo-toolbar-com/purse_xml" className="w-full font-mono" /></Labeled>
                <Labeled label="Order" hint="Lower first; a theme takes a negative one."><Input type="number" value={order} onChange={event => setOrder(event.target.value)} className="w-full" /></Labeled>
            </div>
            <Labeled label="Ops" hint="JSON: each names its element and does one of set, remove, insert, move, wrap or bind (a value per window or per list row, from placeholders such as ctx.key and item.key). Paste the client's alt-click &quot;copy patch&quot; straight in.">
                <Textarea value={ops} onChange={event => setOps(event.target.value)} rows={10} className="font-mono text-xs" spellCheck={false} />
            </Labeled>
            {problem && <p className="text-xs text-warn">{problem}</p>}
            {!problem && pasted && <PatchTest template={pasted.template ?? template} ops={pasted.ops as unknown[]} />}
            {target && (
                <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-muted">Preview: the window as players will see it once saved, drawn by the client as you type</span>
                    <DesignPreview template={target} draft={draft} owner={hotel?.key} onSelect={setPicked} />
                </div>
            )}
            {picked?.key !== null && picked !== null && !problem && pasted && (
                <div>
                    <Button
                        variant="secondary"
                        icon={<Plus />}
                        onClick={() => setOps(JSON.stringify([ ...(pasted.ops as unknown[]), { element: picked.key, set: {} } ], null, 2))}
                    >
                        {`Add an op on '${picked.key}'`}
                    </Button>
                </div>
            )}
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
    const issues = usePluginContributions(data?.key ?? 'hotel').data?.clientIssues.filter(issue => issue.kind.startsWith('patch.')) ?? [];
    const save = useSaveHotelPatch();
    const remove = useRemoveHotelPatch();
    const [ open, setOpen ] = useState<string | null>(null);
    const [ packaging, setPackaging ] = useState(false);

    return (
        <Panel
            title="This hotel (hotel)"
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
                            {!patch.disabled && <ClientCounts issues={issues} template={patch.template} ops={patch.ops} />}
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
                        <Outdated template={patch.template} ops={patch.ops} />
                        {!patch.disabled && <ClientWords issues={issues} template={patch.template} ops={patch.ops} />}
                        {open === patch.id && <PatchEditor patch={patch} onDone={() => setOpen(null)} />}
                    </li>
                ))}
            </ul>
            <PackageDialog pluginKey={data?.key ?? 'hotel'} open={packaging} onClose={() => setPackaging(false)} />
        </Panel>
    );
};

/**
 * One plugin's patches, as its wwwroot/template-patches.json gives them: each window with its ops,
 * what players' clients report of it and what is gone from the current client; the plugin turned
 * off or on here takes them all away or back.
 */
const PluginPatches = ({ plugin, canManage }: { plugin: Plugin; canManage: boolean }) => {
    const { data } = usePluginTemplatePatches(plugin.key);
    const contributions = usePluginContributions(plugin.key).data;
    const setEnabled = useSetPluginEnabled();
    const patches = data?.patches ?? [];
    const issues = contributions?.clientIssues.filter(issue => issue.kind.startsWith('patch.')) ?? [];

    if (patches.length === 0 && issues.length === 0) return null;

    return (
        <li id={plugin.key} className="flex scroll-mt-20 flex-col gap-2 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{plugin.name ?? plugin.key}</span>
                <span className="font-mono text-xs text-muted">{plugin.key}</span>
                {plugin.state === 'loaded' ? <Badge tone="green">on</Badge> : <Badge>{plugin.state.replace('_', ' ')}</Badge>}
                <span className="text-xs text-muted">{`${patches.length} patch(es)`}</span>
                <span className="ml-auto flex gap-1">
                    <Link to={`/appearance/styles/${encodeURIComponent(plugin.key)}`} className="px-2 text-xs text-accent hover:underline">Style properties</Link>
                    {canManage && (plugin.state === 'loaded'
                        ? <Button variant="ghost" icon={<PowerOff />} disabled={setEnabled.isPending} onClick={() => ask({ title: `Turn ${plugin.name ?? plugin.key} off?`, body: 'Its patches, styles and everything else it adds are taken away; players lose them at their next load.', confirm: 'Turn off' }, () => setEnabled.mutate({ key: plugin.key, enabled: false }, said))}>Turn off</Button>
                        : <Button variant="ghost" icon={<Power />} disabled={setEnabled.isPending} onClick={() => setEnabled.mutate({ key: plugin.key, enabled: true }, said)}>Turn on</Button>)}
                </span>
            </div>
            <ul className="flex flex-col gap-1.5">
                {patches.map((patch, at) => (
                    <li key={`${patch.template}-${at}`} className="flex flex-col gap-1 text-sm">
                        <div className="flex flex-wrap items-center gap-2">
                            <Link to={`/appearance/windows/windows?${new URLSearchParams({ id: patch.template })}`} className="font-mono hover:text-accent">{patch.template}</Link>
                            <span className="text-xs text-muted">{`${Array.isArray(patch.ops) ? patch.ops.length : 0} op(s)${patch.order === null ? '' : `, order ${patch.order}`}`}</span>
                            <ClientCounts issues={issues} template={patch.template} ops={patch.ops} />
                        </div>
                        <Outdated template={patch.template} ops={patch.ops} />
                        <ClientWords issues={issues} template={patch.template} ops={patch.ops} />
                    </li>
                ))}
            </ul>
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
    const { data: hotel } = useHotelPatches();
    // Each owner's group: the plugins that are on, then those turned off, whose patches come back with them.
    const owners = [ ...(data?.plugins ?? []) ].filter(plugin => plugin.key !== (hotel?.key ?? 'hotel')).sort((a, b) => Number(b.state === 'loaded') - Number(a.state === 'loaded'));

    return (
        <>
            <PageHeader title="Template patches" description="Changes to the game's windows, as data, by who made them: this hotel and each plugin. Beside each window: how many players' clients report it applied / unmatched / ineffective, and what a client update took away. Players get a change at their next load.">
                <Link to="/appearance/windows" className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-subtle">
                    <AppWindow className="size-4" />
                    Windows &amp; skins
                </Link>
            </PageHeader>
            <PageBody className="flex flex-col gap-4 lg:gap-5">
                {error && <ErrorNotice error={error} />}
                <HotelPatches />
                <Panel title="Plugins" description="From each plugin's wwwroot/template-patches.json, by plugin.">
                    {!data && !error && <Loading />}
                    <ul className="divide-y divide-line">{owners.map(plugin => <PluginPatches key={plugin.key} plugin={plugin} canManage={!!data?.canManage} />)}</ul>
                </Panel>
            </PageBody>
        </>
    );
};

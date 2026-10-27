import { useQueryClient } from '@tanstack/react-query';
import { Copy, Plus, RefreshCw, RotateCcw, Upload } from 'lucide-react';
import { type ReactNode, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { useClientAssets } from '#/api/assets';
import { useTextSearch } from '#/api/gamedata';
import { type HotelPatch, type PluginStyle, uploadPluginImage, useHotelOverlays, useOverlayChange, usePatches, usePluginStyles, useStyleChange } from '#/api/noCode';
import { type Plugin, usePluginContributions, usePlugins } from '#/api/plugins';
import { readWindowsAgain, type SkinEntry, type SkinMap, type SkinSprite, type TemplateIndex, type ThemeSheet, useSkinMap, useTemplateIndex, useThemeSheet, type WindowElement, windowOf } from '#/api/windows';
import { useWorkingOn } from '#/appearance/workingOn';
import { WorkingOnPicker } from '#/appearance/WorkingOnPicker';
import { useSaved } from '#/components/SaveFeedback';
import { SearchInput } from '#/components/SearchInput';
import { toast, toastError } from '#/components/toast';
import { Badge, Button, EmptyState, ErrorNotice, Loading, PageBody, PageHeader, Panel } from '#/components/ui';
import { useDebounced } from '#/lib/debounce';
import { usePathTab } from '#/lib/tabs';
import { DesignPreview } from '#/preview/DesignPreview';

import { PatchEditor } from './PatchesPage';
import { SkinSetUpload } from './SkinSetUpload';
import { WindowTree } from './WindowTree';

const TABS = [
    { value: 'windows', label: 'Windows', to: '/appearance/advanced/windows/windows' },
    { value: 'skins', label: 'Skins', to: '/appearance/advanced/windows/skins' },
];

/** How a patch stands in players' clients, by the reports' kinds (as on Template patches). */
const TONES: Record<string, 'green' | 'amber' | 'red'> = { 'patch.applied': 'green', 'patch.unmatched': 'amber', 'patch.conflict': 'amber', 'patch.ineffective': 'amber', 'module.failed': 'red' };

const LIST_LIMIT = 200;

/** Every element of a tree, depth first. */
const flat = (elements: readonly WindowElement[]): WindowElement[] => elements.flatMap(element => [ element, ...flat(element.children ?? []) ]);

/** The skins each element of a window draws, by its key. */
const skinsByKey = (skins: SkinMap | undefined, id: string) => {
    const found = new Map<string, string[]>();

    for (const [ skin, entry ] of Object.entries(skins?.skins ?? {})) {
        for (const key of entry.windows[id] ?? []) found.set(key, [ ...(found.get(key) ?? []), skin ]);
    }

    return found;
};

/** Whether a window has the words: in its id, its name, or an element's key, name, caption or text key - or shows a text the words found. */
const matches = (index: TemplateIndex, id: string, words: string, shown: ReadonlySet<string>) => {
    if (!words) return true;

    if (id.toLowerCase().includes(words)) return true;

    const found = windowOf(index, id);

    return !!found && (found.name.toLowerCase().includes(words) || flat(found.elements).some(element => [ element.key, element.name, element.caption, ...(element.texts ?? []) ].some(value => value?.toLowerCase().includes(words))
        || element.texts?.some(text => shown.has(text))));
};

/** A sprite cut from the theme sheet at its own size, as players see it untinted. */
const Sprite = ({ sheet, sprite, rect }: { sheet: ThemeSheet | undefined; sprite: string; rect?: SkinSprite['rect'] }) => {
    const frame = sheet?.frames[sprite];

    if (!sheet || !frame) return <span className="inline-block size-8 rounded border border-dashed border-line" />;

    const x = frame.x + (rect?.x ?? 0);
    const y = frame.y + (rect?.y ?? 0);
    const width = rect?.width ?? frame.w;
    const height = rect?.height ?? frame.h;

    return <span className="inline-block shrink-0 border border-line [image-rendering:pixelated]" style={{ width, height, background: `url(${sheet.url}) -${x}px -${y}px` }} title={`${width}x${height}`} />;
};

const IMAGE_TYPES = 'image/png,image/gif,image/jpeg,image/webp';

/** Where a sprite's replacement goes: the plugin its image is uploaded into, and what the hotel already replaces. */
interface Replacing {
    /** The plugin the image is uploaded into (`wwwroot/styles/`); the hotel's own by default. */
    target: string;
    /** The hotel's `asset.overlays` entries: a url per overlay key. */
    overlays: Record<string, string>;
    /** The hotel's image styles by the overlay they stand in for (the base theme declares the window frames and the purse's). */
    styles: Map<string, PluginStyle>;
    canManage: boolean;
}

/**
 * Upload replacement: the image goes into the target plugin's images, under the sprite's own name;
 * then the base theme's image style for that sprite takes it (so the Theme tab shows it and resets
 * it), or else the hotel's `asset.overlays` entry for the sprite. Remove gives the sprite back.
 */
const SpriteReplacement = ({ sprite, replacing }: { sprite: SkinSprite; replacing: Replacing }) => {
    const overlay = useOverlayChange(replacing.target);
    const style = useStyleChange(replacing.target, true);
    const saved = useSaved();
    const [ uploading, setUploading ] = useState(false);
    const styled = replacing.styles.get(sprite.overlay);
    const current = replacing.overlays[sprite.overlay];
    const busy = uploading || overlay.isPending || style.isPending;

    const upload = async (file: File) => {
        setUploading(true);

        try {
            const extension = /\.[a-z0-9]+$/i.exec(file.name)?.[0].toLowerCase() ?? '';
            const image = await uploadPluginImage(replacing.target, file, `${sprite.overlay.split('/').pop()}${extension}`);

            // The style is the target's own (the hotel's value, or the theme's default): it names its own image by its path.
            if (styled) await style.mutateAsync({ name: styled.name, value: image.path });
            else await overlay.mutateAsync({ overlay: sprite.overlay, url: image.url });

            saved(`${sprite.sprite}: replaced by ${image.path} (${replacing.target})`);
        } catch (error) {
            toastError(error);
        } finally {
            setUploading(false);
        }
    };

    const giveBack = () => (styled
        ? style.mutateAsync({ name: styled.name, value: null })
        : overlay.mutateAsync({ overlay: sprite.overlay, url: null }))
        .then(() => saved(`${sprite.sprite}: Habbo's own again`), toastError);

    return (
        <>
            {current && (
                <span className="inline-flex items-center gap-1 text-xs">
                    <Badge tone="amber">replaced</Badge>
                    <img src={current} alt={`${sprite.sprite} replacement`} className="max-h-8 max-w-24 border border-line bg-subtle object-contain [image-rendering:pixelated]" title={current} />
                    {styled && <span className="text-muted">{`style ${styled.name}`}</span>}
                </span>
            )}
            {replacing.canManage && (
                <label className={`inline-flex items-center gap-1 text-sm text-accent ${busy ? 'opacity-50' : 'cursor-pointer hover:underline'}`}>
                    <Upload className="size-4" />
                    {busy ? 'Uploading...' : 'Upload replacement'}
                    <input
                        type="file"
                        accept={IMAGE_TYPES}
                        aria-label={`Upload a replacement for ${sprite.sprite}`}
                        className="sr-only"
                        disabled={busy}
                        onChange={(event) => {
                            const file = event.target.files?.[0];

                            event.target.value = '';

                            if (file) void upload(file);
                        }}
                    />
                </label>
            )}
            {current && replacing.canManage && <Button variant="ghost" icon={<RotateCcw />} disabled={busy} onClick={() => void giveBack()}>Remove</Button>}
        </>
    );
};

/** One skin: its sprites (size, nine-slice, the overlay key that replaces it, its replacement) and the windows drawing it. */
const SkinCard = ({ id, skin, sheet, replacing }: { id: string; skin: SkinEntry; sheet: ThemeSheet | undefined; replacing: Replacing | undefined }) => {
    const windows = Object.entries(skin.windows);

    return (
        <div className="flex flex-col gap-2 p-4">
            <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono font-medium">{id}</span>
                {skin.tintColor && <Badge><span className="inline-block size-2.5 rounded-sm" style={{ background: skin.tintColor }} />{`tint ${skin.tintColor}`}</Badge>}
                <span className="text-xs text-muted">{`${skin.sprites.length} sprite(s), ${windows.length} window(s)`}</span>
            </div>
            <ul className="flex flex-col gap-2">
                {skin.sprites.map(sprite => (
                    <li key={sprite.part} className="flex flex-wrap items-center gap-3 text-[13px]">
                        <Sprite sheet={sheet} sprite={sprite.sprite} rect={sprite.rect} />
                        <span className="text-muted">{sprite.part}</span>
                        <span className="font-mono text-xs">{sprite.sprite}</span>
                        {sprite.width !== undefined && <span className="text-xs">{`${sprite.width}x${sprite.height}`}</span>}
                        {sprite.slice && <span className="text-xs text-muted">{`nine-slice ${sprite.slice.left} ${sprite.slice.top} ${sprite.slice.right} ${sprite.slice.bottom}`}</span>}
                        <Button
                            variant="ghost"
                            icon={<Copy />}
                            title="Copy the asset.overlays entry: replaces this sprite, at its size, in every window drawing it"
                            onClick={() => void navigator.clipboard.writeText(`"${sprite.overlay}": ""`).then(() => toast(`Copied ${sprite.overlay}: paste it into asset.overlays with the image's address.`))}
                        >
                            overlay key
                        </Button>
                        {replacing && <SpriteReplacement sprite={sprite} replacing={replacing} />}
                    </li>
                ))}
            </ul>
            {windows.length > 0 && (
                <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                    <span className="text-muted">Drawn by:</span>
                    {windows.map(([ win, keys ]) => (
                        <Link key={win} to={`/appearance/advanced/windows/windows?${new URLSearchParams({ id: win })}`} className="font-mono text-accent hover:underline">{`${win} ${keys.map(key => `'${key}'`).join(' ')}`}</Link>
                    ))}
                </p>
            )}
            {skin.sprites.length > 0 && <p className="text-xs text-muted">An overlay of a sprite re-skins every window above, and every other skin drawing the same sprite.</p>}
        </div>
    );
};

/** The skins gallery: every skin of the theme, found by its id, a sprite's name or a window drawing it. */
const SkinsTab = () => {
    const { data: skins, error } = useSkinMap();
    const { data: plugins } = usePlugins();
    const { key: target } = useWorkingOn();
    const { data: hotelStyles } = usePluginStyles(target);
    const { data: overlays, error: overlaysError } = useHotelOverlays();
    const replacing = useMemo<Replacing | undefined>(() => {
        if (!overlays || !plugins) return undefined;

        const styles = new Map((hotelStyles?.styles ?? []).filter(style => style.type === 'image' && style.overlay).map(style => [ style.overlay!, style ]));

        return { target, overlays, styles, canManage: plugins.canManage };
    }, [ target, overlays, plugins, hotelStyles ]);
    const { data: sheet, error: sheetError } = useThemeSheet();
    const assets = useClientAssets();
    const [ params, setParams ] = useSearchParams();
    const [ text, setText ] = useState(() => params.get('skin') ?? '');
    const words = useDebounced(text).trim().toLowerCase();
    const found = Object.entries(skins?.skins ?? {}).filter(([ id, skin ]) => !words || id.toLowerCase() === words || (!params.get('skin') && (id.toLowerCase().includes(words) || skin.sprites.some(sprite => sprite.sprite.includes(words)) || Object.keys(skin.windows).some(win => win.toLowerCase().includes(words)))));

    return (
        <>
            {skins && replacing?.canManage && <SkinSetUpload skins={skins} target={target} canManage={replacing.canManage} />}
            <Panel className="overflow-clip">
                <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
                    <SearchInput
                        value={text}
                        onValueChange={(value) => {
                            setText(value);
                            setParams({}, { replace: true });
                        }}
                        placeholder="Skin (frame:3), sprite or window"
                        className="min-w-48 flex-1 sm:max-w-96"
                        aria-label="Find skins"
                    />
                    {skins && <span className="text-xs text-muted">{`${found.length} of ${Object.keys(skins.skins).length} skins`}</span>}
                    {replacing?.canManage && <span className="ml-auto"><WorkingOnPicker /></span>}
                </div>
                {error && <div className="p-4"><ErrorNotice error={error} /></div>}
                {overlaysError && <div className="p-4"><ErrorNotice error={overlaysError} /></div>}
                {sheetError && <div className="p-4"><ErrorNotice error={sheetError} /></div>}
                {assets && !assets.templates && <p className="border-b border-line p-3 text-xs text-muted">The sprites aren&apos;t drawn: the hotel&apos;s external variables name no asset.bundles.templates, where the client loads its theme sheet.</p>}
                {!skins && !error && <Loading />}
                {skins && found.length === 0 && <EmptyState>No skin has those words.</EmptyState>}
                <ul className="divide-y divide-line">{found.slice(0, LIST_LIMIT).map(([ id, skin ]) => <li key={id}><SkinCard id={id} skin={skin} sheet={sheet} replacing={replacing} /></li>)}</ul>
            </Panel>
        </>
    );
};

/** One plugin's patches on a window, with what players' clients report of them. */
const PluginWindowPatches = ({ plugin, id }: { plugin: Plugin; id: string }) => {
    const { data } = usePluginContributions(plugin.key);
    const patches = data?.items.filter(item => item.kind === 'template-patch' && item.name === id) ?? [];
    const issues = data?.clientIssues.filter(issue => issue.kind.startsWith('patch.') && issue.subject === id) ?? [];

    if (patches.length === 0 && issues.length === 0) return null;

    return (
        <li className="flex flex-col gap-1 py-1.5 text-sm">
            <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{plugin.name ?? plugin.key}</span>
                {patches.map(patch => <span key={patch.name} className="text-xs text-muted">{patch.detail}</span>)}
                {issues.map(issue => <Badge key={issue.kind} tone={TONES[issue.kind] ?? 'neutral'}>{`${issue.kind.slice('patch.'.length)} - ${issue.clients} client(s)`}</Badge>)}
                <Link to={`/appearance/studio?${new URLSearchParams({ tab: 'settings', theme: plugin.key })}`} className="ml-auto text-xs text-accent hover:underline">Theme</Link>
            </div>
            {issues.filter(issue => issue.kind !== 'patch.applied').map(issue => <p key={issue.kind} className="text-xs text-warn">{issue.message}</p>)}
        </li>
    );
};

/** A window: the patches on it with their client status, a new one, and its element tree. */
const WindowDetail = ({ index, skins, id }: { index: TemplateIndex; skins: SkinMap | undefined; id: string }) => {
    const found = windowOf(index, id);
    const { data: hotel } = usePatches(useWorkingOn().key);
    const { data: plugins } = usePlugins();
    const [ draft, setDraft ] = useState<HotelPatch | null>(null);
    const [ editing, setEditing ] = useState<string | null>(null);
    const [ hovered, setHovered ] = useState<string | null>(null);
    const [ picked, setPicked ] = useState<string | null>(null);
    const bySkin = useMemo(() => skinsByKey(skins, id), [ skins, id ]);
    const own = hotel?.patches.filter(patch => patch.template === id) ?? [];
    const others = plugins?.plugins.filter(plugin => plugin.state === 'loaded' && plugin.key !== hotel?.key) ?? [];
    const hotelPlugin = plugins?.plugins.find(plugin => plugin.key === hotel?.key);
    const start = (key: string) => setDraft({ id: '', name: `${id.split('/').pop() ?? id} ${key || 'window'}`, template: id, order: null, ops: [ { element: key, set: {} } ], disabled: false });

    if (!found) return <EmptyState>{`The client has no window ${id}.`}</EmptyState>;

    return (
        <div className="flex flex-col gap-4">
            <Panel
                title={id}
                description={index.templates[id] ? `${found.name}, ${found.width}x${found.height}. Pick an element's key for a new patch on it, a text to edit it, a skin for its sprites.` : 'Drawn by Nitro itself, not a template: a patch reaches its root \'\' (frame colour, style and position).'}
                actions={hotel?.canManage && <Button icon={<Plus />} onClick={() => start('')}>New patch</Button>}
            >
                <div className="flex flex-col gap-3 p-4">
                    {draft && <div className="rounded-lg border border-line p-3"><PatchEditor key={JSON.stringify(draft.ops)} patch={draft} onDone={() => setDraft(null)} /></div>}
                    <div>
                        <h3 className="mb-1 text-xs font-medium text-muted uppercase">Patches on this window</h3>
                        {own.length === 0 && others.length === 0 && <p className="text-xs text-muted">None.</p>}
                        <ul className="divide-y divide-line">
                            {own.map(patch => (
                                <li key={patch.id} className="flex flex-col gap-1 py-1.5 text-sm">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <button type="button" className="font-medium hover:text-accent" onClick={() => setEditing(editing === patch.id ? null : patch.id)}>{patch.name}</button>
                                        <span className="text-xs text-muted">{`this hotel's, ${Array.isArray(patch.ops) ? patch.ops.length : 0} op(s)`}</span>
                                        {patch.disabled ? <Badge>off</Badge> : <Badge tone="green">on</Badge>}
                                    </div>
                                    {editing === patch.id && <PatchEditor patch={patch} onDone={() => setEditing(null)} />}
                                </li>
                            ))}
                            {hotelPlugin && <PluginWindowPatches plugin={hotelPlugin} id={id} />}
                            {others.map(plugin => <PluginWindowPatches key={plugin.key} plugin={plugin} id={id} />)}
                        </ul>
                    </div>
                    {/* One client at a time: an open editor has its own preview, with its draft. */}
                    {!draft && !editing && <DesignPreview template={id} highlight={hovered} onSelect={selection => setPicked(selection.key)} />}
                    <div className="max-h-[60vh] overflow-auto">
                        <WindowTree elements={found.elements} skinsOf={key => bySkin.get(key) ?? []} onPick={hotel?.canManage ? start : undefined} selected={picked} onHover={setHovered} />
                    </div>
                </div>
            </Panel>
        </div>
    );
};

/** The window list: every template window and every window Nitro draws itself, found by name, element, text key or shown text. */
const WindowsTab = () => {
    const { data: index, error } = useTemplateIndex();
    const { data: skins } = useSkinMap();
    const [ params, setParams ] = useSearchParams();
    const id = params.get('id');
    const [ text, setText ] = useState(() => params.get('q') ?? '');
    const words = useDebounced(text).trim().toLowerCase();
    // The keys of the hotel's texts showing the words: a window showing one is found by what it shows.
    const { data: texts } = useTextSearch(words.length >= 3 ? words : '', 0);
    const shown = useMemo(() => new Set(words.length >= 3 ? texts?.items.map(item => item.key) ?? [] : []), [ texts, words ]);
    const ids = useMemo(() => (index ? [ ...Object.keys(index.templates), ...Object.keys(index.frames) ].sort() : []), [ index ]);
    const found = useMemo(() => (index ? ids.filter(each => matches(index, each, words, shown)) : []), [ index, ids, words, shown ]);

    return (
        <div className="grid gap-4 lg:grid-cols-[minmax(16rem,24rem)_1fr]">
            <Panel className="overflow-clip">
                <div className="flex flex-col gap-1 border-b border-line p-3">
                    <SearchInput value={text} onValueChange={setText} placeholder="Window, element, text key or shown text" aria-label="Find windows" />
                    {index && <span className="text-xs text-muted">{`${found.length} of ${ids.length} windows${shown.size ? `, ${shown.size} text(s) show those words` : ''}`}</span>}
                </div>
                {error && <div className="p-4"><ErrorNotice error={error} /></div>}
                {!index && !error && <Loading />}
                <ul className="max-h-[70vh] overflow-y-auto">
                    {found.slice(0, LIST_LIMIT).map(each => (
                        <li key={each}>
                            <button
                                type="button"
                                className={`block w-full truncate px-3 py-1 text-left font-mono text-xs hover:bg-subtle ${each === id ? 'bg-subtle text-accent' : ''}`}
                                onClick={() => setParams(previous => ({ ...Object.fromEntries(previous), id: each }))}
                            >
                                {each}
                                {index?.frames[each] && <span className="ml-2 text-muted">nitro</span>}
                            </button>
                        </li>
                    ))}
                </ul>
                {found.length > LIST_LIMIT && <p className="p-3 text-xs text-muted">{`${found.length - LIST_LIMIT} more: narrow the search.`}</p>}
            </Panel>
            {index && id ? <WindowDetail index={index} skins={skins} id={id} /> : <EmptyState framed>Pick a window.</EmptyState>}
        </div>
    );
};

/**
 * Windows & skins: the game's windows as the client has them - each template window and each window
 * Nitro draws itself, with its element tree, the patches on it and what clients report of them - and
 * the theme's skins with their sprites and the windows drawing them. From the client's own
 * `template-index.json` and `skins.json`, read through the server.
 */
export const WindowsPage = () => {
    const [ tab, toTab ] = usePathTab(TABS.map(x => x.value));
    const queryClient = useQueryClient();

    if (toTab) return toTab;

    const tabs: Record<string, ReactNode> = { windows: <WindowsTab />, skins: <SkinsTab /> };

    return (
        <>
            <PageHeader
                title="Windows & skins"
                description="Every window of the client with the names a patch uses, and every skin with its sprites"
                tabs={{ items: TABS, value: tab }}
            >
                <Button variant="secondary" icon={<RefreshCw />} title="Read the client's files again, after a new client is deployed" onClick={() => void readWindowsAgain(queryClient).catch(toastError)}>Read again</Button>
            </PageHeader>
            <PageBody className="flex flex-col gap-4 lg:gap-5">{tabs[tab]}</PageBody>
        </>
    );
};

import { Eye, Package, Plus, Redo2, Save, Undo2, X } from 'lucide-react';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { useThemeAudiences, useThemes } from '#/api/appearance';
import { useClientAssets } from '#/api/assets';
import { useSaveText } from '#/api/gamedata';
import { type HotelPatch, type PluginStyle, useOverlaysChange, usePatches, usePluginFonts, usePluginStyles, useRemovePatch, useSavePatch, useStyleChange, useThemeTexts, useThemeTextsChange } from '#/api/noCode';
import { useTemplateIndex, windowOf } from '#/api/windows';
import { styleDraft, windowOfStyle } from '#/appearance/styleValues';
import { folderOf, useWorkingOn } from '#/appearance/workingOn';
import { ask } from '#/components/confirm';
import { useSaved } from '#/components/SaveFeedback';
import { Tabs } from '#/components/Tabs';
import { toastError } from '#/components/toast';
import { Badge, Button, ErrorNotice, IconButton, Loading, PageHeader, Segmented, Select } from '#/components/ui';
import { previewLink, STATUS_LABEL } from '#/pages/appearance/ThemeAudience';
import { themeName, themeTree } from '#/pages/appearance/themes';
import { PackageDialog } from '#/pages/plugins/PackageDialog';
import { type DesignDraft, DesignPreview, type DesignPreviewControls, type DesignRects, type DesignState } from '#/preview/DesignPreview';
import { setOf, withSets } from '#/preview/patchOps';
import { dragged, type DragKind, Handles, keyedElements, unionOf } from '#/preview/VisualEditor';

import { ChangesTab } from './ChangesTab';
import { Inspector } from './Inspector';
import { draftCount, type Studio, StudioContext, type StudioDraft, type StudioSelection, useDraftHistory } from './studio';
import { ThemeSettings } from './ThemeSettings';
import { WindowList } from './WindowList';
import { studioWindows } from './windows';

const TABS = [ { value: 'windows', label: 'Windows' }, { value: 'settings', label: 'Theme settings' }, { value: 'changes', label: 'Changes' } ];

/** The game's desktop the preview draws on, which "Fit" scales into the centre. */
const DESKTOP_WIDTH = 1008;

const ZOOMS = [ { value: 'fit', label: 'Fit' }, { value: '1', label: '100%' }, { value: '0.75', label: '75%' }, { value: '0.5', label: '50%' } ];

/** The theme's first patch on a template, the one the studio edits: one that is on before one that is off. */
const patchOn = (patches: readonly HotelPatch[], template: string) => patches.find(patch => patch.template === template && !patch.disabled) ?? patches.find(patch => patch.template === template);

const opsOf = (patch: HotelPatch | undefined): readonly unknown[] => (Array.isArray(patch?.ops) ? patch.ops as unknown[] : []);

/** A record without one key. */
function without<T>(record: Record<string, T>, key: string): Record<string, T> {
    return Object.fromEntries(Object.entries(record).filter(([ name ]) => name !== key));
}

/** The width of an element, as it changes. */
const useWidth = () => {
    const [ width, setWidth ] = useState(0);
    const observer = useRef<ResizeObserver | null>(null);
    const ref = useCallback((element: HTMLDivElement | null) => {
        observer.current?.disconnect();

        if (!element) return;

        observer.current = new ResizeObserver(([ entry ]) => setWidth(entry?.contentRect.width ?? 0));
        observer.current.observe(element);
    }, []);

    return [ width, ref ] as const;
};

/** The theme edited, who gets it, and what it would do to a player who opened the client as it. */
const ThemeBar = ({ unsaved, onPick }: { unsaved: number; onPick: (key: string) => void }) => {
    const working = useWorkingOn();
    const { data } = useThemes();
    const audiences = useThemeAudiences().data;
    const assets = useClientAssets();
    const audience = audiences?.themes.find(theme => theme.key === working.key);
    const tree = data ? themeTree(data.themes, data.base) : [];
    const link = previewLink(assets?.preview, working.key);

    return (
        <div className="flex flex-wrap items-center gap-2" data-working-on={working.key}>
            <label className="inline-flex items-center gap-2 text-sm">
                <span className="text-muted">Theme</span>
                <Select
                    aria-label="Theme"
                    value={working.key}
                    className="w-auto"
                    onChange={(event) => {
                        const next = event.target.value;

                        if (!unsaved) onPick(next);
                        else ask({ title: `Leave ${unsaved} unsaved change(s)?`, body: 'They are dropped: save them first to keep them.', confirm: 'Drop them', danger: true }, () => onPick(next));
                    }}
                >
                    {!tree.some(node => node.theme.key === working.key) && <option value={working.key}>{working.name}</option>}
                    {tree.map(({ theme, depth }) => <option key={theme.key} value={theme.key}>{`${'  '.repeat(Math.max(0, depth - 1))}${themeName(theme)}`}</option>)}
                </Select>
            </label>
            <span className="font-mono text-xs text-muted" title="Save writes here">{folderOf(working.key)}</span>
            {audience && (
                <span className="inline-flex items-center gap-1.5" data-theme-status={audience.status}>
                    <Badge tone={audience.status === 'live' ? 'green' : audience.status === 'development' ? 'amber' : 'neutral'}>{STATUS_LABEL[audience.status]}</Badge>
                    {audience.isDefault && <Badge tone="green">default</Badge>}
                    {audience.status === 'development' && (
                        <span className="text-xs text-muted">{[ ...audience.players.map(player => player.name ?? `#${player.id}`), ...audience.groups.map(group => `group ${group}`) ].join(', ') || 'no one yet'}</span>
                    )}
                    <Link to="/appearance/themes" className="text-xs text-accent hover:underline">Who gets it</Link>
                </span>
            )}
            {data?.canManage && (
                <Link to="/appearance/themes?new=1" className="inline-flex items-center gap-1 text-xs text-accent hover:underline">
                    <Plus className="size-3.5" />
                    New theme
                </Link>
            )}
            {link && audience?.status !== 'off' && (
                <a href={link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-accent hover:underline" title="Opens the client drawing this theme once, its saved changes">
                    <Eye className="size-3.5" />
                    Preview as
                </a>
            )}
        </div>
    );
};

/**
 * Theme studio: one place to restyle the game. Pick the theme, pick a window by the name players
 * know, see it drawn by the game with its content, click anything in it - the parts other templates
 * draw inside it too - and change it in the inspector beside it. Every change is a draft, drawn at
 * once, undone with Undo and written into the theme by Save; Theme settings has the theme's colours,
 * fonts and art, Changes everything it changes by window.
 */
export const ThemeStudioPage = () => {
    const [ params, setParams ] = useSearchParams();
    const working = useWorkingOn();
    const theme = working.key;
    const intoTheme = !working.hotel;
    const tab = TABS.some(each => each.value === params.get('tab')) ? params.get('tab')! : 'windows';
    const asked = params.get('window');
    const state = params.get('state') ?? undefined;
    const { data: index, error } = useTemplateIndex();
    const windows = useMemo(() => (index ? studioWindows(index) : []), [ index ]);
    // A part asked for (an old link to badgeGridItem) is shown in the window it is drawn inside.
    const windowId = asked && index && !windows.some(window => window.id === asked)
        ? (index.parts?.[asked]?.windows[0] ?? windows.find(window => window.parts.includes(asked))?.id ?? asked)
        : asked;
    // The states the client draws windows in (the catalogue's pages), as its preview host says them.
    const [ hostStates, setHostStates ] = useState<Record<string, DesignState[]>>({});
    const listed = windows.find(window => window.id === windowId);
    const shownWindow = listed && !listed.states.length && hostStates[listed.id] ? { ...listed, states: hostStates[listed.id]! } : listed;
    const { data: patchData, error: patchError } = usePatches(theme);
    const { data: read } = usePluginStyles(theme);
    const ownFonts = usePluginFonts(theme).data?.fonts;
    const hotelFonts = usePluginFonts('hotel').data?.fonts;
    const fonts = useMemo(() => [ ...(ownFonts ?? []), ...(theme === 'hotel' ? [] : hotelFonts ?? []) ], [ ownFonts, hotelFonts, theme ]);
    // A theme's own file: each value is its default, its own where it names one (as Style properties had it).
    const styles = useMemo<PluginStyle[]>(() => (read && intoTheme
        ? read.styles.map(style => ({ ...style, value: style.default, changed: style.origin === theme, origin: style.origin === theme ? read.extends : style.origin }))
        : read?.styles ?? []), [ read, intoTheme, theme ]);
    const history = useDraftHistory();
    const draft = history.draft;
    const unsaved = draftCount(draft);
    const [ selection, setSelection ] = useState<StudioSelection | null>(null);
    const [ rects, setRects ] = useState<DesignRects | null>(null);
    const [ zoomChoice, setZoomChoice ] = useState('fit');
    const [ centreWidth, centreRef ] = useWidth();
    const [ packaging, setPackaging ] = useState(false);
    const controls = useRef<DesignPreviewControls | null>(null);
    const dragStart = useRef<{ x: number; y: number; width: number; height: number; group: string } | null>(null);
    const savePatch = useSavePatch(theme);
    const removePatch = useRemovePatch(theme);
    const styleChange = useStyleChange(theme, intoTheme);
    const saveText = useSaveText();
    const overlaysChange = useOverlaysChange(theme);
    // A theme's texts are its own file's (drawn for its players over the hotel's); the hotel's are Gamedata > Texts'.
    const themeTexts = useThemeTexts(theme, intoTheme).data?.texts;
    const themeTextsChange = useThemeTextsChange(theme);
    const saved = useSaved();
    const [ saving, setSaving ] = useState(false);
    const patches = useMemo(() => patchData?.patches ?? [], [ patchData ]);
    const canManage = !!patchData?.canManage;
    const zoom = zoomChoice === 'fit' ? Math.min(1, centreWidth > 0 ? centreWidth / DESKTOP_WIDTH : 1) : Number(zoomChoice);

    const setParam = (changes: Record<string, string | null>) => setParams((previous) => {
        const next = new URLSearchParams(previous);

        for (const [ name, value ] of Object.entries(changes)) {
            if (value === null) next.delete(name);
            else next.set(name, value);
        }

        return next;
    }, { replace: true });

    // An old Style properties link names its theme: work on it.
    const linkedTheme = params.get('theme');

    useEffect(() => {
        if (!linkedTheme) return;

        working.setKey(linkedTheme);
        setParam({ theme: null });
        // eslint-disable-next-line react-hooks/exhaustive-deps -- once per link
    }, [ linkedTheme ]);

    useEffect(() => {
        if (!unsaved) return;

        const onLeave = (event: BeforeUnloadEvent) => event.preventDefault();

        window.addEventListener('beforeunload', onLeave);

        return () => window.removeEventListener('beforeunload', onLeave);
    }, [ unsaved ]);

    const pickWindow = (id: string) => {
        setSelection(null);
        setParam({ window: id, state: null });
    };

    const change = (next: StudioDraft, group?: string) => history.change(next, group);

    const studio: Studio = {
        theme,
        themeName: working.name,
        intoTheme,
        canManage,
        window: windowId,
        selection,
        select: setSelection,
        ops: template => draft.patches[template] ?? opsOf(patchOn(patches, template)),
        changeOps: (template, next, group) => change({ ...draft, patches: next === undefined ? without(draft.patches, template) : { ...draft.patches, [template]: next } }, group),
        styles,
        style: name => (name in draft.styles ? draft.styles[name]! : styles.find(style => style.name === name)?.value ?? null),
        setStyle: (name, value, group) => change({ ...draft, styles: value === undefined ? without(draft.styles, name) : { ...draft.styles, [name]: value } }, group),
        text: key => draft.texts[key],
        setText: (key, value, group) => change({ ...draft, texts: value === undefined ? without(draft.texts, key) : { ...draft.texts, [key]: value } }, group),
        overlay: key => draft.overlays[key],
        setOverlay: (key, url, group) => change({ ...draft, overlays: url === undefined ? without(draft.overlays, key) : { ...draft.overlays, [key]: url } }, group),
        rects,
        pick: (x, y) => controls.current?.pick(x, y),
    };

    // The theme as players would get it with the draft saved: its patches with the draft's in their place, its style values, the texts.
    const previewDraft = useMemo<DesignDraft>(() => {
        const files = patches.filter(patch => !patch.disabled && !(patch.template in draft.patches)).map(patch => ({ template: patch.template, ops: patch.ops, order: patch.order }));

        for (const [ template, ops ] of Object.entries(draft.patches)) {
            if (ops.length) files.push({ template, ops, order: patchOn(patches, template)?.order ?? null });
        }

        // Working on a theme, its saved defaults are drawn too (players get them from its files); the hotel's values are the client's already.
        const values: Record<string, string> = intoTheme ? Object.fromEntries(styles.filter(style => style.changed && style.value !== null).map(style => [ style.name, style.value! ])) : {};

        for (const [ name, value ] of Object.entries(draft.styles)) {
            const reset = styles.find(style => style.name === name)?.default ?? null;

            if (value !== null) values[name] = value;
            else if (reset !== null) values[name] = reset;
            else delete values[name];
        }

        const drawn = styleDraft(theme, styles, values, fonts);

        // New art is drawn at once: each bitmap's uploaded image in the asset manager (the library's own for one given back).
        const art = Object.entries(draft.overlays).filter(([ , url ]) => url !== null).map(([ key, url ]) => ({ path: [ 'asset.overlays', key ], value: url }));

        return { patches: { [theme]: { patches: files } }, styles: drawn.styles, variables: [ ...(drawn.variables ?? []), ...art ], texts: intoTheme ? { ...themeTexts, ...draft.texts } : draft.texts };
    }, [ patches, draft, styles, fonts, theme, intoTheme, themeTexts ]);

    const save = async () => {
        setSaving(true);

        try {
            for (const [ template, ops ] of Object.entries(draft.patches)) {
                const first = patchOn(patches, template);

                if (!ops.length) {
                    for (const patch of patches.filter(each => each.template === template)) await removePatch.mutateAsync(patch.id);
                } else {
                    const name = windows.find(window => window.id === template)?.name ?? template.split('/').pop() ?? template;

                    await savePatch.mutateAsync(first ? { ...first, ops } : { id: '', name, template, order: null, ops, disabled: false });
                }
            }

            for (const [ name, value ] of Object.entries(draft.styles)) await styleChange.mutateAsync({ name, value });

            if (!intoTheme) for (const [ key, value ] of Object.entries(draft.texts)) await saveText.mutateAsync({ key, value });
            else if (Object.keys(draft.texts).length) await themeTextsChange.mutateAsync(draft.texts);

            // Every bitmap in one change: each is checked before any is written.
            if (Object.keys(draft.overlays).length) await overlaysChange.mutateAsync(draft.overlays);

            history.clear();
            saved(`${unsaved} change(s) to ${working.name}`);
        } catch (failure) {
            toastError(failure);
        } finally {
            setSaving(false);
        }
    };

    const { undo, redo } = history;

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if ((event.target as HTMLElement | null)?.closest('input, textarea, select, [contenteditable]')) return;

            if (event.key === 'Escape') {
                setSelection(null);

                return;
            }

            if (!(event.ctrlKey || event.metaKey)) return;

            const key = event.key.toLowerCase();

            if ((key === 'z') && !event.shiftKey) undo();
            else if ((key === 'y') || ((key === 'z') && event.shiftKey)) redo();
            else return;

            event.preventDefault();
        };

        window.addEventListener('keydown', onKey);

        return () => window.removeEventListener('keydown', onKey);
    }, [ undo, redo ]);

    // The picked element's box over the preview: dragged to move it, its handles to resize it.
    const box = (selection?.key && rects && (rects.key === selection.key)) ? unionOf(rects.rects) : undefined;
    const onDrag = (kind: DragKind, dx: number, dy: number, done: boolean) => {
        if (!selection?.key || !index) return;

        const template = selection.template;
        const ops = studio.ops(template);
        const values = setOf(ops, selection.key);
        const indexed = keyedElements(windowOf(index, template)?.elements ?? []).find(entry => entry.element.key === selection.key)?.element;
        const own = indexed ? { x: indexed.rect[0], y: indexed.rect[1], width: indexed.rect[2], height: indexed.rect[3] } : selection.element;

        if (!own) return;

        if (!dragStart.current) {
            const number = (value: unknown, fallback: number) => (typeof value === 'number' ? value : fallback);

            dragStart.current = { x: number(values.x, own.x), y: number(values.y, own.y), width: number(values.width, own.width), height: number(values.height, own.height), group: `${selection.key}:drag:${Date.now()}` };
        }

        const scale = (rects?.scale ?? 1) / zoom;

        studio.changeOps(template, withSets(ops, selection.key, dragged(kind, dragStart.current, Math.round(dx * scale), Math.round(dy * scale))), dragStart.current.group);

        if (done) dragStart.current = null;
    };

    // A style's control used: the window it restyles is shown.
    const showWindowOf = (style: PluginStyle) => {
        const target = windowOfStyle(index, style);

        if (target && target !== windowId) pickWindow(target);
    };

    const pickTheme = (key: string) => {
        history.clear();
        setSelection(null);
        working.setKey(key);
    };

    const left: Record<string, ReactNode> = {
        windows: index && <WindowList index={index} windows={windows} value={windowId} onPick={pickWindow} />,
        settings: <div className="min-h-0 flex-1 overflow-y-auto"><ThemeSettings fonts={fonts} onWindow={showWindowOf} /></div>,
        changes: index && <div className="min-h-0 flex-1 overflow-y-auto"><ChangesTab index={index} windows={windows} patches={patches} draft={draft} onJump={pickWindow} /></div>,
    };

    return (
        <StudioContext value={studio}>
            <PageHeader title="Theme studio" description={`Pick a window, click what to change, Save: it is written into ${folderOf(theme)} and players get it at their next load.`} />
            <div className="flex w-full flex-col gap-3 px-3 py-3 lg:px-4">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-line bg-surface px-3 py-2">
                    <ThemeBar unsaved={unsaved} onPick={pickTheme} />
                    <span className="ml-auto flex flex-wrap items-center gap-2">
                        <IconButton label="Undo (Ctrl+Z)" icon={<Undo2 />} disabled={!history.canUndo} onClick={undo} />
                        <IconButton label="Redo (Ctrl+Y)" icon={<Redo2 />} disabled={!history.canRedo} onClick={redo} />
                        <span className="text-sm tabular-nums" aria-live="polite" data-unsaved={unsaved}>{unsaved ? `${unsaved} unsaved change(s)` : 'All saved'}</span>
                        <Button icon={<Save />} disabled={!unsaved || saving || !canManage} onClick={() => void save()}>{saving ? 'Saving...' : 'Save'}</Button>
                        <Button variant="ghost" icon={<X />} disabled={!unsaved || saving} onClick={() => ask({ title: `Drop ${unsaved} unsaved change(s)?`, confirm: 'Discard', danger: true }, history.clear)}>Discard</Button>
                        {canManage && <IconButton label="Make a plugin of this theme" icon={<Package />} onClick={() => setPackaging(true)} />}
                    </span>
                </div>
                {error && <ErrorNotice error={error} />}
                {patchError && <ErrorNotice error={patchError} />}
                {!index && !error && <Loading />}
                {index && (
                    <div className="grid gap-3 xl:h-[calc(100vh-11rem)] xl:grid-cols-[19rem_minmax(0,1fr)_20rem]">
                        <section aria-label="Windows and settings" className="flex min-h-[24rem] flex-col overflow-clip rounded-xl border border-line bg-surface">
                            <Tabs value={tab} tabs={TABS} onChange={value => setParam({ tab: value === 'windows' ? null : value })} label="Studio" className="shrink-0 px-2" />
                            {left[tab]}
                        </section>
                        <section aria-label="The window" className="flex min-w-0 flex-col gap-2 overflow-y-auto rounded-xl border border-line bg-surface p-3">
                            <div className="flex flex-wrap items-center gap-2">
                                <h2 className="text-base font-semibold">{shownWindow?.name ?? windowId ?? 'Pick a window'}</h2>
                                {shownWindow && <Badge>{shownWindow.area}</Badge>}
                                {shownWindow && shownWindow.parts.length > 0 && <span className="text-xs text-muted">{`${shownWindow.parts.length} part(s) drawn inside: click them in the window`}</span>}
                                <span className="ml-auto flex items-center gap-2">
                                    {shownWindow && shownWindow.states.length > 0 && (
                                        <Select aria-label="State" value={state ?? shownWindow.states[0]!.id} className="w-auto" onChange={event => setParam({ state: event.target.value })}>
                                            {shownWindow.states.map(each => <option key={each.id} value={each.id}>{each.name}</option>)}
                                        </Select>
                                    )}
                                    <Segmented label="Zoom" value={zoomChoice} onChange={setZoomChoice} options={ZOOMS} />
                                </span>
                            </div>
                            <div ref={centreRef} className="min-w-0">
                                {windowId
                                    ? (
                                            <DesignPreview
                                                template={windowId}
                                                state={state ?? shownWindow?.states[0]?.id}
                                                zoom={zoom}
                                                draft={previewDraft}
                                                owner={theme}
                                                selected={selection?.key ?? null}
                                                controls={controls}
                                                onRects={setRects}
                                                onStates={setHostStates}
                                                onSelect={picked => setSelection({ window: windowId, template: picked.part ?? windowId, key: picked.key, tag: picked.tag, name: picked.name, ...(picked.element ? { element: picked.element } : {}), ...(picked.path ? { path: picked.path } : {}), style: picked.style ?? null, caption: picked.caption ?? null, ...(picked.texts ? { texts: picked.texts } : {}) })}
                                                overlay={box && canManage && <Handles box={box} onDrag={(kind, dx, dy, done) => onDrag(kind, dx, dy, done)} onClick={(x, y) => controls.current?.pick(x, y)} />}
                                            />
                                        )
                                    : <p className="p-6 text-center text-sm text-muted">Pick a window on the left: the catalogue, the purse, the navigator...</p>}
                            </div>
                        </section>
                        <section aria-label="Inspector" className="min-h-[16rem] overflow-y-auto rounded-xl border border-line bg-surface">
                            <Inspector />
                        </section>
                    </div>
                )}
            </div>
            <PackageDialog pluginKey={theme} open={packaging} onClose={() => setPackaging(false)} />
        </StudioContext>
    );
};

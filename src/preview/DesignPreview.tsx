import { Crosshair } from 'lucide-react';
import { type ReactNode, type Ref, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';

import { useClientAssets } from '#/api/assets';
import { useCatalogTree } from '#/api/catalog';
import { Segmented } from '#/components/ui';

import { designFrameId, designSamples } from './designSamples';

/** The `type` every message to and from the client's preview host carries. */
const MESSAGE_TYPE = 'nitro-preview';

/** A draft is sent once typing pauses: the client patches the window again for each. */
const SEND_DELAY_MS = 150;

/** The game's desktop the window is drawn on: the size the client is played at, the window centred in it. */
const FRAME_WIDTH = 1008;
const FRAME_HEIGHT = 640;

/** A patch file as the client reads it: what an editor's draft stands in for, per owner. */
export interface DesignPatchFile {
    patches: { template: string; ops: unknown; order?: number | null }[];
    /** Where the owner's files are, for a relative picture its ops bind (a theme no player is given yet has no entry in the hotel's list). */
    base?: string;
}

/** An appearance editor's unsaved changes, as the client draws them. */
export interface DesignDraft {
    /** Per owner (a plugin's key, the hotel's own `hotel`), the patch file in place of its saved one. */
    patches?: Record<string, DesignPatchFile>;
    /** Theme style values over the hotel's, by `<plugin key>:<name>`, as the client reads them (a colour a number). */
    styles?: Record<string, unknown>;
    /** Variables' entries over the hotel's: each a path into one (`[ 'frame.overrides', 'catalog', 'color' ]`) and its value. */
    variables?: { path: string[]; value: unknown }[];
    /** Texts over the hotel's, by key. */
    texts?: Record<string, string>;
    /** Windows defined as data over the saved ones, by `<plugin key>/<name>`: a window drawn as `<plugin key>/windows/<name>`. */
    windows?: Record<string, unknown>;
}

/** The element a press in the preview picked: its key, as a patch's `element` names it. */
export interface DesignSelection {
    template: string;
    /** The part template the element belongs to (a grid item, a page layout drawn inside the window); none for the window's own. */
    part?: string;
    /** Null for an element no key reaches (one the window's code made). */
    key: string | null;
    tag: string;
    name: string | null;
    /** What it is drawn with, its patches applied (the client's own element). */
    element?: DesignElementValues;
    /** From the window's root down to it, each step's template and key. */
    path?: DesignPathStep[];
    /** Its style and caption as the client draws it. */
    style?: string | null;
    caption?: string | null;
    /** The text the client shows for each `${key}` of its caption. */
    texts?: Record<string, string>;
}

/** One step of the way from the window down to a picked element. */
export interface DesignPathStep {
    template: string;
    key: string | null;
    tag: string;
    name: string | null;
}

/** A picked element's own values as the client draws it, as a patch's `set` names them. */
export interface DesignElementValues {
    x: number;
    y: number;
    width: number;
    height: number;
    color: number | string | null;
    hidden: boolean;
    vars: Record<string, unknown>;
    params: Record<string, unknown>;
}

/** A named state a window is drawn in (a catalogue page per layout), as the preview host says them. */
export interface DesignState {
    id: string;
    name: string;
}

/** A box in the preview's own pixels (the frame's CSS pixels, from its top left). */
export interface DesignBox {
    x: number;
    y: number;
    width: number;
    height: number;
}

/** Where the outlined element is drawn: `scale` is a patch's pixels per preview pixel. */
export interface DesignRects {
    key: string;
    rects: DesignBox[];
    scale: number;
}

/** Every element a key reaches drawn in the window, as the client says them while an editor asks (`boxes`). */
export interface DesignBoxes {
    template: string;
    elements: { template: string; key: string; tag: string; name: string | null; tags: string[]; rects: DesignBox[] }[];
    scale: number;
}

/** What an editor drawing over the preview can ask of it. */
export interface DesignPreviewControls {
    /** Picks the element at a point of the preview (its own pixels), as a press there would. */
    pick: (x: number, y: number) => void;
    /** A window's template as the client draws it with the draft's patches (null: none, or no client): what a copy of it starts as. */
    source: (template: string) => Promise<unknown>;
}

interface DesignReport {
    owners: { owner: string; count: number; applied: number }[];
    unmatched: { owner: string; element: string }[];
    ineffective: { owner: string; element: string; property: string }[];
    conflicts: { element: string; property: string; owners: string[] }[];
    errors: { owner: string; message: string }[];
    missingStyles: string[];
}

type HostMessage = {
    type: typeof MESSAGE_TYPE;
    event: 'ready' | 'shown' | 'error' | 'report' | 'select' | 'rect' | 'boxes' | 'source';
    /** On `source`: the template asked for. */
    source?: unknown;
    message?: string;
    template?: string;
    part?: string;
    base?: boolean;
    key?: string | null;
    tag?: string;
    name?: string | null;
    element?: DesignElementValues;
    path?: DesignPathStep[];
    style?: string | null;
    caption?: string | null;
    texts?: Record<string, string>;
    rects?: DesignBox[];
    scale?: number;
    /** On `boxes`: every element drawn. */
    elements?: DesignBoxes['elements'];
    /** On `ready`: the named states of the windows the host draws with sample content, by window. */
    states?: Record<string, DesignState[]>;
} & Partial<DesignReport>;

const isHostMessage = (data: unknown): data is HostMessage => (typeof data === 'object') && (data !== null) && ((data as HostMessage).type === MESSAGE_TYPE);

/** What the client said of the draft's patches, in words, for the editor's owner (every owner without one). */
const feedbackLines = (report: DesignReport, owner: string | undefined) => {
    const mine = <T extends { owner: string }>(list: T[]) => (owner ? list.filter(entry => entry.owner === owner) : list);
    const counts = mine(report.owners);
    const ops = counts.reduce((sum, entry) => sum + entry.count, 0);
    const applied = counts.reduce((sum, entry) => sum + entry.applied, 0);
    const lines: { tone: 'good' | 'warn' | 'bad'; text: string }[] = [];

    if (ops > 0) lines.push({ tone: applied === ops ? 'good' : 'warn', text: `${applied} of ${ops} op(s) change the window.` });

    for (const miss of mine(report.unmatched)) lines.push({ tone: 'bad', text: `Matches nothing: '${miss.element}' is no element of this window.` });
    for (const dead of mine(report.ineffective)) lines.push({ tone: 'warn', text: `Changes nothing: the window's own code sets ${dead.property} of '${dead.element}', and what it sets is drawn.` });
    for (const clash of report.conflicts.filter(entry => !owner || entry.owners.includes(owner))) lines.push({ tone: 'warn', text: `${clash.owners.join(' and ')} both set ${clash.property} of '${clash.element}': the last one wins.` });
    for (const error of mine(report.errors)) lines.push({ tone: 'bad', text: `${error.owner}: ${error.message}` });
    for (const style of report.missingStyles) lines.push({ tone: 'warn', text: `\${style:${style}} has no value: the op keeps the placeholder.` });

    return lines;
};

const TONE_CLASS = { good: 'text-good', warn: 'text-warn', bad: 'text-bad' } as const;

interface DesignPreviewProps {
    /** The window: a template's id (`<library>/<asset>`), or a frame Nitro draws itself by its frame id. */
    template: string;
    part?: string;
    /** The window's state to draw (a tab, a page, empty or loading), as the client's window map names it. */
    state?: string;
    /** The preview's size against the game's desktop (1 = the size the game is played at). */
    zoom?: number;
    draft?: DesignDraft;
    /** Whose ops the lines under the preview are about: the editor's owner. */
    owner?: string;
    /** The element outlined in the preview (a row hovered in a tree). */
    highlight?: string | null;
    /** An editor's own pick, outlined in place of the last press's (null: none). */
    selected?: string | null;
    /** A press in the preview: the element it picked. */
    onSelect?: (selection: DesignSelection) => void;
    /** Where the outlined element is drawn, each time it moves. */
    onRects?: (rects: DesignRects) => void;
    /** The states the client draws windows in, by window, once it is ready. */
    onStates?: (states: Record<string, DesignState[]>) => void;
    /** Every element's boxes, said each time one moves (a window editor's outlines, marquee and guides). */
    onBoxes?: (boxes: DesignBoxes) => void;
    /** Drawn over the window, in its pixels: a visual editor's handles. */
    overlay?: ReactNode;
    controls?: Ref<DesignPreviewControls | null>;
}

/**
 * The window as the game draws it, with the draft applied before it is saved: the client's own
 * preview host in a frame, sent the draft on every change. "Habbo's own" shows it with no patch and
 * no frame override. A press on the window picks the element under it (its key, for the editor); the
 * lines under it say what the draft's ops did there - those that match nothing or change nothing -
 * as the client itself worked it out. The client listens only to the origins its
 * `preview.allowed_origins` names: until the hotel names the panel's there, it stays on its loading screen.
 */
export const DesignPreview = ({ template, part, state, zoom = 1, draft, owner, highlight, selected, onSelect, onRects, onStates, onBoxes, overlay, controls }: DesignPreviewProps) => {
    const assets = useClientAssets();
    const url = assets?.preview || null;
    const frame = useRef<HTMLIFrameElement>(null);
    const [ ready, setReady ] = useState(false);
    const [ error, setError ] = useState<string | null>(null);
    const [ base, setBase ] = useState(false);
    const [ report, setReport ] = useState<DesignReport | null>(null);
    const [ picked, setPicked ] = useState<DesignSelection | null>(null);
    const select = useRef(onSelect);
    const rects = useRef(onRects);
    const states = useRef(onStates);
    const boxes = useRef(onBoxes);
    const wantsBoxes = !!onBoxes;
    // The `source` asks waiting for the host's answer, by template.
    const sources = useRef(new Map<string, ((source: unknown) => void)[]>());
    const origin = url ? new URL(url).origin : null;
    const catalog = useCatalogTree().data;
    const items = useMemo(() => designSamples(template, { catalog, catalogIcon: assets?.catalogIcon ?? '' }), [ template, catalog, assets?.catalogIcon ]);
    // The draft by value: an editor builds a new object each render, which is not a new draft.
    const draftKey = JSON.stringify(draft ?? {});

    useEffect(() => {
        select.current = onSelect;
        rects.current = onRects;
        states.current = onStates;
        boxes.current = onBoxes;
    }, [ onSelect, onRects, onStates, onBoxes ]);

    useImperativeHandle(controls, () => ({
        pick: (x: number, y: number) => {
            if (origin) frame.current?.contentWindow?.postMessage({ type: MESSAGE_TYPE, window: 'design', pick: { x, y } }, origin);
        },
        source: (template: string) => new Promise<unknown>((resolve) => {
            const target = frame.current?.contentWindow;

            if (!origin || !target) return resolve(null);

            sources.current.set(template, [ ...(sources.current.get(template) ?? []), resolve ]);
            target.postMessage({ type: MESSAGE_TYPE, window: 'design', source: template }, origin);
        }),
    }), [ origin ]);

    useEffect(() => {
        if (!origin) return;

        const onMessage = (event: MessageEvent<unknown>) => {
            if ((event.origin !== origin) || (event.source !== frame.current?.contentWindow) || !isHostMessage(event.data)) return;

            const data = event.data;

            if (data.event === 'ready') {
                setReady(true);
                states.current?.(data.states ?? {});
            } else if (data.event === 'error') setError(data.message ?? 'error');
            else if (data.event === 'shown') setError(null);
            else if (data.event === 'source') {
                const waiting = sources.current.get(data.template ?? '') ?? [];

                sources.current.delete(data.template ?? '');
                waiting.forEach(resolve => resolve(data.source ?? null));
            } else if (data.event === 'report') setReport({ owners: data.owners ?? [], unmatched: data.unmatched ?? [], ineffective: data.ineffective ?? [], conflicts: data.conflicts ?? [], errors: data.errors ?? [], missingStyles: data.missingStyles ?? [] });
            else if (data.event === 'boxes') boxes.current?.({ template: data.template ?? '', elements: data.elements ?? [], scale: data.scale ?? 1 });
            else if (data.event === 'rect') {
                if (typeof data.key === 'string') rects.current?.({ key: data.key, rects: data.rects ?? [], scale: data.scale ?? 1 });
            } else if (data.event === 'select') {
                const selection = { template: data.template ?? '', ...(data.part ? { part: data.part } : {}), key: data.key ?? null, tag: data.tag ?? '', name: data.name ?? null, ...(data.element ? { element: data.element } : {}), ...(data.path ? { path: data.path } : {}), style: data.style ?? null, caption: data.caption ?? null, ...(data.texts ? { texts: data.texts } : {}) };

                setPicked(selection);
                select.current?.(selection);
            }
        };

        window.addEventListener('message', onMessage);

        return () => window.removeEventListener('message', onMessage);
    }, [ origin ]);

    useEffect(() => {
        if (!ready || !origin || !template) return;

        const timer = window.setTimeout(() => frame.current?.contentWindow?.postMessage({
            type: MESSAGE_TYPE,
            window: 'design',
            template,
            part,
            state,
            frame: designFrameId(template),
            base,
            draft: JSON.parse(draftKey) as DesignDraft,
            items,
        }, origin), SEND_DELAY_MS);

        return () => window.clearTimeout(timer);
    }, [ ready, origin, template, part, state, base, draftKey, items ]);

    // An outline changes nothing else: sent at once, without the draft.
    useEffect(() => {
        if (!ready || !origin) return;

        frame.current?.contentWindow?.postMessage({ type: MESSAGE_TYPE, window: 'design', highlight: highlight ?? ((selected !== undefined) ? selected : picked?.key) ?? null }, origin);
    }, [ ready, origin, highlight, selected, picked ]);

    // Every element's boxes, only while an editor asks: measuring them costs the client a walk of the window.
    useEffect(() => {
        if (!ready || !origin) return;

        frame.current?.contentWindow?.postMessage({ type: MESSAGE_TYPE, window: 'design', boxes: wantsBoxes }, origin);
    }, [ ready, origin, wantsBoxes ]);

    if (!url) return <p className="text-xs text-muted">No preview: the server knows no client to draw it with (Turbo:Admin:ClientPreviewUrl, else Turbo:Admin:ClientConfigUrl).</p>;

    const lines = (report && !base) ? feedbackLines(report, owner) : [];

    return (
        <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-3">
                <Segmented label="Show" value={base ? 'base' : 'draft'} onChange={value => setBase(value === 'base')} options={[ { value: 'draft', label: 'With the changes' }, { value: 'base', label: 'Habbo\'s own' } ]} />
                <span className="text-xs text-muted">
                    {!ready ? 'Waiting for the client' : error ? `The client could not draw it: ${error}` : base ? 'As Habbo draws it: no patch, no frame override.' : 'The game\'s own window, unsaved changes included. Click an element to pick it.'}
                </span>
            </div>
            <div className="overflow-auto rounded-xl border border-line bg-black">
                <div style={{ width: FRAME_WIDTH * zoom, height: FRAME_HEIGHT * zoom }}>
                    <div className="relative origin-top-left" style={{ width: FRAME_WIDTH, height: FRAME_HEIGHT, transform: zoom === 1 ? undefined : `scale(${zoom})` }}>
                        <iframe ref={frame} src={url} title="The window in the game" style={{ width: FRAME_WIDTH, height: FRAME_HEIGHT }} className="block border-0" />
                        {overlay && !base && <div className="pointer-events-none absolute inset-0">{overlay}</div>}
                    </div>
                </div>
            </div>
            {picked && (selected === undefined) && (
                <p className="flex items-center gap-1.5 text-xs">
                    <Crosshair className="size-3.5 text-accent" />
                    {picked.key === null
                        ? <span className="text-muted">{`A ${picked.tag} the window's code made: no key reaches it.`}</span>
                        : <span>{'Picked '}<code className="font-mono">{picked.key === '' ? '\'\' (the window)' : picked.key}</code>{` - ${picked.tag}${picked.name && picked.name !== picked.key ? ` ${picked.name}` : ''}`}</span>}
                </p>
            )}
            {lines.length > 0 && (
                <ul className="flex flex-col gap-0.5">
                    {lines.map(line => <li key={line.text} className={`text-xs ${TONE_CLASS[line.tone]}`}>{line.text}</li>)}
                </ul>
            )}
        </div>
    );
};

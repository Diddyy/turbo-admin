import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from 'react';

import { useClientAssets } from '#/api/assets';
import { cx } from '#/lib/cx';

import type { HotelViewDraft } from './draft';
import { slotShows, usePaneWidths, useResolveImage, useWidgetText } from './hooks';
import {
    BACKGROUND_LAYERS, BG_TIMING, BOTTOM_SLOT, COMMON, currentCode, type GenericElement, isDrawn, isWideSlot, layerKey, parseConf, parseLayout, parseSchedule, readValue, resolveLayout, slotKey, widgetLabel,
} from './model';

/** The window the preview draws the reception in: a laptop's, as the client lays it out. */
const VIEW_WIDTH = 1600;
const VIEW_HEIGHT = 900;
/** `widgetlist_fromtop`'s place, and the gaps between its slots at a laptop's size. */
const GRID_X = 256;
const GRID_Y = 4;
const TOP_GAP = 10;
const COLUMN_GAP = 60;
const ROW_GAP = 50;
/** `widget_placeholder_bottom_slot`'s place in the 1172x822 layout: 120 in, 252 up from the bottom. */
const BOTTOM_SLOT_X = 120;
const BOTTOM_SLOT_FROM_BOTTOM = 252;

/** One element of a promo's column, as the client draws it, near enough to judge by. */
const Element = ({ element, draft, text }: { element: GenericElement; draft: HotelViewDraft; text: CSSProperties }) => {
    const words = (key: string | undefined) => (key ? (draft.phrase(key) ?? key) : '').replaceAll('\\n', '\n');
    const width = parseInt(element.args[1] ?? '', 10) || 250;

    switch (element.type) {
        case 'caption':
            return <p className="text-[18px] leading-tight font-bold tracking-tight whitespace-pre-line" style={{ ...text, width }}>{words(element.args[0])}</p>;
        case 'subcaption':
            return <p className="text-[13px] font-bold whitespace-pre-line" style={{ ...text, width }}>{words(element.args[0])}</p>;
        case 'bodytext':
            return <p className="text-[12px] leading-snug whitespace-pre-line" style={{ ...text, width }}>{words(element.args[0])}</p>;
        case 'spacing':
            return <div style={{ height: parseInt(element.args[0] ?? '', 10) || 0 }} />;
        case 'catalogbutton':
        case 'internallinkbutton':
            return (
                <span className="my-1 -ml-[11px] flex h-[38px] w-[200px] shrink-0 items-center justify-center rounded-md border-2 border-[#2d6e15] bg-gradient-to-b from-[#8cd04e] to-[#4c9a1f] px-2 text-[13px] font-bold text-white shadow-[inset_0_1px_0_#c1f08f]">
                    <span className="truncate">{words(element.args[0])}</span>
                </span>
            );
        case 'link':
            return <p className="text-[12px] underline" style={text}>{words(element.args[0])}</p>;
        case 'customtimer':
            return <p className="rounded bg-black/40 px-2 py-1 text-center font-mono text-[12px] text-white">{words(element.args[3])} · {element.args[5] || '-'}</p>;
        default:
            return null;
    }
};

/** A generic promo (`GenericWidget`) as the client lays it out, from its `conf` and `layout`. */
export const GenericPreview = ({ conf, layout, wide, draft }: { conf: string; layout: string; wide: boolean; draft: HotelViewDraft }) => {
    const resolve = useResolveImage(draft);
    const panes = usePaneWidths(draft);
    const text = useWidgetText(draft);
    const place = resolveLayout(parseLayout(layout), wide);
    const elements = parseConf(conf);
    const bitmap = resolve(place.bitmapUri);
    const inColumn = elements.filter(x => !(x.type === 'customtimer' && x.args[0] === 'true'));
    const floating = elements.filter(x => x.type === 'customtimer' && x.args[0] === 'true');

    return (
        <div className="relative shrink-0" style={{ width: wide ? panes.left : panes.right, minHeight: place.containerHeight }}>
            {bitmap && (
                <img
                    src={bitmap}
                    alt=""
                    className="absolute max-w-none [image-rendering:pixelated]"
                    style={{ left: place.bitmapX, top: place.bitmapY, width: place.bitmapWidth ?? undefined, height: place.bitmapHeight ?? undefined }}
                />
            )}
            <div className="relative flex flex-col" style={{ marginLeft: place.contentX, paddingTop: place.contentY, width: place.contentWidth }}>
                {inColumn.map((element, index) => <Element key={index} element={element} draft={draft} text={text} />)}
            </div>
            {floating.map((element, index) => (
                <div key={index} className="absolute w-[149px]" style={{ left: parseInt(element.args[1] ?? '', 10) || 0, top: parseInt(element.args[2] ?? '', 10) || 0 }}>
                    <Element element={element} draft={draft} text={text} />
                </div>
            ))}
        </div>
    );
};

/** A widget the preview doesn't draw: what it is, in its place. */
const Placeholder = ({ width, children, faint }: { width: number; children: ReactNode; faint?: boolean }) => (
    <div className={cx('grid h-[120px] shrink-0 place-items-center rounded-lg border-2 border-dashed px-4 text-center text-[15px] font-medium', faint ? 'border-black/15 text-black/40' : 'border-black/30 bg-white/40 text-black/70')} style={{ width }}>
        {children}
    </div>
);

/** A slot's widget, as the preview draws it at the time given. */
const SlotPreview = ({ draft, slot, now }: { draft: HotelViewDraft; slot: number; now: number }) => {
    const resolve = useResolveImage(draft);
    const panes = usePaneWidths(draft);
    const wide = isWideSlot(slot);
    const width = slot === 1 ? 800 : wide ? panes.left : panes.right;
    const shows = slotShows(draft, slot, now);
    const container = draft.text(slotKey(slot, 'widget')) === 'widgetcontainer';

    if (!shows.type)
        return container
            ? <Placeholder width={width} faint>Slot {slot}: nothing scheduled yet</Placeholder>
            : <Placeholder width={width} faint>Slot {slot} is empty</Placeholder>;

    if (shows.type === 'generic') return <GenericPreview conf={shows.conf} layout={shows.layout} wide={wide} draft={draft} />;

    if (shows.type === 'bonusrare') {
        const image = resolve(draft.text(COMMON.bonusRareImage));

        return (
            <Placeholder width={width}>
                <span className="flex items-center gap-3">
                    {image && <img src={image} alt="" className="max-h-24" />}
                    Bonus rare
                </span>
            </Placeholder>
        );
    }

    return <Placeholder width={width}>{widgetLabel(shows.type)}{!isDrawn(shows.type) && <span className="block text-xs font-normal">Nitro doesn't draw this one yet: the slot is empty.</span>}</Placeholder>;
};

/** The background layers at the time given (`WidgetContainerLayout.setBackgroundGraphics`), or with a set of the panel's choosing. */
const useBackgrounds = (draft: HotelViewDraft, now: number, code?: string) => {
    const assets = useClientAssets();
    const resolve = useResolveImage(draft);
    const chosen = code ?? currentCode(parseSchedule(draft.text(BG_TIMING)), now).code;
    const library = assets?.imageLibrary ?? '';

    return Object.fromEntries(BACKGROUND_LAYERS.map(({ name }) => {
        // The layout's own picture, before any variable: only the hotel top has one.
        const initial = name === 'background_hotel_top' && library ? `${library}reception/reception_backdrop_hotel_top_stretch.png` : '';
        // A set's layer falls back to the default's, as the client keeps the last picture it had.
        const visible = readValue(draft.json(layerKey(chosen, name, 'visible'))) !== 'false';
        const own = visible ? draft.text(layerKey(chosen, name, 'uri')) : '';
        const base = chosen ? draft.text(layerKey('', name, 'uri')) : '';

        return [ name, { visible, url: resolve(own) || resolve(base) || initial } ];
    })) as Record<string, { visible: boolean; url: string }>;
};

/** The width of an element, followed as it changes. */
const useWidth = () => {
    const ref = useRef<HTMLDivElement>(null);
    const [ width, setWidth ] = useState(0);

    useEffect(() => {
        if (!ref.current) return;

        const observer = new ResizeObserver(entries => setWidth(entries[0]?.contentRect.width ?? 0));

        observer.observe(ref.current);

        return () => observer.disconnect();
    }, []);

    return { ref, width };
};

/**
 * The reception as a player sees it on a laptop at the time given: its backgrounds, the widget
 * slots and what each shows, drawn with the client's layout. A slot can be clicked to edit it, and
 * so can the backgrounds around them; the slot being edited is outlined.
 */
export const ReceptionPreview = ({ draft, now, backgroundCode, selected, onSlot, onBackground }: {
    draft: HotelViewDraft;
    now: number;
    backgroundCode?: string;
    selected?: number | null;
    onSlot?: (slot: number) => void;
    onBackground?: () => void;
}) => {
    const { ref, width } = useWidth();
    const assets = useClientAssets();
    const layers = useBackgrounds(draft, now, backgroundCode);
    const panes = usePaneWidths(draft);
    const scale = width / VIEW_WIDTH;
    const layer = (name: string) => (layers[name]?.visible && layers[name].url ? layers[name].url : '');
    const slot = (n: number) => (
        <button
            type="button"
            onClick={() => onSlot?.(n)}
            disabled={!onSlot}
            className={cx(
                'pointer-events-auto relative block rounded text-left outline-offset-4 hover:outline-4 hover:outline-[#1e7cf2]/70 focus-visible:outline-4 focus-visible:outline-[#1e7cf2]',
                selected === n && 'outline-4 outline-[#1e7cf2]',
            )}
            title={onSlot ? `Edit slot ${n}` : undefined}
            aria-current={selected === n || undefined}
        >
            <SlotPreview draft={draft} slot={n} now={now} />
        </button>
    );

    return (
        <div ref={ref} className="relative w-full overflow-hidden rounded-lg border border-line" style={{ height: VIEW_HEIGHT * scale }}>
            <div className="absolute top-0 left-0 origin-top-left overflow-hidden bg-[#aae0f0]" style={{ width: VIEW_WIDTH, height: VIEW_HEIGHT, transform: `scale(${scale})` }}>
                {layer('background_gradient') && <div className="absolute left-0 bg-repeat-x" style={{ bottom: 38, width: VIEW_WIDTH, height: 1150, backgroundImage: `url("${layer('background_gradient')}")`, backgroundPosition: 'left bottom' }} />}
                {layer('background_right') && <img src={layer('background_right')} alt="" className="absolute max-w-none" style={{ right: 1, bottom: 38 }} />}
                {layer('background_horizon') && <img src={layer('background_horizon')} alt="" className="absolute max-w-none" style={{ left: 0, bottom: 38 }} />}
                {/* Under the slots, and under the layers in front of them, which let clicks through. */}
                {onBackground && <button type="button" onClick={onBackground} title="Edit the backgrounds" aria-label="Edit the backgrounds" className="absolute inset-0 focus-visible:outline-8 focus-visible:-outline-offset-8 focus-visible:outline-[#1e7cf2]" />}
                <div className="pointer-events-none absolute flex flex-col" style={{ left: GRID_X, top: GRID_Y, gap: TOP_GAP }}>
                    {draft.text(slotKey(1, 'widget')) ? slot(1) : null}
                    <div className="flex items-start" style={{ gap: COLUMN_GAP }}>
                        <div className="flex flex-col" style={{ width: panes.left, gap: ROW_GAP }}>
                            {slot(2)}
                            {slot(4)}
                        </div>
                        <div className="flex flex-col" style={{ width: panes.right, gap: ROW_GAP }}>
                            {slot(3)}
                            {slot(5)}
                        </div>
                    </div>
                </div>
                {layer('background_hotel_top') && <div className="pointer-events-none absolute top-0 left-0 bg-repeat-y" style={{ width: 123, height: Math.max(0, VIEW_HEIGHT - 821), backgroundImage: `url("${layer('background_hotel_top')}")`, backgroundPosition: 'left bottom' }} />}
                {layer('background_left') && <img src={layer('background_left')} alt="" className="pointer-events-none absolute max-w-none" style={{ left: 0, bottom: 38 }} />}
                {draft.text(slotKey(BOTTOM_SLOT, 'widget')) && (
                    <div className="pointer-events-none absolute" style={{ left: BOTTOM_SLOT_X, top: Math.max(0, VIEW_HEIGHT - BOTTOM_SLOT_FROM_BOTTOM) }}>
                        {slot(BOTTOM_SLOT)}
                    </div>
                )}
                {assets?.imageLibrary && <img src={`${assets.imageLibrary}reception/reception_logo_drape.png`} alt="" className="pointer-events-none absolute max-w-none" style={{ left: 100, top: 0 }} />}
                <div className="pointer-events-none absolute bottom-0 left-0 bg-[#333333]" style={{ width: VIEW_WIDTH, height: 50 }} />
            </div>
        </div>
    );
};

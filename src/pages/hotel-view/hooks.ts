import { type CSSProperties, useCallback } from 'react';

import { useClientAssets } from '#/api/assets';

import type { HotelViewDraft } from './draft';
import { ALL_SLOTS, codeKey, COMMON, currentCode, interpolate, parseSchedule, SLOT_PLACES, slotKey, widgetLabel } from './model';

/**
 * An address as the client loads it: `${key}` filled in (`image.library.url` is the client's own),
 * and one starting `//` under https. Empty when there is nothing to load.
 */
export const useResolveImage = (draft: HotelViewDraft) => {
    const assets = useClientAssets();

    return useCallback((uri: string) => {
        if (!uri.trim()) return '';

        const resolved = interpolate(uri.trim(), key => (key === 'image.library.url' ? assets?.imageLibrary || undefined : draft.json(key) !== undefined ? draft.text(key) : undefined));

        if (resolved.includes('${')) return '';

        return resolved.startsWith('//') ? `https:${resolved}` : resolved;
    }, [ assets, draft ]);
};

const ETCHING: Record<string, [number, number]> = {
    top: [ 0, -1 ], bottom: [ 0, 1 ], left: [ -1, 0 ], right: [ 1, 0 ],
    'top-left': [ -1, -1 ], 'top-right': [ 1, -1 ], 'bottom-left': [ -1, 1 ], 'bottom-right': [ 1, 1 ],
};

/** `CommonWidgetSettings`: the colour every widget's text takes, and its etching. */
export const useWidgetText = (draft: HotelViewDraft): CSSProperties => {
    const color = draft.text(COMMON.textColor).replace(/^(#|0x)/i, '');
    const etching = draft.text(COMMON.etchingColor).replace(/^(#|0x)/i, '');
    const [ dx, dy ] = ETCHING[draft.text(COMMON.etchingPosition) || 'bottom'] ?? [ 0, 1 ];
    const hex = (value: string) => (/^[0-9a-f]{8}$/i.test(value) ? `#${value.slice(2)}` : `#${value}`);

    return {
        color: /^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(color) ? hex(color) : '#000000',
        textShadow: /^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(etching) ? `${dx}px ${dy}px 0 ${hex(etching)}` : `${dx}px ${dy}px 0 #ffffff`,
    };
};

/** A pane's width: `landing.view.dynamic.leftPaneWidth` (500) or `rightPaneWidth` (250). */
export const usePaneWidths = (draft: HotelViewDraft) => {
    const read = (key: string, fallback: number) => {
        const value = parseInt(draft.text(key), 10);

        return Number.isNaN(value) ? fallback : value;
    };

    return { left: read(COMMON.leftPaneWidth, 500), right: read(COMMON.rightPaneWidth, 250) };
};

/** What a slot shows at the time given: its widget, or for a container, the promo its schedule picks. */
export const slotShows = (draft: HotelViewDraft, slot: number, now: number) => {
    const type = draft.text(slotKey(slot, 'widget'));

    if (type !== 'widgetcontainer') return { type, code: null as string | null, conf: draft.text(slotKey(slot, 'conf')), layout: draft.text(slotKey(slot, 'layout')) };

    const { code } = currentCode(parseSchedule(draft.text(slotKey(slot, 'conf'))), now);

    return { type: code ? draft.text(codeKey(code, 'widget')) : '', code, conf: code ? draft.text(codeKey(code, 'conf')) : '', layout: code ? draft.text(codeKey(code, 'layout')) : '' };
};

/** The slots holding one of the widgets given. */
export const slotsHolding = (draft: HotelViewDraft, types: readonly string[]) => ALL_SLOTS.filter(slot => types.includes(draft.text(slotKey(slot, 'widget'))));

/** The first of the slots given that holds nothing, or the first of them when all are taken. */
export const firstEmptySlot = (draft: HotelViewDraft, slots: readonly number[]) => slots.find(slot => !draft.text(slotKey(slot, 'widget'))) ?? slots[0]!;

/** A slot in a drop-down: its number, its place, and what it holds now. */
export const slotOption = (draft: HotelViewDraft, slot: number) => {
    const type = draft.text(slotKey(slot, 'widget'));

    // "Scheduled promos", not "Scheduled promos (container)": a drop-down's line has little room.
    return `Slot ${slot} · ${SLOT_PLACES[slot]} · ${type ? `now ${widgetLabel(type).replace(/ \(.*\)$/, '')}` : 'empty'}`;
};

/** Slots as a sentence says them: "slot 2", "slots 2 and 4". */
export const slotNames = (slots: readonly number[]) => (slots.length === 1 ? `slot ${slots[0]}` : `slots ${slots.slice(0, -1).join(', ')} and ${slots[slots.length - 1]}`);

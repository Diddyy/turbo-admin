import { ChevronRight, Eye, EyeOff, LayoutGrid } from 'lucide-react';
import { useState } from 'react';

import { Button, Select } from '#/components/ui';
import { cx } from '#/lib/cx';

import type { HotelViewDraft } from './draft';
import { firstEmptySlot, slotNames, slotOption, slotsHolding } from './hooks';
import { BOTTOM_SLOT, BOTTOM_SLOT_WIDGETS, isWideSlot, slotKey, widgetLabel } from './model';

/** A link to a slot on the reception, in the colour of the line it sits in. */
const SlotLink = ({ slot, onOpen }: { slot: number; onOpen: (slot: number) => void }) => (
    <button type="button" onClick={() => onOpen(slot)} className="inline-flex items-center gap-0.5 text-xs font-medium whitespace-nowrap underline-offset-2 hover:underline [&>svg]:size-3.5">
        Slot {slot}
        <ChevronRight />
    </button>
);

/**
 * Whether players see what a view edits: the reception's slots that hold its widget, each a click
 * away; with none, a slot to put the widget in. Putting it there is a change like any other on the
 * page, live once saved.
 */
export const Placement = ({ draft, widget, narrowWidget, types, what, onOpenSlot, disabled }: {
    draft: HotelViewDraft;
    /** The widget a slot is given to show it. */
    widget: string;
    /** The one a narrow slot (3, 5) is given instead, where the widget has a small kind. */
    narrowWidget?: string;
    /** Every widget that shows it, when it is more than these. */
    types?: readonly string[];
    /** What players see, as a sentence names it: "the promo articles". */
    what: string;
    onOpenSlot: (slot: number) => void;
    disabled?: boolean;
}) => {
    const holding = slotsHolding(draft, types ?? [ widget, ...(narrowWidget ? [ narrowWidget ] : []) ]);
    // Empty slots first, the left column before the right, the bottom slot last when it takes the widget.
    const candidates = [ 2, 3, 4, 5, 1, ...((BOTTOM_SLOT_WIDGETS as readonly string[]).includes(widget) ? [ BOTTOM_SLOT ] : []) ];
    const [ chosen, setChosen ] = useState<number | null>(null);
    const slot = chosen !== null && candidates.includes(chosen) ? chosen : firstEmptySlot(draft, candidates);

    const place = () => {
        const type = narrowWidget && !isWideSlot(slot) ? narrowWidget : widget;

        // A schedule is the slot's conf: what a promo slot had there before is no schedule.
        draft.setMany({
            [slotKey(slot, 'widget')]: JSON.stringify(type),
            ...(type === 'widgetcontainer' ? { [slotKey(slot, 'conf')]: null, [slotKey(slot, 'layout')]: null } : {}),
        });
    };

    if (holding.length > 0) {
        const waiting = holding.filter(x => draft.changed(slotKey(x, 'widget')));
        const saved = holding.filter(x => !waiting.includes(x));

        return (
            <div className={cx('flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl border px-4 py-2.5 text-sm', saved.length > 0 ? 'border-good-line bg-good-soft text-good' : 'border-accent/40 bg-accent-soft text-accent')}>
                <span className="flex min-w-0 flex-1 items-start gap-2.5">
                    <Eye className="mt-0.5 size-4 shrink-0" />
                    <span>
                        {saved.length > 0 ? `Players see ${what} in ${slotNames(saved)}` : `Players will see ${what} in ${slotNames(waiting)} once you press Save`}
                        {saved.length > 0 && waiting.length > 0 && `, and in ${slotNames(waiting)} once you press Save`}.
                    </span>
                </span>
                <span className="flex flex-wrap gap-3">{holding.map(x => <SlotLink key={x} slot={x} onOpen={onOpenSlot} />)}</span>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-3 rounded-xl border border-warn-line bg-warn-soft px-4 py-3 text-sm lg:flex-row lg:items-center">
            <span className="flex min-w-0 flex-1 items-start gap-2.5 text-warn">
                <EyeOff className="mt-0.5 size-4 shrink-0" />
                <span>Players don't see {what}: no slot on the reception holds the {widgetLabel(widget)} widget.</span>
            </span>
            {!disabled && (
                <span className="flex flex-wrap items-center gap-2">
                    <Select value={slot} onChange={event => setChosen(Number(event.target.value))} aria-label="Slot to show it in" className="min-w-0 flex-1 sm:w-96 sm:flex-none">
                        {[ ...candidates ].sort((a, b) => a - b).map(x => <option key={x} value={x}>{slotOption(draft, x)}</option>)}
                    </Select>
                    <Button variant="secondary" icon={<LayoutGrid />} onClick={place}>Show it there</Button>
                </span>
            )}
        </div>
    );
};

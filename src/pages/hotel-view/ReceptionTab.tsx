import { type ReactNode, useEffect, useRef, useState } from 'react';

import { Badge, Panel } from '#/components/ui';
import { cx } from '#/lib/cx';

import { BackgroundsTab } from './BackgroundsTab';
import type { HotelViewDraft } from './draft';
import { slotShows } from './hooks';
import { LookTab } from './LookTab';
import { ALL_SLOTS, BG_TIMING, CATALOG_PROMO_TEXTS, COMMON, currentCode, parseSchedule, type ReceptionPart, SLOT_PLACES, slotKey, WIDGET_SETTINGS, widgetLabel } from './model';
import { Changed } from './parts';
import { ReceptionPreview } from './Preview';
import { SlotEditor } from './SlotEditor';

/** The keys a background set or the default one keeps: its layers, its moving objects. */
const BACKGROUND_KEY = /^landing\.view\.(?:[^.]+\.)?(?:background_[a-z_]+\.(?:uri|visible)|bgobject\.\d+)$/;

const LOOK_KEYS = [ COMMON.textColor, COMMON.etchingColor, COMMON.etchingPosition, COMMON.leftPaneWidth, COMMON.rightPaneWidth, ...Object.values(WIDGET_SETTINGS) ];

const SLOT_KEYS = [ 'widget', 'conf', 'layout', 'separator', 'title', 'ignore' ] as const;

/** One part in the list beside the preview: its name and what it shows now, and under them where it is. */
const PartRow = ({ selected, onClick, label, shows, place, detail, changed }: {
    selected: boolean;
    onClick: () => void;
    label: string;
    shows?: ReactNode;
    place: string;
    /** A word after the place: the promo or the background set showing. */
    detail?: string;
    changed: boolean;
}) => (
    <li>
        <button
            type="button"
            onClick={onClick}
            aria-current={selected || undefined}
            className={cx('flex w-full flex-col gap-0.5 px-4 py-2 text-left hover:bg-subtle', selected && 'bg-accent-soft/60 shadow-[inset_3px_0_0_var(--color-accent)] hover:bg-accent-soft/60')}
        >
            <span className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-sm font-medium">{label} <Changed on={changed} /></span>
                {shows}
            </span>
            <span className="truncate text-xs text-muted">
                {place}
                {detail && <> · <span className="font-mono">{detail}</span></>}
            </span>
        </button>
    </li>
);

/**
 * The reception in one place: as a player sees it, every part of it in a list beside it, and the
 * part chosen - in the list or by a click on the preview - edited under them both, the preview
 * following each change.
 */
export const ReceptionTab = ({ draft, part, onPart, promoCodes, backgroundCodes, now, onOpenPromo, onOpenView, disabled }: {
    draft: HotelViewDraft;
    part: ReceptionPart | null;
    onPart: (part: ReceptionPart) => void;
    promoCodes: string[];
    backgroundCodes: string[];
    now: number;
    onOpenPromo: (code: string) => void;
    onOpenView: (view: string) => void;
    disabled?: boolean;
}) => {
    const [ set, setSet ] = useState('');
    const editor = useRef<HTMLDivElement>(null);
    const chosenSet = set === '' || backgroundCodes.includes(set) ? set : '';
    const background = currentCode(parseSchedule(draft.text(BG_TIMING)), now).code;
    const changedKeys = Object.keys(draft.variables);

    // A part chosen with its editor below the window: bring the editor up into sight.
    useEffect(() => {
        if (part === null || !editor.current) return;

        if (editor.current.getBoundingClientRect().top > window.innerHeight - 120) editor.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, [ part ]);

    return (
        <>
            <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
                <Panel
                    title="As a player sees it"
                    description={part === 'backgrounds'
                        ? `With the background set you are editing: ${chosenSet || 'the default'}.`
                        : 'On a 1600 by 900 window, scaled to fit, without the avatar and the toolbar. Click a slot or the backgrounds to edit them.'}
                >
                    <div className="p-3">
                        <ReceptionPreview
                            draft={draft}
                            now={now}
                            backgroundCode={part === 'backgrounds' ? chosenSet : undefined}
                            selected={typeof part === 'number' ? part : null}
                            onSlot={onPart}
                            onBackground={() => onPart('backgrounds')}
                        />
                    </div>
                </Panel>
                <Panel title="On the reception" description="Choose a part to edit it.">
                    <ul className="divide-y divide-line">
                        <PartRow
                            selected={part === 'backgrounds'}
                            onClick={() => onPart('backgrounds')}
                            label="Backgrounds"
                            place="Behind and around the slots"
                            detail={background || 'default set'}
                            changed={draft.changed(BG_TIMING) || changedKeys.some(x => BACKGROUND_KEY.test(x))}
                        />
                        {ALL_SLOTS.map((slot) => {
                            const shows = slotShows(draft, slot, now);
                            const container = draft.text(slotKey(slot, 'widget')) === 'widgetcontainer';

                            return (
                                <PartRow
                                    key={slot}
                                    selected={part === slot}
                                    onClick={() => onPart(slot)}
                                    label={`Slot ${slot}`}
                                    shows={shows.type
                                        ? <Badge className="min-w-0 truncate">{container ? 'Promo' : widgetLabel(shows.type)}</Badge>
                                        : <span className="text-xs whitespace-nowrap text-muted">{container ? 'nothing scheduled' : 'empty'}</span>}
                                    place={SLOT_PLACES[slot]!}
                                    detail={container ? shows.code || undefined : undefined}
                                    changed={SLOT_KEYS.some(x => draft.changed(slotKey(slot, x)))}
                                />
                            );
                        })}
                        <PartRow
                            selected={part === 'look'}
                            onClick={() => onPart('look')}
                            label="Look and widgets"
                            place="Text colour, columns, widget settings"
                            changed={LOOK_KEYS.some(x => draft.changed(x)) || CATALOG_PROMO_TEXTS.some(x => draft.phraseChanged(x.key))}
                        />
                    </ul>
                </Panel>
            </div>
            <div ref={editor} className="flex scroll-mt-28 flex-col gap-4 lg:scroll-mt-4">
                {part === 'backgrounds' && <BackgroundsTab draft={draft} codes={backgroundCodes} now={now} set={chosenSet} onSet={setSet} disabled={disabled} />}
                {part === 'look' && <LookTab draft={draft} disabled={disabled} />}
                {typeof part === 'number' && <SlotEditor key={part} slot={part} draft={draft} codes={promoCodes} now={now} onOpenPromo={onOpenPromo} onOpenView={onOpenView} disabled={disabled} />}
            </div>
        </>
    );
};

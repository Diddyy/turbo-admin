import { CalendarPlus, Copy, Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';

import { ask } from '#/components/confirm';
import { SearchInput } from '#/components/SearchInput';
import { Badge, type BadgeTone, Button, EmptyState, Input, Labeled, Panel, Select } from '#/components/ui';
import { cx } from '#/lib/cx';
import { useFillHeight } from '#/lib/fillHeight';

import type { HotelViewDraft } from './draft';
import { GenericEditor } from './GenericEditor';
import { firstEmptySlot } from './hooks';
import {
    codeKey, codeProblem, currentCode, formatSchedule, fromLocalInput, isWideSlot, nowAt, parseSchedule, parseTime, scheduleBetween, scheduleWindows, SLOT_PLACES, slotKey, SLOTS, toLocalInput, WIDGET_TYPES, widgetLabel,
} from './model';
import { Changed } from './parts';
import { Placement } from './Placement';

/** Where a promo is scheduled: each container slot that names it, and whether it shows there now. */
const usesOf = (draft: HotelViewDraft, code: string, now: number) => SLOTS
    .filter(slot => draft.text(slotKey(slot, 'widget')) === 'widgetcontainer')
    .map((slot) => {
        const entries = parseSchedule(draft.text(slotKey(slot, 'conf')));

        return { slot, scheduled: entries.some(x => x.code === code), showing: currentCode(entries, now).code === code };
    })
    .filter(x => x.scheduled);

/** Each time a slot's schedule shows a promo: from when, until when, and how that stands at the time. */
const windowsOf = (draft: HotelViewDraft, code: string, now: number) => SLOTS
    .filter(slot => draft.text(slotKey(slot, 'widget')) === 'widgetcontainer')
    .flatMap(slot => scheduleWindows(parseSchedule(draft.text(slotKey(slot, 'conf'))))
        .filter(x => x.entry.code === code)
        .map(({ entry, index, from, until }) => {
            const state: { label: string; tone: BadgeTone } = from === null || until === from
                ? { label: 'Never', tone: 'amber' }
                : now < from ? { label: 'Upcoming', tone: 'accent' } : until !== null && until <= now ? { label: 'Over', tone: 'neutral' } : { label: 'Showing', tone: 'green' };

            return { slot, entry, index, from, until, state };
        }));

/**
 * Adds the promo to a slot's schedule, from a time and until one if given. A slot that shows no
 * promos yet becomes one that does, in place of what it held.
 */
const ScheduleIt = ({ draft, code, now }: { draft: HotelViewDraft; code: string; now: number }) => {
    const containers: number[] = SLOTS.filter(slot => draft.text(slotKey(slot, 'widget')) === 'widgetcontainer');
    const others = SLOTS.filter(slot => !containers.includes(slot));
    const [ chosen, setChosen ] = useState<number | null>(null);
    const slot = chosen ?? containers[0] ?? firstEmptySlot(draft, [ 2, 3, 4, 5, 1 ]);
    const [ from, setFrom ] = useState(() => nowAt(now));
    const [ until, setUntil ] = useState('');
    const fromTime = parseTime(from);
    const untilTime = until ? parseTime(until) : null;
    const problem = fromTime === null ? 'It needs a time to start.' : untilTime !== null && untilTime <= fromTime ? 'It has to end after it starts.' : null;

    const add = () => {
        const container = containers.includes(slot);
        const schedule = formatSchedule(scheduleBetween(container ? parseSchedule(draft.text(slotKey(slot, 'conf'))) : [], code, from, until || null));

        // A slot taking its first promo was something else: what it had in its conf is no schedule.
        draft.setMany({
            [slotKey(slot, 'widget')]: JSON.stringify('widgetcontainer'),
            [slotKey(slot, 'conf')]: JSON.stringify(schedule),
            ...(container ? {} : { [slotKey(slot, 'layout')]: null }),
        });
        setUntil('');
    };

    return (
        <div className="flex flex-col gap-3 rounded-lg border border-dashed border-line p-3">
            <div className="flex flex-wrap items-end gap-3">
                <Labeled label="Show it in" className="min-w-0 flex-[1_1_16rem]">
                    <Select value={slot} onChange={event => setChosen(Number(event.target.value))}>
                        {containers.length > 0 && (
                            <optgroup label="Slots showing scheduled promos">
                                {containers.map(x => <option key={x} value={x}>Slot {x} · {SLOT_PLACES[x]}</option>)}
                            </optgroup>
                        )}
                        <optgroup label="Other slots, which start showing scheduled promos">
                            {others.map((x) => {
                                const type = draft.text(slotKey(x, 'widget'));

                                return <option key={x} value={x}>Slot {x} · {SLOT_PLACES[x]} · {type ? `replaces ${widgetLabel(type)}` : 'empty'}</option>;
                            })}
                        </optgroup>
                    </Select>
                </Labeled>
                <Labeled label="From (UTC)">
                    <Input type="datetime-local" value={toLocalInput(from)} onChange={event => setFrom(fromLocalInput(event.target.value))} />
                </Labeled>
                <Labeled label="Until (UTC)">
                    <Input type="datetime-local" value={toLocalInput(until)} onChange={event => setUntil(fromLocalInput(event.target.value))} />
                </Labeled>
                <Button icon={<CalendarPlus />} disabled={!!problem} onClick={add}>Schedule it</Button>
            </div>
            <p className={cx('text-xs', problem ? 'text-warn' : 'text-muted')}>
                {problem ?? 'A later entry in the slot\'s schedule still takes over when it starts; with no end, it shows until one does. Kept with your other changes until you press Save.'}
            </p>
        </div>
    );
};

/** Where the promo shows: each time a slot's schedule names it, and a way to add another. */
const WhereItShows = ({ draft, code, now, onOpenSlot, disabled }: { draft: HotelViewDraft; code: string; now: number; onOpenSlot: (slot: number) => void; disabled?: boolean }) => {
    const windows = windowsOf(draft, code, now);

    return (
        <section className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold">Where it shows</h3>
            {windows.length === 0
                ? <p className="text-sm text-warn">Players don't see it: no slot's schedule names it yet.</p>
                : (
                        <ul className="divide-y divide-line rounded-lg border border-line text-sm">
                            {windows.map(x => (
                                <li key={`${x.slot}:${x.index}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                                    <button type="button" onClick={() => onOpenSlot(x.slot)} className="font-medium text-accent hover:underline">Slot {x.slot}</button>
                                    <span className="text-muted">
                                        {x.from === null
                                            ? <>at <span className="font-mono text-xs">{x.entry.at || 'no time'}</span>, which is no time the server reads</>
                                            : x.until === x.from
                                                ? <>at {nowAt(x.from)}, where a later entry at the same time hides it</>
                                                : <>from {nowAt(x.from)} UTC{x.until === null ? ', with no end' : ` until ${nowAt(x.until)} UTC`}</>}
                                    </span>
                                    <span className="ml-auto"><Badge tone={x.state.tone}>{x.state.label}</Badge></span>
                                </li>
                            ))}
                        </ul>
                    )}
            {!disabled && <ScheduleIt key={code} draft={draft} code={code} now={now} />}
        </section>
    );
};

/** A new promo's code, and the promo it starts as a copy of, if any. */
const NewPromo = ({ codes, from, onMake, onCancel }: { codes: string[]; from: string | null; onMake: (code: string) => void; onCancel: () => void }) => {
    const [ code, setCode ] = useState(from ? `${from}copy` : '');
    const problem = codeProblem(code.trim(), codes);

    return (
        <form
            className="flex flex-col gap-3 border-b border-line bg-subtle/40 p-4"
            onSubmit={(event) => {
                event.preventDefault();

                if (!problem) onMake(code.trim());
            }}
        >
            <Labeled label={from ? `Copy of ${from}: its code` : 'Code'} hint={code && problem ? <span className="text-warn">{problem}</span> : 'A short word schedules name it by, such as summer26sale.'}>
                <Input value={code} onChange={event => setCode(event.target.value)} className="w-full font-mono" autoFocus />
            </Labeled>
            <div className="flex gap-2">
                <Button type="submit" icon={<Plus />} disabled={!!problem}>{from ? 'Copy' : 'Make'}</Button>
                <Button variant="ghost" icon={<X />} onClick={onCancel}>Cancel</Button>
            </div>
        </form>
    );
};

/**
 * The promos a container slot's schedule can show, each under a code: its widget (usually a
 * generic promo of a picture, words and a button), what it says and where it is scheduled. Above
 * them, whether any slot shows scheduled promos at all.
 */
export const PromosTab = ({ draft, codes, now, open, onOpen, onOpenSlot, disabled }: {
    draft: HotelViewDraft;
    codes: string[];
    now: number;
    open: string | null;
    onOpen: (code: string | null) => void;
    onOpenSlot: (slot: number) => void;
    disabled?: boolean;
}) => {
    const [ making, setMaking ] = useState<{ from: string | null } | null>(null);
    const [ filter, setFilter ] = useState('');
    const fillPromos = useFillHeight<HTMLElement>();
    const shown = codes.filter(x => x.toLowerCase().includes(filter.trim().toLowerCase()));
    const selected = open && codes.includes(open) ? open : null;

    const make = (code: string, from: string | null) => {
        if (from) {
            draft.setMany({
                [codeKey(code, 'widget')]: draft.json(codeKey(from, 'widget')) ?? null,
                [codeKey(code, 'conf')]: draft.json(codeKey(from, 'conf')) ?? null,
                [codeKey(code, 'layout')]: draft.json(codeKey(from, 'layout')) ?? null,
            });
        } else {
            draft.setMany({
                [codeKey(code, 'widget')]: JSON.stringify('generic'),
                [codeKey(code, 'conf')]: JSON.stringify(`caption,landing.view.${code}.header;bodytext,landing.view.${code}.body;catalogbutton,landing.view.${code}.button,`),
                [codeKey(code, 'layout')]: JSON.stringify('bitmap.x,50;bitmap.y,0;container.height,250'),
            });
        }

        setMaking(null);
        onOpen(code);
    };

    const remove = (code: string) => {
        const uses = usesOf(draft, code, now);
        const body = uses.length > 0
            ? `It is taken out of the schedules of slot ${uses.map(x => x.slot).join(' and ')} too. Its texts stay.`
            : 'Its texts stay.';

        ask({ title: `Remove the promo ${code}?`, body, confirm: 'Remove' }, () => {
            draft.setMany({
                [codeKey(code, 'widget')]: null,
                [codeKey(code, 'conf')]: null,
                [codeKey(code, 'layout')]: null,
                ...Object.fromEntries(uses.map(({ slot }) => {
                    const schedule = formatSchedule(parseSchedule(draft.text(slotKey(slot, 'conf'))).filter(x => x.code !== code));

                    return [ slotKey(slot, 'conf'), schedule ? JSON.stringify(schedule) : null ];
                })),
            });
            onOpen(null);
        });
    };

    return (
        <div className="flex flex-col gap-4">
            <Placement draft={draft} widget="widgetcontainer" what="scheduled promos" onOpenSlot={onOpenSlot} disabled={disabled} />
            <div className="grid items-start gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
                <Panel ref={fillPromos} className="flex flex-col overflow-clip lg:sticky lg:top-4 lg:max-h-(--fill-height)">
                    <div className="flex items-center gap-2 border-b border-line p-3">
                        <SearchInput value={filter} onValueChange={setFilter} placeholder="Find a promo" className="min-w-0 flex-1" />
                        {!disabled && <Button variant="secondary" icon={<Plus />} onClick={() => setMaking({ from: null })}>New</Button>}
                    </div>
                    {making && <NewPromo codes={codes} from={making.from} onMake={code => make(code, making.from)} onCancel={() => setMaking(null)} />}
                    {shown.length === 0 && <EmptyState>{codes.length === 0 ? 'No promos yet.' : 'No promo has that code.'}</EmptyState>}
                    <ul className="max-h-[60dvh] min-h-0 divide-y divide-line overflow-y-auto lg:max-h-none">
                        {shown.map((code) => {
                            const uses = usesOf(draft, code, now);
                            const type = draft.text(codeKey(code, 'widget'));

                            return (
                                <li key={code}>
                                    <button
                                        type="button"
                                        onClick={() => onOpen(code)}
                                        className={cx('flex w-full flex-col gap-1 px-3 py-2.5 text-left hover:bg-subtle', selected === code && 'bg-accent-soft/50')}
                                    >
                                        <span className="flex items-center gap-2 font-mono text-[13px]">
                                            <span className="truncate">{code}</span>
                                            <Changed on={[ 'widget', 'conf', 'layout' ].some(x => draft.changed(codeKey(code, x as 'widget')))} />
                                        </span>
                                        <span className="flex flex-wrap gap-1">
                                            {!type && <Badge tone="amber">No widget</Badge>}
                                            {type && type !== 'generic' && <Badge>{widgetLabel(type)}</Badge>}
                                            {uses.length === 0 && <Badge tone="amber">Not scheduled</Badge>}
                                            {uses.some(x => x.showing) && <Badge tone="green">Showing in {uses.filter(x => x.showing).map(x => x.slot).join(', ')}</Badge>}
                                            {uses.some(x => !x.showing) && <Badge tone="accent">Scheduled in {uses.filter(x => !x.showing).map(x => x.slot).join(', ')}</Badge>}
                                        </span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </Panel>
                {!selected && <Panel><EmptyState>Choose a promo to edit, or make a new one.</EmptyState></Panel>}
                {selected && (() => {
                    const type = draft.text(codeKey(selected, 'widget'));
                    const uses = usesOf(draft, selected, now);

                    return (
                        <Panel
                            key={selected}
                            title={<span className="font-mono">{selected}</span>}
                            description={uses.length > 0
                                ? <>Scheduled in {uses.map((x, i) => <span key={x.slot}>{i > 0 && ', '}<button type="button" className="text-accent hover:underline" onClick={() => onOpenSlot(x.slot)}>slot {x.slot}</button>{x.showing && ' (showing)'}</span>)}</>
                                : 'Not scheduled in any slot yet.'}
                            actions={!disabled && (
                                <>
                                    <Button variant="ghost" icon={<Copy />} onClick={() => setMaking({ from: selected })}>Copy</Button>
                                    <Button variant="ghost" icon={<Trash2 />} className="text-bad hover:text-bad" onClick={() => remove(selected)}>Remove</Button>
                                </>
                            )}
                        >
                            <div className="flex flex-col gap-5 p-4">
                                <WhereItShows draft={draft} code={selected} now={now} onOpenSlot={onOpenSlot} disabled={disabled} />
                                <Labeled label="Widget" className="sm:max-w-96">
                                    <Select value={type} onChange={event => draft.setText(codeKey(selected, 'widget'), event.target.value)} disabled={disabled}>
                                        <option value="">None</option>
                                        {WIDGET_TYPES.filter(x => x.value !== 'widgetcontainer').map(x => <option key={x.value} value={x.value}>{x.label}{x.drawn ? '' : ' (not drawn yet)'}</option>)}
                                        {type && !WIDGET_TYPES.some(x => x.value === type) && <option value={type}>{type}</option>}
                                    </Select>
                                </Labeled>
                                {type === 'generic' && (
                                    <GenericEditor
                                        confKey={codeKey(selected, 'conf')}
                                        layoutKey={codeKey(selected, 'layout')}
                                        draft={draft}
                                        wide={uses.length === 0 || uses.some(x => isWideSlot(x.slot))}
                                        textPrefix={`landing.view.${selected}.`}
                                        disabled={disabled}
                                    />
                                )}
                                {type && type !== 'generic' && <p className="text-sm text-muted">This widget takes nothing from the promo: it draws what the server tells it.</p>}
                            </div>
                        </Panel>
                    );
                })()}
            </div>
        </div>
    );
};

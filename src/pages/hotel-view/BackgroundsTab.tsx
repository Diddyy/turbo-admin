import { Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';

import type { ImageAccept } from '#/api/media';
import { ask } from '#/components/confirm';
import { Button, Input, Labeled, Panel, Select, Switch } from '#/components/ui';

import type { HotelViewDraft } from './draft';
import { useResolveImage } from './hooks';
import { BACKGROUND_LAYERS, BG_TIMING, bgObjectKey, codeProblem, formatSchedule, layerKey, LIBRARY_ADDRESS, MAX_MOVING_OBJECTS, parseSchedule } from './model';
import { MovingObjects } from './MovingObjects';
import { ImageField, ScheduleEditor } from './parts';

const BACKGROUND_IMAGE: ImageAccept = { ...LIBRARY_ADDRESS, usedIn: 'hotelView.background', folder: 'reception' };

/**
 * The reception's backgrounds: the default set, and sets under a code that a schedule
 * (`landing.view.bgtiming`) switches to from a time on - a season, an event. A set's layer left
 * empty keeps the picture the client had. The set being edited is the reception preview's, above.
 */
export const BackgroundsTab = ({ draft, codes, now, set: chosen, onSet: setSet, disabled }: {
    draft: HotelViewDraft;
    codes: string[];
    now: number;
    /** The set being edited: a code, or empty for the default set. */
    set: string;
    onSet: (code: string) => void;
    disabled?: boolean;
}) => {
    const resolve = useResolveImage(draft);
    const [ making, setMaking ] = useState<string | null>(null);
    const problem = making === null ? null : codeProblem(making.trim(), codes);

    const remove = (code: string) => ask(
        { title: `Remove the background set ${code}?`, body: 'It is taken out of the schedule too.', confirm: 'Remove' },
        () => {
            const schedule = formatSchedule(parseSchedule(draft.text(BG_TIMING)).filter(x => x.code !== code));

            draft.setMany({
                ...Object.fromEntries(BACKGROUND_LAYERS.flatMap(({ name }) => [ [ layerKey(code, name, 'uri'), null ], [ layerKey(code, name, 'visible'), null ] ])),
                ...Object.fromEntries(Array.from({ length: MAX_MOVING_OBJECTS }, (_, i) => [ bgObjectKey(code, i + 1), null ])),
                [BG_TIMING]: schedule ? JSON.stringify(schedule) : null,
            });
            setSet('');
        },
    );

    return (
        <div className="flex flex-col gap-4">
            <Panel title="Schedule" description="From each time on, its set of backgrounds shows, until the next starts. Before any, the default set.">
                <div className="p-4">
                    <ScheduleEditor value={draft.text(BG_TIMING)} onChange={value => draft.setText(BG_TIMING, value)} codes={codes} now={now} emptyLabel="the default backgrounds show" onOpen={setSet} disabled={disabled} />
                </div>
            </Panel>
            <Panel
                title="Backgrounds"
                description={chosen ? `The set ${chosen}: a layer left empty keeps the picture of the set before it.` : 'The default set, shown while the schedule names none.'}
                actions={(
                    <>
                        <Select value={chosen} onChange={event => setSet(event.target.value)} aria-label="Set" className="font-mono text-xs">
                            <option value="">Default</option>
                            {codes.map(code => <option key={code} value={code}>{code}</option>)}
                        </Select>
                        {!disabled && <Button variant="secondary" icon={<Plus />} onClick={() => setMaking('')}>New set</Button>}
                        {!disabled && chosen && <Button variant="ghost" icon={<Trash2 />} className="text-bad hover:text-bad" onClick={() => remove(chosen)}>Remove</Button>}
                    </>
                )}
            >
                {making !== null && (
                    <form
                        className="flex flex-wrap items-end gap-2 border-b border-line bg-subtle/40 p-4"
                        onSubmit={(event) => {
                            event.preventDefault();

                            if (problem) return;

                            // A set is its layers: start it with the default's pictures, to change.
                            draft.setMany(Object.fromEntries(BACKGROUND_LAYERS.map(({ name }) => [ layerKey(making.trim(), name, 'uri'), draft.json(layerKey('', name, 'uri')) ?? null ])));
                            setSet(making.trim());
                            setMaking(null);
                        }}
                    >
                        <Labeled label="Code" hint={making && problem ? <span className="text-warn">{problem}</span> : 'Such as halloween26. Then add it to the schedule.'} className="min-w-0 flex-1 sm:max-w-80">
                            <Input value={making} onChange={event => setMaking(event.target.value)} className="w-full font-mono" autoFocus />
                        </Labeled>
                        <Button type="submit" icon={<Plus />} disabled={!!problem}>Make</Button>
                        <Button variant="ghost" icon={<X />} onClick={() => setMaking(null)}>Cancel</Button>
                    </form>
                )}
                <ul className="divide-y divide-line">
                    {BACKGROUND_LAYERS.map(({ name, label, hint }) => {
                        const uri = layerKey(chosen, name, 'uri');
                        const visible = layerKey(chosen, name, 'visible');

                        return (
                            <li key={name} className="flex flex-col gap-2 p-4">
                                <ImageField label={label} hint={hint} value={draft.text(uri)} onChange={value => draft.setText(uri, value)} accept={BACKGROUND_IMAGE} resolve={resolve} changed={draft.changed(uri)} disabled={disabled} />
                                <Switch
                                    label="Shown"
                                    hint="Hidden, the layer is not drawn at all while this set shows."
                                    checked={draft.text(visible) !== 'false'}
                                    onChange={checked => draft.setJson(visible, checked ? null : 'false')}
                                    disabled={disabled}
                                    className="sm:max-w-96 sm:pl-19"
                                />
                            </li>
                        );
                    })}
                </ul>
            </Panel>
            <MovingObjects code={chosen} draft={draft} disabled={disabled} />
        </div>
    );
};

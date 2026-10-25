import { RotateCcw, Save, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { type CampaignCalendar, refusalOf, useCampaignCalendar, useDeleteCampaignCalendar, useSaveCampaignCalendar } from '#/api/campaigns';
import { useCurrencies } from '#/api/content';
import { ask } from '#/components/confirm';
import { celebrate, toast, toastError } from '#/components/toast';
import { Badge, Button, ErrorNotice, Input, Labeled, Loading, PageBody, PageHeader, Panel, Select, Switch } from '#/components/ui';
import { cx } from '#/lib/cx';
import { inputToIso, isoToInput } from '#/pages/hotel-view/model';

import { DayGrid, TodayPreview } from './Doors';
import { FieldError, GiftEditor } from './GiftEditor';
import { blankCalendar, blankGift, currentDay, localText, STATUS, statusOf } from './model';

/** Whole numbers from an input, not below a floor. */
const whole = (text: string, min = 0) => Math.max(min, Math.floor(Number(text) || 0));

/**
 * One calendar's editor: its name, start, length and switch, a door per day with its gift, and the
 * doors as a player sees them today. Changes stay here until saved; the server checks the whole
 * calendar and a refusal shows on the field it is about.
 */
export const CalendarEditor = ({ id, onBack, onSaved }: { id: number | null; onBack: () => void; onSaved: (id: number) => void }) => {
    const { data, error } = useCampaignCalendar(id);
    const currencies = useCurrencies().data?.items ?? [];
    const save = useSaveCampaignCalendar();
    const remove = useDeleteCampaignCalendar();
    const saved = useMemo(() => data ?? (id === null ? blankCalendar() : null), [ data, id ]);
    const [ draft, setDraft ] = useState<CampaignCalendar | null>(null);
    const [ selected, setSelected ] = useState<number | null>(0);
    const [ previewDay, setPreviewDay ] = useState<number | null>(null);
    const calendar = draft ?? saved;
    const isNew = id === null;
    const dirty = !!draft && JSON.stringify(draft) !== JSON.stringify(saved);
    const refusal = refusalOf(save.error);

    useEffect(() => {
        if (!dirty) return;

        const warn = (event: BeforeUnloadEvent) => event.preventDefault();

        window.addEventListener('beforeunload', warn);

        return () => window.removeEventListener('beforeunload', warn);
    }, [ dirty ]);

    const header = (
        <PageHeader
            title={calendar?.name || (isNew ? 'New calendar' : 'Calendar')}
            description={isNew ? 'A new calendar: nothing is made until you save it' : 'One door a day, each with a gift'}
            back={{ to: '/campaigns', label: 'Campaigns' }}
        >
            {!isNew && calendar && (
                <Button
                    variant="danger"
                    icon={<Trash2 />}
                    disabled={remove.isPending}
                    onClick={() => ask({ title: `Delete the calendar ${calendar.name}?`, body: 'Its gifts and who opened which door go with it. Gifts already given stay with the players.', confirm: 'Delete' }, () => {
                        remove.mutate(calendar.id, {
                            onSuccess: () => {
                                toast(`Deleted ${calendar.name}.`);
                                onBack();
                            },
                            onError: toastError,
                        });
                    })}
                >
                    Delete
                </Button>
            )}
        </PageHeader>
    );

    if (!calendar)
        return <>{header}<PageBody>{error ? <ErrorNotice error={error} /> : <Loading />}</PageBody></>;

    const change = (next: CampaignCalendar) => {
        setDraft(next);
        if (save.isError) save.reset();
    };
    const set = <K extends keyof CampaignCalendar>(key: K, value: CampaignCalendar[K]) => change({ ...calendar, [key]: value });
    const errorOf = (field: string, day: number | null = null) => (refusal && refusal.field === field && refusal.dayIndex === day ? refusal.message : null);
    const gift = selected === null ? undefined : calendar.rewards.find(x => x.dayIndex === selected);
    const status = STATUS[statusOf(calendar)];
    const today = currentDay(calendar);
    const shownDay = previewDay ?? today;
    const outside = calendar.rewards.filter(x => x.dayIndex >= calendar.days).length;
    // A refusal of no field the editor shows (another calendar's name is the name field's) reads as the error it is.
    const fieldless = !!save.error && (!refusal || (refusal.dayIndex === null && ![ 'name', 'image', 'days' ].includes(refusal.field)));

    return (
        <>
            {header}
            <PageBody className="flex flex-col gap-4 lg:gap-5">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                    <Badge tone={status.tone}>{status.label}</Badge>
                    <span>{status.meaning}</span>
                    <span>· {calendar.rewards.length} of {calendar.days} doors have a gift</span>
                </div>
                <Panel title="Calendar" description="Players are sent the live calendar at login (the latest started when several are); the client opens it from the openView/calendar link.">
                    <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-4">
                        <Labeled label="Name" hint="Letters, digits, _ and -. Its title text is campaign.calendar.<name>.title.">
                            <Input value={calendar.name} onChange={event => set('name', event.target.value.trim())} placeholder="e.g. advent2026" maxLength={64} className={cx('font-mono', errorOf('name') && 'border-bad')} aria-label="Name" spellCheck={false} />
                            <FieldError message={errorOf('name')} />
                        </Labeled>
                        <Labeled label="Image" hint="Sent with the calendar (campaignImage).">
                            <Input value={calendar.image} onChange={event => set('image', event.target.value.trim())} placeholder="e.g. xmas26.png" className={cx('font-mono', errorOf('image') && 'border-bad')} aria-label="Image" spellCheck={false} />
                            <FieldError message={errorOf('image')} />
                        </Labeled>
                        <Labeled label="Starts (UTC)" hint={<>Day 1's door opens then, each next a day later. Your time: {localText(calendar.startsAt)}.</>}>
                            <Input type="datetime-local" value={isoToInput(calendar.startsAt)} onChange={event => set('startsAt', inputToIso(event.target.value) ?? calendar.startsAt)} aria-label="Starts (UTC)" />
                        </Labeled>
                        <Labeled label="Days" hint="1 to 366 doors.">
                            <Input type="number" min={1} max={366} value={calendar.days} onChange={event => set('days', whole(event.target.value, 1))} className={cx('font-mono', errorOf('days') && 'border-bad')} aria-label="Days" />
                            <FieldError message={errorOf('days')} />
                        </Labeled>
                    </div>
                    <div className="border-t border-line px-4 py-3">
                        <Switch label="On" hint="Off, it is sent to nobody and no door opens." checked={calendar.enabled} onChange={value => set('enabled', value)} />
                    </div>
                </Panel>
                <Panel
                    title="Doors"
                    description={`Pick a door to give it a gift. A dashed door has none and gives nothing.${outside ? ` ${outside} gift${outside === 1 ? ' is' : 's are'} past the last day and will be refused.` : ''}`}
                >
                    <DayGrid calendar={calendar} selected={selected} faulty={refusal?.dayIndex ?? null} onSelect={setSelected} />
                </Panel>
                {selected !== null && selected < calendar.days && (gift
                    ? (
                            <GiftEditor
                                gift={gift}
                                currencies={currencies}
                                errorOf={field => errorOf(field, gift.dayIndex)}
                                onChange={next => set('rewards', calendar.rewards.map(x => (x.dayIndex === next.dayIndex ? next : x)))}
                                onRemove={() => set('rewards', calendar.rewards.filter(x => x.dayIndex !== selected))}
                            />
                        )
                    : (
                            <Panel title={`Day ${selected + 1}`} description="This door has no gift.">
                                <div className="p-4">
                                    <Button variant="secondary" onClick={() => set('rewards', [ ...calendar.rewards, blankGift(selected) ].sort((a, b) => a.dayIndex - b.dayIndex))}>Give a gift on day {selected + 1}</Button>
                                </div>
                            </Panel>
                        ))}
                <Panel
                    title="Today, as a player sees it"
                    description={today < 0 ? 'Before its first day every door is shut, and players are not sent it yet.' : today >= calendar.days ? 'Past its last day: players are not sent it any more.' : `The window opens on Day ${today + 1}. A player who has opened nothing yet sees these doors.`}
                    actions={(
                        <Select value={previewDay ?? ''} onChange={event => setPreviewDay(event.target.value === '' ? null : Number(event.target.value))} aria-label="Preview day" className="w-36">
                            <option value="">Today</option>
                            {Array.from({ length: calendar.days }, (_, day) => <option key={day} value={day}>As on day {day + 1}</option>)}
                        </Select>
                    )}
                >
                    <TodayPreview calendar={calendar} today={shownDay} />
                </Panel>
                {(dirty || isNew || save.isError) && (
                    <div className="sticky bottom-3 z-20 rounded-xl border border-accent/40 bg-surface/95 shadow-lg backdrop-blur">
                        <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                            <span className="text-sm">{isNew ? 'A new calendar, not saved' : 'Changes not saved'}</span>
                            {refusal && <span className="text-xs text-bad">{refusal.dayIndex !== null ? `Door ${refusal.dayIndex + 1}: ` : ''}{refusal.message}</span>}
                            {fieldless && <div className="w-full sm:order-last"><ErrorNotice error={save.error} /></div>}
                            <span className="ml-auto flex gap-2">
                                {!isNew && <Button variant="ghost" icon={<RotateCcw />} disabled={save.isPending || !dirty} onClick={() => ask({ title: 'Throw away every change not saved?', confirm: 'Discard' }, () => setDraft(null))}>Discard</Button>}
                                <Button
                                    icon={<Save />}
                                    disabled={save.isPending || (!dirty && !isNew)}
                                    onClick={(event) => {
                                        const button = event.currentTarget;

                                        save.mutate(calendar, {
                                            onSuccess: (result) => {
                                                celebrate(button);
                                                setDraft(null);
                                                toast(`Saved ${result.name}.`);
                                                if (isNew) onSaved(result.id);
                                            },
                                            onError: (failure) => {
                                                const day = refusalOf(failure)?.dayIndex;

                                                if (day !== null && day !== undefined) setSelected(day);
                                            },
                                        });
                                    }}
                                >
                                    {save.isPending ? 'Saving' : 'Save'}
                                </Button>
                            </span>
                        </div>
                    </div>
                )}
            </PageBody>
        </>
    );
};

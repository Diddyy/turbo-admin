import { Plus } from 'lucide-react';
import { useNavigate, useParams } from 'react-router';

import { type CampaignCalendar, useCampaignCalendars, useSaveCampaignCalendar } from '#/api/campaigns';
import { toast, toastError } from '#/components/toast';
import { Badge, Button, EmptyState, ErrorNotice, Loading, PageBody, PageHeader, Panel, Switch, Td, Th } from '#/components/ui';

import { CalendarEditor } from './CalendarEditor';
import { currentDay, localText, STATUS, statusOf, utcText } from './model';

/** Where a calendar is today: its day, or how far it is from its days. */
const TodayText = ({ calendar }: { calendar: CampaignCalendar }) => {
    const day = currentDay(calendar);

    if (day < 0) return <span className="text-muted">Not started</span>;
    if (day >= calendar.days) return <span className="text-muted">Over</span>;

    return <span className="font-mono tabular-nums">Day {day + 1} <span className="text-muted">of {calendar.days}</span></span>;
};

const CalendarList = ({ calendars, onOpen }: { calendars: CampaignCalendar[]; onOpen: (id: number) => void }) => {
    const save = useSaveCampaignCalendar();

    if (calendars.length === 0) return <EmptyState>No calendars yet. Make one: a door a day, each with a gift.</EmptyState>;

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr>
                        <Th>Calendar</Th>
                        <Th>Status</Th>
                        <Th className="w-0">On</Th>
                        <Th>Starts (UTC)</Th>
                        <Th>Today</Th>
                        <Th className="text-right">Gifts</Th>
                    </tr>
                </thead>
                <tbody className="[&>tr:last-child>td]:border-b-0">
                    {calendars.map((calendar) => {
                        const status = STATUS[statusOf(calendar)];

                        return (
                            <tr key={calendar.id} onClick={() => onOpen(calendar.id)} className="cursor-pointer hover:bg-subtle/60">
                                <Td>
                                    <button type="button" className="rounded text-left font-mono">{calendar.name}</button>
                                    {calendar.image && <span className="block font-mono text-[11px] text-muted">{calendar.image}</span>}
                                </Td>
                                <Td><span title={status.meaning}><Badge tone={status.tone}>{status.label}</Badge></span></Td>
                                <Td>
                                    <span onClick={event => event.stopPropagation()}>
                                        <Switch
                                            label={<span className="sr-only">{`${calendar.name} on`}</span>}
                                            checked={calendar.enabled}
                                            disabled={save.isPending}
                                            onChange={enabled => save.mutate({ ...calendar, enabled }, { onSuccess: () => toast(`${calendar.name} is ${enabled ? 'on' : 'off'}: players get it at their next login.`), onError: toastError })}
                                        />
                                    </span>
                                </Td>
                                <Td>
                                    <span className="block font-mono text-xs">{utcText(calendar.startsAt)}</span>
                                    <span className="block text-[11px] text-muted">{localText(calendar.startsAt)} your time</span>
                                </Td>
                                <Td className="text-xs"><TodayText calendar={calendar} /></Td>
                                <Td className="text-right font-mono text-xs tabular-nums">{calendar.rewards.length} <span className="text-muted">/ {calendar.days} days</span></Td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

/**
 * The campaign calendars (advent-style): one door a day, each with a gift. The list with where each
 * stands, and a calendar's editor with its doors, their gifts and the doors as players see them today.
 */
export const CampaignsPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { data, error } = useCampaignCalendars();
    const open = (to: number | 'new') => void navigate(`/campaigns/${to}`);

    if (id)
        return <CalendarEditor key={id} id={id === 'new' ? null : Number(id)} onBack={() => void navigate('/campaigns')} onSaved={saved => void navigate(`/campaigns/${saved}`, { replace: true })} />;

    return (
        <>
            <PageHeader title="Campaigns" description="Gift calendars: a door a day, each with a gift">
                <Button icon={<Plus />} onClick={() => open('new')}>New calendar</Button>
            </PageHeader>
            <PageBody className="flex flex-col gap-4 lg:gap-5">
                {error && <ErrorNotice error={error} />}
                {!data && !error && <Loading />}
                {data && (
                    <Panel title="Calendars" description="Players are sent the live one at login (the latest started when several are). A player opens today's door only; an earlier one not opened is missed.">
                        <CalendarList calendars={data.calendars} onOpen={open} />
                    </Panel>
                )}
            </PageBody>
        </>
    );
};

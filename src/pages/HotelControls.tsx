import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Megaphone, MessageSquareText, Power, RotateCw, Wrench } from 'lucide-react';
import { type ReactNode, useId, useState } from 'react';

import { post } from '#/api/client';
import { actOnHotel, type HotelActionRequest, saveWelcomeMessage, useHotelAbilities, useWelcomeMessage, type WelcomeMessage } from '#/api/queries';
import { restartState, useServerRestart } from '#/api/server';
import type { AvailabilityPhase, RunCommandResponse } from '#/api/types';
import { CommandAnswer } from '#/components/CommandAnswer';
import { ask, type Question } from '#/components/confirm';
import { RestartServer } from '#/components/RestartServer';
import { Button, ErrorNotice, Input, Labeled, Loading, Segmented, SuccessNotice, Textarea } from '#/components/ui';
import { cx } from '#/lib/cx';

const MAINTENANCE_MINUTES = [
    { value: '0', label: 'Now' },
    { value: '5', label: '5 min' },
    { value: '10', label: '10 min' },
    { value: '30', label: '30 min' },
];

const SHUTDOWN_MINUTES = [
    { value: '1', label: '1 min' },
    { value: '5', label: '5 min' },
    { value: '10', label: '10 min' },
    { value: '30', label: '30 min' },
];

type Control = 'alert' | 'maintenance' | 'shutdown' | 'restart' | 'welcome';

type Tone = 'neutral' | 'warn' | 'bad';

const STATE_TONES: Record<Tone, string> = { neutral: 'text-muted', warn: 'text-warn', bad: 'text-bad' };

/** A time of day as the controls show it: hours and minutes. */
const clock = (utc: string) => new Date(utc).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/**
 * One of the controls, as a tile: its icon, its name and how it stands now (maintenance at
 * 12:30, the welcome message off). Picking it opens its form under the tiles.
 */
const ControlTile = ({ icon, label, state, tone = 'neutral', chosen, controls, onChoose }: {
    icon: ReactNode;
    label: string;
    state: string;
    tone?: Tone;
    chosen: boolean;
    controls: string;
    onChoose: () => void;
}) => (
    <button
        type="button"
        onClick={onChoose}
        aria-expanded={chosen}
        aria-controls={controls}
        className={cx(
            'flex min-h-[4.25rem] min-w-0 flex-col items-start gap-2 rounded-xl border px-3 py-2.5 text-left transition-colors active:scale-[0.99] @xs:flex-row @xs:items-center @xs:gap-3 [&>svg]:size-5 [&>svg]:shrink-0',
            chosen ? 'border-accent/60 bg-accent-soft [&>svg]:text-accent' : 'border-line bg-surface hover:border-muted/50 [&>svg]:text-muted',
        )}
    >
        {icon}
        <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{label}</span>
            <span className={cx('block truncate text-xs', STATE_TONES[tone])}>{state}</span>
        </span>
    </button>
);

/**
 * The message every player is shown when they log in. Saved for every login from now on; saving
 * it empty turns it off.
 */
const WelcomeMessageEditor = ({ saved }: { saved: WelcomeMessage }) => {
    const queryClient = useQueryClient();
    const [ draft, setDraft ] = useState(saved.message);

    const save = useMutation({
        mutationFn: (message: string) => saveWelcomeMessage(message),
        onSuccess: (data) => {
            queryClient.setQueryData([ 'welcome-message' ], data);
            setDraft(data.message);
        },
    });

    const changed = draft.trim() !== saved.message;

    return (
        <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
                event.preventDefault();
                save.mutate(draft);
            }}
        >
            <p className="text-xs text-muted">Shown to every player when they log in, as the message of the day. Leave it empty and none is shown.</p>
            <Textarea
                value={draft}
                onChange={event => setDraft(event.target.value)}
                rows={4}
                maxLength={saved.maxLength}
                placeholder="No welcome message"
                aria-label="Welcome message"
            />
            <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" variant="secondary" icon={<MessageSquareText />} disabled={save.isPending || !changed} className="max-sm:flex-1">
                    {draft.trim() === '' ? 'Turn off' : 'Save'}
                </Button>
                <span className="text-xs text-muted tabular-nums">{draft.length} / {saved.maxLength}</span>
            </div>
            {save.error && <ErrorNotice error={save.error} />}
            {save.isSuccess && !changed && <SuccessNotice>{saved.message === '' ? 'No welcome message is shown now.' : 'Saved. Players see it at their next login.'}</SuccessNotice>}
        </form>
    );
};

const WelcomeMessageForm = () => {
    const { data, error } = useWelcomeMessage();

    if (error)
        return <ErrorNotice error={error} />;

    return data ? <WelcomeMessageEditor saved={data} /> : <Loading />;
};

/**
 * The whole hotel's controls: a pop-up for everyone online, maintenance, shutdown and restart,
 * each with its countdown and a way to call it off, and the welcome message shown at login. They are tiles
 * that say how each stands, in a grid that fits a phone's sheet as well as the dashboard (a tile
 * puts its icon over its words when the grid is narrow); the one
 * picked opens under them. A countdown running opens on its own control. Each action is the
 * hotel's own command, run as you: its node, its confirmation and the command log, as typed in
 * game; a restart is the server's own (RestartServer). Only what you may do is shown.
 */
export const HotelControls = ({ phase, atUtc = null }: { phase: AvailabilityPhase; atUtc?: string | null }) => {
    const { data: can } = useHotelAbilities();
    const welcome = useWelcomeMessage(!!can?.welcomeMessage);
    const { data: restart } = useServerRestart();
    const queryClient = useQueryClient();
    const formId = useId();
    const [ alert, setAlert ] = useState('');
    const [ maintenanceIn, setMaintenanceIn ] = useState('10');
    const [ shutdownIn, setShutdownIn ] = useState('5');
    // Each countdown keeps its own reason, so one typed for maintenance is not sent with a shutdown.
    const [ maintenanceReason, setMaintenanceReason ] = useState('');
    const [ shutdownReason, setShutdownReason ] = useState('');
    const [ picked, setPicked ] = useState<Control | null>(null);

    const act = useMutation({
        mutationFn: (run: () => Promise<RunCommandResponse>) => run(),
        onSettled: () => void queryClient.invalidateQueries({ queryKey: [ 'dashboard' ] }),
    });

    const canRestart = !!restart?.canRestart;

    if (!can || (!can.alert && !can.maintenance && !can.shutdown && !can.welcomeMessage && !canRestart))
        return null;

    const run = (request: HotelActionRequest, question?: Question, then?: () => void) => {
        const go = () => {
            act.mutate(() => actOnHotel(request));
            then?.();
        };

        if (question)
            ask(question, go);
        else
            go();
    };

    const confirmPending = () => act.mutate(() => post<RunCommandResponse>('/commands/run', { line: 'confirm' }));
    const inMaintenance = phase === 'MaintenanceScheduled' || phase === 'Maintenance';
    const restarting = !!restart && (restart.scheduled || restart.restarting);
    // A restart is a shutdown the host starts again: it shows on its own control.
    const shuttingDown = !restarting && (phase === 'ShutdownScheduled' || phase === 'ShuttingDown');
    const at = atUtc ? ` at ${clock(atUtc)}` : '';
    const controls: Control[] = [
        ...(can.alert ? [ 'alert' as const ] : []),
        ...(can.maintenance ? [ 'maintenance' as const ] : []),
        ...(can.shutdown ? [ 'shutdown' as const ] : []),
        ...(canRestart ? [ 'restart' as const ] : []),
        ...(can.welcomeMessage ? [ 'welcome' as const ] : []),
    ];
    // What a running countdown is about opens first; otherwise the first control.
    const running: Control | null = restarting && canRestart ? 'restart' : shuttingDown && can.shutdown ? 'shutdown' : inMaintenance && can.maintenance ? 'maintenance' : null;
    const chosen = picked && controls.includes(picked) ? picked : running ?? controls[0]!;
    const welcomeText = welcome.data?.message ?? '';

    const tiles: Record<Control, ReactNode> = {
        alert: <ControlTile icon={<Megaphone />} label="Hotel alert" state="A pop-up for everyone" chosen={chosen === 'alert'} controls={formId} onChoose={() => setPicked('alert')} />,
        maintenance: (
            <ControlTile
                icon={<Wrench />}
                label="Maintenance"
                state={phase === 'Maintenance' ? 'On now' : phase === 'MaintenanceScheduled' ? `Starts${at}` : 'Not scheduled'}
                tone={inMaintenance ? 'warn' : 'neutral'}
                chosen={chosen === 'maintenance'}
                controls={formId}
                onChoose={() => setPicked('maintenance')}
            />
        ),
        shutdown: (
            <ControlTile
                icon={<Power />}
                label="Shutdown"
                state={!shuttingDown ? 'Not scheduled' : phase === 'ShuttingDown' ? 'Shutting down' : `Shuts down${at}`}
                tone={shuttingDown ? 'bad' : 'neutral'}
                chosen={chosen === 'shutdown'}
                controls={formId}
                onChoose={() => setPicked('shutdown')}
            />
        ),
        restart: (
            <ControlTile
                icon={<RotateCw />}
                label="Restart"
                state={restartState(restart) ?? 'Not scheduled'}
                tone={restarting ? 'bad' : 'neutral'}
                chosen={chosen === 'restart'}
                controls={formId}
                onChoose={() => setPicked('restart')}
            />
        ),
        welcome: (
            <ControlTile
                icon={<MessageSquareText />}
                label="Welcome message"
                state={welcome.data ? (welcomeText === '' ? 'Off' : welcomeText) : '…'}
                chosen={chosen === 'welcome'}
                controls={formId}
                onChoose={() => setPicked('welcome')}
            />
        ),
    };

    const forms: Record<Control, ReactNode> = {
        alert: (
            <form
                className="flex flex-col gap-3"
                onSubmit={(event) => {
                    event.preventDefault();
                    run({ action: 'alert', message: alert.trim() }, { title: 'Send this to everyone online?', confirm: 'Send' }, () => setAlert(''));
                }}
            >
                <Textarea value={alert} onChange={event => setAlert(event.target.value)} rows={3} placeholder="What everyone online should read" aria-label="Hotel alert" />
                <Button type="submit" icon={<Megaphone />} disabled={act.isPending || alert.trim() === ''} className="sm:self-start">Send to everyone</Button>
            </form>
        ),
        maintenance: (
            <div className="flex flex-col gap-3">
                <p className="text-xs text-muted">Players are reminded as it runs out, then everyone without the bypass is sent home and kept out until it ends.</p>
                <Labeled label="Start">
                    <Segmented label="Start maintenance in" value={maintenanceIn} onChange={setMaintenanceIn} options={MAINTENANCE_MINUTES} />
                </Labeled>
                <Labeled label="Reason (optional)">
                    <Input value={maintenanceReason} onChange={event => setMaintenanceReason(event.target.value)} placeholder="Shown to players" />
                </Labeled>
                <div className="flex flex-wrap gap-2 max-sm:flex-col">
                    <Button
                        variant="danger"
                        icon={<Wrench />}
                        disabled={act.isPending || shuttingDown}
                        onClick={() => run({ action: 'maintenance', minutes: Number(maintenanceIn), message: maintenanceReason.trim() || undefined }, {
                            title: maintenanceIn === '0' ? 'Start maintenance now?' : `Start maintenance in ${maintenanceIn} min?`,
                            body: maintenanceIn === '0'
                                ? 'Everyone without the bypass is sent home now and kept out until it ends.'
                                : `Everyone without the bypass is sent home in ${maintenanceIn} min and kept out until it ends.`,
                            confirm: 'Start maintenance',
                            danger: true,
                        })}
                    >
                        {maintenanceIn === '0' ? 'Start maintenance now' : `Start in ${maintenanceIn} min`}
                    </Button>
                    {inMaintenance && <Button variant="secondary" disabled={act.isPending} onClick={() => run({ action: 'maintenance-off' })}>End maintenance</Button>}
                </div>
                {shuttingDown && <p className="text-xs text-muted">A shutdown is under way, so maintenance can't be started.</p>}
            </div>
        ),
        shutdown: (
            <div className="flex flex-col gap-3">
                <p className="text-xs text-muted">Players are reminded as it runs out, then sent home, and the server stops so everything is saved. It does not start again by itself.</p>
                <Labeled label="Shut down in">
                    <Segmented label="Shut down in" value={shutdownIn} onChange={setShutdownIn} options={SHUTDOWN_MINUTES} />
                </Labeled>
                <Labeled label="Reason (optional)">
                    <Input value={shutdownReason} onChange={event => setShutdownReason(event.target.value)} placeholder="Shown to players" />
                </Labeled>
                <div className="flex flex-wrap gap-2 max-sm:flex-col">
                    <Button
                        variant="danger"
                        icon={<Power />}
                        disabled={act.isPending}
                        onClick={() => run({ action: 'shutdown', minutes: Number(shutdownIn), message: shutdownReason.trim() || undefined }, {
                            title: `Shut the hotel down in ${shutdownIn} min?`,
                            body: 'Everyone is sent home, and the server stops. It does not start again by itself.',
                            confirm: 'Shut down',
                        })}
                    >
                        {`Shut down in ${shutdownIn} min`}
                    </Button>
                    {phase === 'ShutdownScheduled' && !restarting && <Button variant="secondary" disabled={act.isPending} onClick={() => run({ action: 'shutdown-cancel' })}>Call it off</Button>}
                </div>
            </div>
        ),
        restart: <RestartServer />,
        welcome: <WelcomeMessageForm />,
    };

    return (
        <section aria-label="Hotel controls" className="@container flex flex-col gap-3">
            {controls.length > 1 && (
                <div className="grid grid-cols-2 gap-2">
                    {controls.map(control => <div key={control} className="grid">{tiles[control]}</div>)}
                </div>
            )}
            <div id={formId} className="rounded-xl border border-line bg-surface p-4">
                {forms[chosen]}
            </div>
            {act.error && <ErrorNotice error={act.error} />}
            {act.data && <CommandAnswer response={act.data} onConfirm={confirmPending} busy={act.isPending} />}
        </section>
    );
};

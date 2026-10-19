import { Gavel, MessageSquareWarning, MicOff, Repeat2, Unplug } from 'lucide-react';
import { type FormEvent, type ReactNode, useState } from 'react';

import { type PlayerDetailResponse, type PlayerRestriction, usePlayerAbilities } from '#/api/players';
import { Sheet } from '#/components/Sheet';
import { Badge, Button, Input, Label, Labeled, Segmented, Textarea } from '#/components/ui';
import { formatDateTime } from '#/pages/rooms/labels';

import { ActionAnswer } from './ActionAnswer';
import { type PlayerAction, usePlayerAction } from './usePlayerAction';

const BAN_DURATIONS = [
    { value: '1h', label: '1 hour' },
    { value: '1d', label: '1 day' },
    { value: '7d', label: '7 days' },
    { value: 'perm', label: 'For good' },
];

const MUTE_DURATIONS = [
    { value: '10m', label: '10 min' },
    { value: '1h', label: '1 hour' },
    { value: '1d', label: '1 day' },
    { value: '7d', label: '7 days' },
];

const TRADELOCK_DURATIONS = [
    { value: '1d', label: '1 day' },
    { value: '7d', label: '7 days' },
    { value: '30d', label: '30 days' },
    { value: 'perm', label: 'For good' },
];

type Open = 'alert' | 'sanction' | 'mute' | 'tradelock' | null;

/** One part of a sheet: what it is, and its controls. */
const Block = ({ title, children }: { title: string; children: ReactNode }) => (
    <div className="flex flex-col gap-2.5 border-t border-line px-3 py-3 first:border-t-0">
        <Label>{title}</Label>
        {children}
    </div>
);

/** What holds now, at the top of its sheet: "Muted until 18 Oct 14:00". */
const Holds = ({ what, restriction }: { what: string; restriction: PlayerRestriction }) => (
    <p className="rounded-lg border border-warn-line bg-warn-soft px-3 py-2 text-sm text-warn">
        {what} {restriction.untilUtc ? `until ${formatDateTime(restriction.untilUtc)}` : 'for good'}.
    </p>
);

/** A message for them: a moderator's warning or a plain pop-up. */
const AlertSheet = ({ player, action, open, onClose, warn, alert }: SheetProps & { warn: boolean; alert: boolean }) => {
    const [ message, setMessage ] = useState('');
    const [ kind, setKind ] = useState<'warn' | 'alert'>(warn ? 'warn' : 'alert');

    const send = (event: FormEvent) => {
        event.preventDefault();
        action.run({ action: kind, reason: message.trim() }, undefined, () => {
            setMessage('');
            onClose();
        });
    };

    return (
        <Sheet title={`Alert ${player.name}`} open={open} onClose={onClose}>
            <form onSubmit={send}>
                <Block title="Message">
                    {warn && alert && (
                        <Segmented
                            label="Kind of message"
                            value={kind}
                            onChange={value => setKind(value as 'warn' | 'alert')}
                            options={[ { value: 'warn', label: 'Moderator warning' }, { value: 'alert', label: 'Pop-up' } ]}
                        />
                    )}
                    <Textarea value={message} onChange={event => setMessage(event.target.value)} rows={4} placeholder={`What ${player.name} should read`} aria-label="Message" autoFocus />
                    <p className="text-xs text-muted">
                        {kind === 'warn' ? 'Shown as a message from the moderators, as the moderation tool sends one.' : 'Shown to them in a pop-up.'}
                    </p>
                    <Button type="submit" icon={<MessageSquareWarning />} disabled={action.busy || message.trim() === ''}>Send</Button>
                </Block>
            </form>
        </Sheet>
    );
};

/** Banning them from the hotel, or lifting the ban they have. */
const SanctionSheet = ({ player, action, open, onClose, ban, unban }: SheetProps & { ban: boolean; unban: boolean }) => {
    const [ duration, setDuration ] = useState('1d');
    const [ reason, setReason ] = useState('');
    const active = player.sanctions.find(x => x.isActive && x.kind === 'Ban');

    return (
        <Sheet title={`Sanction ${player.name}`} open={open} onClose={onClose}>
            {active && (
                <Block title="Banned now">
                    <Holds what="Banned" restriction={{ untilUtc: active.expiresUtc }} />
                    <p className="text-sm">{active.reason}</p>
                    {unban && (
                        <Button variant="secondary" disabled={action.busy} onClick={() => action.run({ action: 'unban' }, undefined, onClose)}>
                            Lift the ban
                        </Button>
                    )}
                </Block>
            )}
            {ban && (
                <Block title={active ? 'Ban again' : 'Ban from the hotel'}>
                    <Segmented label="How long to ban" value={duration} onChange={setDuration} options={BAN_DURATIONS} />
                    <Labeled label="Reason">
                        <Input value={reason} onChange={event => setReason(event.target.value)} placeholder="Shown to them, and kept with the ban" />
                    </Labeled>
                    <Button
                        variant="danger"
                        icon={<Gavel />}
                        disabled={action.busy}
                        onClick={() => action.run(
                            { action: 'ban', duration, reason: reason.trim() || undefined },
                            { title: `Ban ${player.name} from the hotel?`, body: player.isOnline ? 'They are disconnected at once.' : undefined, confirm: 'Ban' },
                            () => {
                                setReason('');
                                onClose();
                            },
                        )}
                    >
                        Ban {player.name}
                    </Button>
                </Block>
            )}
            {!active && !ban && <p className="px-3 py-3 text-sm text-muted">Not banned.</p>}
        </Sheet>
    );
};

/** A silence or a trade lock: for how long, or lifting the one that holds. */
const RestrictionSheet = ({ action, open, onClose, title, holds, restriction, durations, initial, start, startLabel, end, endLabel, icon }: Omit<SheetProps, 'player'> & {
    title: string;
    holds: string;
    restriction: PlayerRestriction | null;
    durations: { value: string; label: string }[];
    initial: string;
    start: 'silence' | 'tradelock';
    startLabel: string;
    end: 'unsilence' | 'untradelock';
    endLabel: string;
    icon: ReactNode;
}) => {
    const [ duration, setDuration ] = useState(initial);

    return (
        <Sheet title={title} open={open} onClose={onClose}>
            {restriction && (
                <Block title="Now">
                    <Holds what={holds} restriction={restriction} />
                    <Button variant="secondary" disabled={action.busy} onClick={() => action.run({ action: end }, undefined, onClose)}>{endLabel}</Button>
                </Block>
            )}
            <Block title={restriction ? 'Change how long' : 'How long'}>
                <Segmented label="How long" value={duration} onChange={setDuration} options={durations} />
                <Button icon={icon} disabled={action.busy} onClick={() => action.run({ action: start, duration }, undefined, onClose)}>{startLabel}</Button>
            </Block>
        </Sheet>
    );
};

interface SheetProps {
    player: PlayerDetailResponse;
    action: PlayerAction;
    open: boolean;
    onClose: () => void;
}

/** A button of the actions row; marked when what it does already holds ("Muted"). */
const ActionButton = ({ icon, label, holds, onClick, disabled, danger }: { icon: ReactNode; label: string; holds?: string; onClick: () => void; disabled?: boolean; danger?: boolean }) => (
    <Button variant={danger ? 'danger' : 'secondary'} icon={icon} onClick={onClick} disabled={disabled} className="max-sm:flex-[1_1_9rem]">
        {label}
        {holds && <Badge tone="amber" className="ml-0.5 px-1 py-0 text-[10px]">{holds}</Badge>}
    </Button>
);

/**
 * What staff may do to a player, along the bottom of their card on every tab of their page:
 * alert them, sanction (ban) them, mute them and trade lock them, each in a sheet that also lifts
 * the one that holds, and disconnect them while they are online. Each is the hotel's own command,
 * run as the staff member, so the same permissions and the command log apply, and a player who
 * outranks them is refused by the command itself. Only what they may do is shown.
 */
export const PlayerActions = ({ player }: { player: PlayerDetailResponse }) => {
    const { data: can } = usePlayerAbilities();
    const action = usePlayerAction(player);
    const [ open, setOpen ] = useState<Open>(null);
    const close = () => setOpen(null);

    if (!can)
        return null;

    const banned = player.sanctions.find(x => x.isActive && x.kind === 'Ban');
    const shown = (can.warn || can.alert) || (can.ban || can.unban) || can.silence || can.tradelock || (can.disconnect && player.isOnline);

    if (!shown)
        return null;

    return (
        <div className="flex flex-col gap-3 border-t border-line bg-canvas/40 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
                <Label className="mr-1 max-sm:basis-full">Actions</Label>
                {(can.warn || can.alert) && <ActionButton icon={<MessageSquareWarning />} label="Alert" onClick={() => setOpen('alert')} />}
                {(can.ban || can.unban) && <ActionButton icon={<Gavel />} label="Sanction" holds={banned ? 'banned' : undefined} onClick={() => setOpen('sanction')} />}
                {can.silence && <ActionButton icon={<MicOff />} label="Mute" holds={player.silenced ? 'muted' : undefined} onClick={() => setOpen('mute')} />}
                {can.tradelock && <ActionButton icon={<Repeat2 />} label="Trade lock" holds={player.tradeLocked ? 'locked' : undefined} onClick={() => setOpen('tradelock')} />}
                {can.disconnect && player.isOnline && (
                    <ActionButton
                        danger
                        icon={<Unplug />}
                        label="Disconnect"
                        disabled={action.busy}
                        onClick={() => action.run({ action: 'disconnect' }, { title: `Close ${player.name}'s connection?`, confirm: 'Disconnect', danger: true })}
                    />
                )}
            </div>
            <ActionAnswer action={action} />

            <AlertSheet player={player} action={action} open={open === 'alert'} onClose={close} warn={can.warn} alert={can.alert} />
            <SanctionSheet player={player} action={action} open={open === 'sanction'} onClose={close} ban={can.ban} unban={can.unban} />
            <RestrictionSheet
                action={action}
                open={open === 'mute'}
                onClose={close}
                title={`Mute ${player.name}`}
                holds="Muted everywhere"
                restriction={player.silenced}
                durations={MUTE_DURATIONS}
                initial="1h"
                start="silence"
                startLabel="Mute"
                end="unsilence"
                endLabel="Unmute"
                icon={<MicOff />}
            />
            <RestrictionSheet
                action={action}
                open={open === 'tradelock'}
                onClose={close}
                title={`Trade lock ${player.name}`}
                holds="Trading locked"
                restriction={player.tradeLocked}
                durations={TRADELOCK_DURATIONS}
                initial="7d"
                start="tradelock"
                startLabel="Lock trading"
                end="untradelock"
                endLabel="Unlock trading"
                icon={<Repeat2 />}
            />
        </div>
    );
};

import { LogOut, Save } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';

import { useMe, useRoom } from '#/api/queries';
import { DANCES, type RoomBotItem, roomCalls, useRoomAction, useRoomBots } from '#/api/rooms';
import { ask } from '#/components/confirm';
import { Avatar, Button, EmptyState, ErrorNotice, Input, Labeled, Loading, PageBody, Panel, Select, Switch, Textarea } from '#/components/ui';
import { cx } from '#/lib/cx';

import { ActionOutcome, RoomHeader } from './RoomHeader';

/** One bot in the room: everything its owner's skills could set, saved through the room so those in it see it. */
const BotEditor = ({ roomId, bot, canManage, linked }: { roomId: number; bot: RoomBotItem; canManage: boolean; linked: boolean }) => {
    const [ draft, setDraft ] = useState(bot);
    const action = useRoomAction(roomId);
    const calls = roomCalls(roomId);
    const disabled = !canManage;
    const set = (change: Partial<RoomBotItem>) => setDraft(previous => ({ ...previous, ...change }));

    return (
        <Panel
            title={bot.name}
            description={<>Owned by {linked ? <Link to={`/players/${bot.ownerId}`} className="text-accent hover:underline">{bot.ownerName}</Link> : bot.ownerName}.</>}
            actions={canManage && (
                <Button
                    variant="ghost"
                    icon={<LogOut />}
                    disabled={action.isPending}
                    onClick={() => ask({ title: `Take ${bot.name} out of the room, back to ${bot.ownerName}'s inventory?`, confirm: 'Take out', danger: false }, () => action.mutate(() => calls.pickupBot(bot.id)))}
                >
                    Take out of the room
                </Button>
            )}
        >
            <form
                className="flex flex-col gap-3 p-4"
                onSubmit={(event) => {
                    event.preventDefault();

                    action.mutate(() => calls.saveBot(bot.id, {
                        name: draft.name,
                        motto: draft.motto,
                        figure: draft.figure,
                        gender: draft.gender,
                        chatText: draft.chatText,
                        autoChat: draft.autoChat,
                        chatDelaySeconds: draft.chatDelaySeconds,
                        mixSentences: draft.mixSentences,
                        freeRoam: draft.freeRoam,
                        dance: draft.dance,
                    }));
                }}
            >
                <div className="grid gap-3 sm:grid-cols-2">
                    <Labeled label="Name"><Input value={draft.name} onChange={event => set({ name: event.target.value })} disabled={disabled} /></Labeled>
                    <Labeled label="Motto"><Input value={draft.motto} onChange={event => set({ motto: event.target.value })} disabled={disabled} /></Labeled>
                    <Labeled label="Look" hint="A figure string, as a player's.">
                        <Input value={draft.figure} onChange={event => set({ figure: event.target.value })} className="font-mono text-xs" disabled={disabled} />
                    </Labeled>
                    <Labeled label="Gender">
                        <Select value={String(draft.gender)} onChange={event => set({ gender: Number(event.target.value) })} disabled={disabled}>
                            <option value="0">Male</option>
                            <option value="1">Female</option>
                        </Select>
                    </Labeled>
                </div>
                <Labeled label="What it says" hint="One line each. Not word-filtered: staff are trusted with it.">
                    <Textarea value={draft.chatText} onChange={event => set({ chatText: event.target.value })} rows={4} disabled={disabled} />
                </Labeled>
                <div className="grid gap-3 sm:grid-cols-3">
                    <Switch label="Speaks on its own" checked={draft.autoChat} onChange={autoChat => set({ autoChat })} disabled={disabled} />
                    <Switch label="Lines in any order" checked={draft.mixSentences} onChange={mixSentences => set({ mixSentences })} disabled={disabled} />
                    <Labeled label="Seconds between lines">
                        <Input value={draft.chatDelaySeconds} onChange={event => set({ chatDelaySeconds: Number(event.target.value.replace(/\D/g, '')) || 0 })} inputMode="numeric" disabled={disabled} />
                    </Labeled>
                    <Switch label="Walks about" checked={draft.freeRoam} onChange={freeRoam => set({ freeRoam })} disabled={disabled} />
                    <Labeled label="Dance">
                        <Select value={String(draft.dance)} onChange={event => set({ dance: Number(event.target.value) })} disabled={disabled}>
                            {Object.entries(DANCES).map(([ value, label ]) => <option key={value} value={value}>{label}</option>)}
                        </Select>
                    </Labeled>
                </div>
                {canManage && <div><Button type="submit" icon={<Save />} disabled={action.isPending || JSON.stringify(draft) === JSON.stringify(bot)}>Save</Button></div>}
                <ActionOutcome message={action.data?.message} error={action.error} />
            </form>
        </Panel>
    );
};

/**
 * The bots standing in a room, and each one's settings: set, or taken back to its owner's
 * inventory, by staff who may change the room's settings.
 */
export const RoomBotsPage = () => {
    const id = Number(useParams().id);
    const { data: room } = useRoom(id);
    const { data: bots, error, isPending } = useRoomBots(id);
    const [ open, setOpen ] = useState<number | null>(null);
    const linked = useMe().data?.canViewPlayers ?? false;
    const canManage = room?.can.manageBotsAndPets ?? false;
    const selected = bots?.find(x => x.id === open) ?? bots?.[0] ?? null;

    return (
        <>
            <RoomHeader id={id} room={room} tab="bots" />
            <PageBody>
                {isPending && <Loading />}
                {error && <ErrorNotice error={error} />}
                {bots && bots.length === 0 && <Panel><EmptyState>No bot stands in this room.</EmptyState></Panel>}
                {bots && selected && (
                    <div className="grid items-start gap-4 lg:grid-cols-[20rem_minmax(0,1fr)] lg:gap-5">
                        <Panel title={`Bots (${bots.length})`} className="overflow-clip">
                            <ul>
                                {bots.map(bot => (
                                    <li key={bot.id} className="border-t border-line first:border-t-0">
                                        <button type="button" onClick={() => setOpen(bot.id)} className={cx('flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left hover:bg-subtle', selected.id === bot.id && 'bg-accent-soft/50')}>
                                            <Avatar id={bot.id} name={bot.name} figure={bot.figure} />
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-sm font-medium">{bot.name}</span>
                                                <span className="block truncate text-xs text-muted">{bot.ownerName}</span>
                                            </span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </Panel>
                        {/* Keyed by what was saved, so the form starts again from it. */}
                        <BotEditor key={JSON.stringify(selected)} roomId={id} bot={selected} canManage={canManage} linked={linked} />
                    </div>
                )}
            </PageBody>
        </>
    );
};

import { LogOut, Save, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { type BotItem, DANCES, useBotAction, useBots } from '#/api/content';
import { ask } from '#/components/confirm';
import { Pagination } from '#/components/Pagination';
import { SearchInput } from '#/components/SearchInput';
import { Badge, Button, EmptyState, ErrorNotice, Input, Labeled, Loading, Panel, Select, SuccessNotice, Switch, Textarea } from '#/components/ui';
import { cx } from '#/lib/cx';
import { useDebounced } from '#/lib/debounce';

/**
 * One bot: standing in a room, everything its owner's skills could set, saved through the room so
 * those in it see it; in an inventory, only deleted.
 */
const BotEditor = ({ bot, canManage }: { bot: BotItem; canManage: boolean }) => {
    const [ draft, setDraft ] = useState(bot);
    const act = useBotAction();
    const placed = bot.roomId !== null;
    const disabled = !canManage || !placed;
    const set = (change: Partial<BotItem>) => setDraft(previous => ({ ...previous, ...change }));

    return (
        <Panel
            title={bot.name}
            description={<>Owned by <Link to={`/players/${bot.ownerId}`} className="text-accent hover:underline">{bot.ownerName}</Link>{placed ? <>, standing in <Link to={`/rooms/${bot.roomId}`} className="text-accent hover:underline">{bot.roomName}</Link>.</> : ', in their inventory: it can be set once it stands in a room.'}</>}
            actions={canManage && (placed
                ? <Button variant="ghost" icon={<LogOut />} disabled={act.isPending} onClick={() => ask({ title: `Take ${bot.name} out of ${bot.roomName}, back to ${bot.ownerName}'s inventory?`, confirm: 'Take out', danger: false }, () => act.mutate({ id: bot.id, pickup: true }))}>Take out of the room</Button>
                : <Button variant="ghost" icon={<Trash2 />} className="text-bad hover:text-bad" disabled={act.isPending} onClick={() => ask({ title: `Delete ${bot.name} from ${bot.ownerName}'s inventory?`, confirm: 'Delete' }, () => act.mutate({ id: bot.id, remove: true }))}>Delete</Button>)}
        >
            <form
                className="flex flex-col gap-3 p-4"
                onSubmit={(event) => {
                    event.preventDefault();

                    act.mutate({
                        id: bot.id,
                        edit: {
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
                        },
                    });
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
                {canManage && placed && <div><Button type="submit" icon={<Save />} disabled={act.isPending || JSON.stringify(draft) === JSON.stringify(bot)}>Save</Button></div>}
                {act.isSuccess && <SuccessNotice>Done.</SuccessNotice>}
                {act.error && <ErrorNotice error={act.error} />}
            </form>
        </Panel>
    );
};

/** The hotel's bots: found by name, owner, bot or room id, and set or taken out by staff. */
export const BotsTab = ({ canManage }: { canManage: boolean }) => {
    const [ text, setText ] = useState('');
    const [ page, setPage ] = useState(0);
    const [ open, setOpen ] = useState<number | null>(null);
    const { data, error, isFetching } = useBots(useDebounced(text.trim()), page);
    const size = data?.pageSize ?? 25;
    const selected = data?.bots.find(x => x.id === open) ?? null;

    return (
        <div className="grid items-start gap-4 lg:grid-cols-[24rem_minmax(0,1fr)]">
            <Panel className="overflow-clip">
                <div className="border-b border-line p-3">
                    <SearchInput
                        value={text}
                        onValueChange={(value) => {
                            setText(value);
                            setPage(0);
                        }}
                        placeholder="Name, owner, bot or room id"
                        aria-label="Find bots"
                    />
                </div>
                {error && <div className="p-4"><ErrorNotice error={error} /></div>}
                {!data && !error && <Loading />}
                {data && data.bots.length === 0 && <EmptyState>No bot found.</EmptyState>}
                <ul className={cx('divide-y divide-line transition-opacity', isFetching && 'opacity-60')}>
                    {data?.bots.map(bot => (
                        <li key={bot.id}>
                            <button type="button" onClick={() => setOpen(bot.id)} className={cx('flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-subtle', open === bot.id && 'bg-accent-soft/50')}>
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-medium">{bot.name}</span>
                                    <span className="block truncate text-xs text-muted">{bot.ownerName}{bot.roomName ? ` · ${bot.roomName}` : ''}</span>
                                </span>
                                {bot.roomId === null && <Badge>Inventory</Badge>}
                            </button>
                        </li>
                    ))}
                </ul>
                {data && data.total > size && <div className="border-t border-line p-2"><Pagination offset={page * size} limit={size} total={data.total} onChange={offset => setPage(Math.floor(offset / size))} /></div>}
            </Panel>
            {selected ? <BotEditor key={JSON.stringify(selected)} bot={selected} canManage={canManage} /> : <Panel><EmptyState>Choose a bot.</EmptyState></Panel>}
        </div>
    );
};

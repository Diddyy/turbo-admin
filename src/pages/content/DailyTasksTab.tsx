import { CalendarCheck, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { type DailyTask, type DailyTaskInput, useDailyTaskChange, useDailyTasks } from '#/api/quests';
import { ask } from '#/components/confirm';
import { toast, toastError } from '#/components/toast';
import { Badge, Button, EmptyState, ErrorNotice, IconButton, Input, Labeled, Loading, Panel, Select, Switch, WarningNotice } from '#/components/ui';
import { cx } from '#/lib/cx';
import { plural } from '#/lib/plural';

const TYPES: Record<string, string> = {
    explore: 'Explore: visit rooms other players own',
    find_furni: 'Find furni: use one of the furni named',
};

const BLANK: DailyTaskInput = {
    code: '',
    questType: 'explore',
    target: '',
    requiredRepeats: 3,
    imageVersion: '',
    catalogName: '',
    isBonus: false,
    enabled: true,
    rewardKind: 'points',
    rewardTypeId: '0',
    rewardAmount: 10,
};

/** What a task asks and gives, in a line. */
const summaryOf = (task: DailyTaskInput) => {
    const asks = task.questType === 'explore'
        ? `Visit ${plural(task.requiredRepeats, 'room')}`
        : `Use ${task.target || 'a furni'} ${plural(task.requiredRepeats, 'time')}`;
    const gives = task.rewardAmount === 0
        ? 'no reward'
        : task.rewardKind === 'badge' ? `the badge ${task.rewardTypeId}` : `${task.rewardAmount} ${task.rewardTypeId === '0' ? 'duckets' : `points ${task.rewardTypeId}`}`;

    return `${asks} · ${gives}`;
};

const DailyTaskForm = ({ start, busy, onSave, onCancel }: { start: DailyTaskInput; busy: boolean; onSave: (input: DailyTaskInput) => void; onCancel: () => void }) => {
    const [ draft, setDraft ] = useState(start);
    const set = (change: Partial<DailyTaskInput>) => setDraft({ ...draft, ...change });

    return (
        <form
            className="flex flex-col gap-3 border-t border-line bg-subtle/40 px-4 py-4"
            onSubmit={(event) => {
                event.preventDefault();
                onSave({ ...draft, code: draft.code.trim(), target: draft.target.trim() });
            }}
        >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Labeled label="Code" hint="Names the client's dailytask.<code> texts and image.">
                    <Input value={draft.code} onChange={event => set({ code: event.target.value })} maxLength={64} spellCheck={false} className="w-full font-mono" required />
                </Labeled>
                <Labeled label="What counts">
                    <Select value={draft.questType} onChange={event => set({ questType: event.target.value })} className="w-full">
                        {Object.entries(TYPES).map(([ value, label ]) => <option key={value} value={value}>{label}</option>)}
                    </Select>
                </Labeled>
                <Labeled label={draft.questType === 'explore' ? 'Rooms' : 'Times'}>
                    <Input type="number" min={1} value={draft.requiredRepeats} onChange={event => set({ requiredRepeats: Number(event.target.value) })} className="w-full font-mono" required />
                </Labeled>
                {draft.questType === 'find_furni' && (
                    <Labeled label="Furni to find" hint="Furni names (classnames), commas between." className="sm:col-span-2 lg:col-span-3">
                        <Input value={draft.target} onChange={event => set({ target: event.target.value })} maxLength={512} spellCheck={false} placeholder="bbq_grill, rubber_duck" className="w-full font-mono" />
                    </Labeled>
                )}
                <Labeled label="Reward">
                    <Select value={draft.rewardKind} onChange={event => set({ rewardKind: event.target.value as DailyTaskInput['rewardKind'], rewardTypeId: event.target.value === 'badge' ? '' : '0' })} className="w-full">
                        <option value="points">Points</option>
                        <option value="badge">A badge</option>
                    </Select>
                </Labeled>
                <Labeled label={draft.rewardKind === 'badge' ? 'Badge code' : 'Points number'} hint={draft.rewardKind === 'badge' ? undefined : '0 duckets, 5 diamonds.'}>
                    <Input value={draft.rewardTypeId} onChange={event => set({ rewardTypeId: event.target.value })} maxLength={64} spellCheck={false} className="w-full font-mono" />
                </Labeled>
                <Labeled label="Amount" hint="0 gives nothing.">
                    <Input type="number" min={0} value={draft.rewardAmount} onChange={event => set({ rewardAmount: Number(event.target.value) })} className="w-full font-mono" />
                </Labeled>
                <Labeled label="Image version">
                    <Input value={draft.imageVersion} onChange={event => set({ imageVersion: event.target.value })} maxLength={32} className="w-full font-mono" />
                </Labeled>
                <Labeled label="Catalog page" hint="Where the client's button goes.">
                    <Input value={draft.catalogName} onChange={event => set({ catalogName: event.target.value })} maxLength={64} className="w-full font-mono" />
                </Labeled>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
                <Switch label="On" hint="Off, it is never given; one that can't be given yet may be kept off." checked={draft.enabled} onChange={enabled => set({ enabled })} />
                <Switch label="Bonus" hint="Given once the day's other tasks are done." checked={draft.isBonus} onChange={isBonus => set({ isBonus })} />
            </div>
            <div className="flex flex-wrap gap-2 max-sm:flex-col-reverse">
                <Button variant="secondary" onClick={onCancel}>Cancel</Button>
                <Button type="submit" disabled={busy || draft.code.trim() === ''}>Save</Button>
            </div>
        </form>
    );
};

const DailyTaskRow = ({ task, canManage, editing, onEdit, onDone }: { task: DailyTask; canManage: boolean; editing: boolean; onEdit: () => void; onDone: () => void }) => {
    const { save, drop } = useDailyTaskChange();

    const store = (input: DailyTaskInput) => save.mutate({ id: task.id, input }, {
        onSuccess: () => {
            toast(`Saved ${input.code}. Players online get it with their next task.`);
            onDone();
        },
        onError: toastError,
    });

    return (
        <li>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                <span className={cx('grid size-10 shrink-0 place-items-center rounded-xl [&>svg]:size-5', task.enabled && !task.problem ? 'bg-accent-soft text-accent' : 'bg-subtle text-muted')}>
                    <CalendarCheck />
                </span>
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-medium">{task.code}</span>
                        {task.isBonus && <Badge tone="accent">bonus</Badge>}
                        {!task.enabled && <Badge>off</Badge>}
                        {task.enabled && task.problem && <Badge tone="red">skipped</Badge>}
                    </div>
                    <div className="truncate text-xs text-muted">{summaryOf(task)} · given to {plural(task.given, 'player')}</div>
                    {task.problem && <div className="text-xs text-warn">{task.problem}</div>}
                </div>
                {canManage && (
                    <div className="flex items-center gap-1">
                        <Switch label={<span className="sr-only">{task.enabled ? 'On' : 'Off'}</span>} checked={task.enabled} disabled={save.isPending} onChange={enabled => store({ ...task, enabled })} />
                        <IconButton label={`Edit ${task.code}`} icon={<Pencil />} onClick={onEdit} />
                        <IconButton
                            label={`Delete ${task.code}`}
                            icon={<Trash2 />}
                            tone="bad"
                            disabled={drop.isPending}
                            onClick={() => ask(
                                { title: `Delete the task ${task.code}?`, body: task.given > 0 ? `${plural(task.given, 'player')} had it: their tasks of it go too, unclaimed rewards with them. Turning it off keeps them.` : 'Nobody has had it.', confirm: 'Delete' },
                                () => drop.mutate(task.id, { onSuccess: () => toast(`Deleted ${task.code}.`), onError: toastError }),
                            )}
                        />
                    </div>
                )}
            </div>
            {editing && <DailyTaskForm start={task} busy={save.isPending} onSave={store} onCancel={onDone} />}
        </li>
    );
};

/**
 * The daily tasks: each day a player is given a few at random, and the bonus ones once those
 * are done. Each is checked as the hotel checks it before giving it; one it would skip is marked
 * with why, and can only be saved off. A change reaches players online with their next task.
 */
export const DailyTasksTab = () => {
    const { data, error } = useDailyTasks();
    const { save } = useDailyTaskChange();
    const [ editing, setEditing ] = useState<number | 'new' | null>(null);

    if (error) return <ErrorNotice error={error} />;
    if (!data) return <Loading />;

    const skipped = data.tasks.filter(x => x.enabled && x.problem).length;

    return (
        <>
            {skipped > 0 && <WarningNotice>{plural(skipped, 'task is', 'tasks are')} on but can't be given; the hotel skips {skipped === 1 ? 'it' : 'them'}. Each says why.</WarningNotice>}
            <Panel
                title="Daily tasks"
                description="A few given to each player every day, at random; the bonus ones once those are done."
                actions={data.canManage && editing !== 'new' && <Button icon={<Plus />} onClick={() => setEditing('new')}>Add task</Button>}
                className="overflow-clip"
            >
                {editing === 'new' && (
                    <DailyTaskForm
                        start={BLANK}
                        busy={save.isPending}
                        onSave={input => save.mutate({ id: null, input }, {
                            onSuccess: () => {
                                toast(`Added ${input.code}.`);
                                setEditing(null);
                            },
                            onError: toastError,
                        })}
                        onCancel={() => setEditing(null)}
                    />
                )}
                {data.tasks.length === 0
                    ? <EmptyState>No daily tasks.</EmptyState>
                    : (
                            <ul className="divide-y divide-line border-t border-line">
                                {data.tasks.map(task => (
                                    <DailyTaskRow
                                        key={task.id}
                                        task={task}
                                        canManage={data.canManage}
                                        editing={editing === task.id}
                                        onEdit={() => setEditing(editing === task.id ? null : task.id)}
                                        onDone={() => setEditing(null)}
                                    />
                                ))}
                            </ul>
                        )}
            </Panel>
        </>
    );
};

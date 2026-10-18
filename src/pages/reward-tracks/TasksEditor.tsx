import { ArrowDown, ArrowUp, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

import type { RewardTrack, RewardTrackLevel, RewardTrackTask } from '#/api/rewardTracks';
import { Badge, Button, Checkbox, EmptyState, IconButton, Input, Labeled, Panel, Select } from '#/components/ui';
import { cx } from '#/lib/cx';

import { blankTask, moved, nextId, taskPoints } from './model';

/** Habbo writes the types in capitals (`PET_RESPECT`); the server reads them either way. */
const typeOf = (type: string) => type.toUpperCase();

/** A task's levels: the count that reaches each, the points it gives, and whether premium needs it. */
const Levels = ({ levels, onChange }: { levels: RewardTrackLevel[]; onChange: (levels: RewardTrackLevel[]) => void }) => {
    const set = (index: number, level: RewardTrackLevel) => onChange(levels.map((x, i) => (i === index ? level : x)));

    return (
        <div className="flex flex-col gap-1.5">
            <div className="grid grid-cols-[3rem_1fr_1fr_6rem_2rem] gap-2 px-1 font-mono text-[10px] tracking-[0.08em] text-muted uppercase">
                <span>Level</span><span>Count</span><span>Points</span><span>Premium</span><span />
            </div>
            {levels.map((level, index) => (
                <div key={index} className="grid grid-cols-[3rem_1fr_1fr_6rem_2rem] items-center gap-2">
                    <span className="px-1 font-mono text-xs text-muted">{index + 1}</span>
                    <Input type="number" min={1} value={level.requiredCount} onChange={event => set(index, { ...level, requiredCount: Math.max(1, Math.floor(Number(event.target.value) || 1)) })} className="font-mono" aria-label={`Level ${index + 1} count`} />
                    <Input type="number" min={0} value={level.points} onChange={event => set(index, { ...level, points: Math.max(0, Math.floor(Number(event.target.value) || 0)) })} className="font-mono" aria-label={`Level ${index + 1} points`} />
                    <Checkbox label={<span className="sr-only">Premium</span>} checked={level.premium} onChange={value => set(index, { ...level, premium: value })} />
                    <IconButton label="Remove the level" icon={<Trash2 />} tone="bad" disabled={levels.length === 1} onClick={() => onChange(levels.filter((_, i) => i !== index))} />
                </div>
            ))}
            <Button
                variant="ghost"
                icon={<Plus />}
                className="self-start"
                onClick={() => {
                    const last = levels[levels.length - 1];

                    onChange([ ...levels, { requiredCount: (last?.requiredCount ?? 0) + Math.max(1, last?.requiredCount ?? 1), points: last?.points ?? 50, premium: false } ]);
                }}
            >
                Add a level
            </Button>
        </div>
    );
};

/** One task, folded to a line until opened. */
const TaskRow = ({ task, index, count, open, onOpen, actionTypes, onChange, onMove, onRemove }: {
    task: RewardTrackTask;
    index: number;
    count: number;
    open: boolean;
    onOpen: () => void;
    actionTypes: string[];
    onChange: (task: RewardTrackTask) => void;
    onMove: (by: -1 | 1) => void;
    onRemove: () => void;
}) => {
    const counted = actionTypes.some(x => x.toLowerCase() === task.actionType.toLowerCase());
    const types = counted ? actionTypes : [ ...actionTypes, task.actionType ];

    return (
        <li className="border-t border-line first:border-t-0">
            <div className="flex items-center gap-2 px-3 py-2">
                <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-2 text-left" aria-expanded={open}>
                    <ChevronRight className={cx('size-4 shrink-0 text-muted transition', open && 'rotate-90')} />
                    <span className="min-w-0 truncate font-mono text-sm">{task.id}</span>
                    <span className="truncate font-mono text-[11px] text-muted">{typeOf(task.actionType)}</span>
                    {!counted && <Badge tone="amber">not counted</Badge>}
                    {task.premium && <Badge tone="accent">premium</Badge>}
                </button>
                <span className="font-mono text-xs text-muted tabular-nums">{task.levels.length} {task.levels.length === 1 ? 'level' : 'levels'} · {taskPoints(task).toLocaleString()} pts</span>
                <IconButton label="Move up" icon={<ArrowUp />} disabled={index === 0} onClick={() => onMove(-1)} />
                <IconButton label="Move down" icon={<ArrowDown />} disabled={index === count - 1} onClick={() => onMove(1)} />
                <IconButton label={`Remove ${task.id}`} icon={<Trash2 />} tone="bad" onClick={onRemove} />
            </div>
            {open && (
                <div className="grid gap-4 border-t border-line bg-subtle/40 px-4 py-4 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
                    <div className="flex flex-col gap-3">
                        <Labeled label="Id" hint={<>Its texts: <span className="font-mono">reward_track.&lt;track&gt;.task.{task.id || '…'}.name</span>, .desc, .hint.desc</>}>
                            <Input value={task.id} onChange={event => onChange({ ...task, id: event.target.value.trim() })} className="font-mono" maxLength={64} aria-label="Task id" spellCheck={false} />
                        </Labeled>
                        <Labeled label="What counts" hint={task.actionType.toLowerCase() === 'custom_wired_action' ? 'Only a wired Progress Reward Track box naming this task moves it.' : counted ? 'Counted by the server.' : 'The server does not count this type: the task never moves.'}>
                            <Select value={types.find(x => x.toLowerCase() === task.actionType.toLowerCase())} onChange={event => onChange({ ...task, actionType: typeOf(event.target.value) })} className="font-mono" aria-label="Action type">
                                {types.map(x => <option key={x} value={x}>{typeOf(x)}</option>)}
                            </Select>
                        </Labeled>
                        <Labeled label="Parameter" hint="Sent to the client with the task; Habbo's are all empty.">
                            <Input value={task.parameter} onChange={event => onChange({ ...task, parameter: event.target.value })} className="font-mono" aria-label="Task parameter" />
                        </Labeled>
                        <Checkbox label="Premium only" hint="Counts only for a player who bought premium." checked={task.premium} onChange={value => onChange({ ...task, premium: value })} />
                    </div>
                    <Levels levels={task.levels} onChange={levels => onChange({ ...task, levels })} />
                </div>
            )}
        </li>
    );
};

/** The track's tasks in the order the client lists them, each with its levels. */
export const TasksEditor = ({ track, actionTypes, onChange }: { track: RewardTrack; actionTypes: string[]; onChange: (track: RewardTrack) => void }) => {
    const [ open, setOpen ] = useState<number | null>(null);
    const setTasks = (tasks: RewardTrackTask[]) => onChange({ ...track, tasks });

    return (
        <Panel
            title="Tasks"
            description="Each level reached gives its points; a task stops at its last level. The client's icon is reward_track_tasks_<track>_<task>, else the action type's."
            actions={(
                <Button
                    icon={<Plus />}
                    onClick={() => {
                        setTasks([ ...track.tasks, blankTask(nextId('task', track.tasks), typeOf(actionTypes[0] ?? 'wave')) ]);
                        setOpen(track.tasks.length);
                    }}
                >
                    Add a task
                </Button>
            )}
        >
            {track.tasks.length === 0
                ? <EmptyState>No tasks: nothing earns points on this track.</EmptyState>
                : (
                        <ul>
                            {track.tasks.map((task, index) => (
                                <TaskRow
                                    key={index}
                                    task={task}
                                    index={index}
                                    count={track.tasks.length}
                                    open={open === index}
                                    onOpen={() => setOpen(open === index ? null : index)}
                                    actionTypes={actionTypes}
                                    onChange={next => setTasks(track.tasks.map((x, i) => (i === index ? next : x)))}
                                    onMove={(by) => {
                                        setTasks(moved(track.tasks, index, by));
                                        if (open === index) setOpen(index + by);
                                    }}
                                    onRemove={() => {
                                        setTasks(track.tasks.filter((_, i) => i !== index));
                                        setOpen(null);
                                    }}
                                />
                            ))}
                        </ul>
                    )}
        </Panel>
    );
};

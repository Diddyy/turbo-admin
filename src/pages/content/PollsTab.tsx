import { ArrowDown, ArrowUp, ChevronLeft, Plus, Trash2, Vote, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { type PollDetail, type PollInput, type PollQuestion, type PollQuestionResult, type PollQuestionType, usePoll, usePollChange, usePolls } from '#/api/polls';
import { ask } from '#/components/confirm';
import { toast, toastError } from '#/components/toast';
import { Badge, Button, EmptyState, ErrorNotice, IconButton, Input, Labeled, Loading, Panel, Select, Switch, Textarea } from '#/components/ui';
import { cx } from '#/lib/cx';
import { plural } from '#/lib/plural';

const TYPES: { value: PollQuestionType; label: string }[] = [
    { value: 'single', label: 'One choice' },
    { value: 'multiple', label: 'Several choices' },
    { value: 'line', label: 'A line of text' },
    { value: 'area', label: 'Text' },
];

const choosing = (type: PollQuestionType) => type === 'single' || type === 'multiple';

const blankQuestion = (sortOrder: number): PollQuestion => ({
    id: null,
    parent: null,
    sortOrder,
    type: 'single',
    text: '',
    category: 0,
    answerType: 0,
    choices: [ { id: null, value: '1', text: '', choiceType: 0 }, { id: null, value: '2', text: '', choiceType: 0 } ],
});

const BLANK: PollInput = { roomId: 0, type: '', headline: '', summary: '', startMessage: '', endMessage: '', npsPoll: false, enabled: true, questions: [ blankQuestion(0) ] };

/** One question's answers: a bar per choice (named as it shows), or the newest texts. */
const Result = ({ result, question }: { result: PollQuestionResult | undefined; question: PollQuestion }) => {
    if (!result)
        return <p className="text-xs text-muted">Not answered yet: save to start counting.</p>;

    const most = Math.max(1, ...result.choices.map(x => x.count));

    return (
        <div className="flex flex-col gap-1.5 text-[13px]">
            <span className="text-xs text-muted">{plural(result.answered, 'answer')}</span>
            {result.choices.map(choice => (
                <div key={choice.value} className="grid grid-cols-[minmax(0,6rem)_minmax(0,1fr)_3rem] items-center gap-2">
                    <span className="truncate text-xs" title={choice.value}>{question.choices.find(x => x.value === choice.value)?.text || choice.value}</span>
                    <span className="h-2 overflow-hidden rounded-full bg-subtle"><span className="block h-full rounded-full bg-accent" style={{ width: `${(choice.count / most) * 100}%` }} /></span>
                    <span className="text-right font-mono text-xs tabular-nums">{choice.count}</span>
                </div>
            ))}
            {result.texts.map((text, i) => (
                <p key={i} className="rounded-md bg-canvas px-2 py-1.5 wrap-anywhere">
                    {text.text}
                    <Link to={`/players/${text.playerId}`} className="ml-2 text-xs text-muted hover:text-accent">{text.playerName ?? `#${text.playerId}`}</Link>
                </p>
            ))}
        </div>
    );
};

const QuestionCard = ({ index, question, questions, npsPoll, result, onChange, onRemove, onMove }: {
    index: number;
    question: PollQuestion;
    questions: PollQuestion[];
    npsPoll: boolean;
    result: PollQuestionResult | undefined;
    onChange: (question: PollQuestion) => void;
    onRemove: () => void;
    onMove: (by: -1 | 1) => void;
}) => {
    const set = (change: Partial<PollQuestion>) => onChange({ ...question, ...change });

    return (
        <li className="grid gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="flex min-w-0 flex-col gap-3">
                <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted">{index + 1}</span>
                    <Input value={question.text} onChange={event => set({ text: event.target.value })} placeholder="The question" aria-label={`Question ${index + 1}`} className="min-w-0 flex-1" required />
                    <IconButton label="Up" icon={<ArrowUp />} small disabled={index === 0} onClick={() => onMove(-1)} />
                    <IconButton label="Down" icon={<ArrowDown />} small disabled={index === questions.length - 1} onClick={() => onMove(1)} />
                    <IconButton label={`Remove question ${index + 1}`} icon={<Trash2 />} tone="bad" small onClick={onRemove} />
                </div>
                <div className="flex flex-wrap gap-3">
                    <Select value={question.type} onChange={event => set({ type: event.target.value as PollQuestionType, choices: choosing(event.target.value as PollQuestionType) ? (question.choices.length > 0 ? question.choices : blankQuestion(0).choices) : [] })} aria-label="Answered with" className="w-44">
                        {TYPES.map(x => <option key={x.value} value={x.value}>{x.label}</option>)}
                    </Select>
                    {npsPoll && (
                        <>
                            <Select value={question.parent ?? ''} onChange={event => set({ parent: event.target.value === '' ? null : Number(event.target.value) })} aria-label="Follows up" className="w-48">
                                <option value="">A question of its own</option>
                                {questions.map((other, i) => (i !== index && other.parent === null ? <option key={i} value={i}>Follows up {i + 1}</option> : null))}
                            </Select>
                            <Labeled label="Category" className="w-28">
                                <Input type="number" value={question.category} onChange={event => set({ category: Number(event.target.value) })} className="w-full font-mono" />
                            </Labeled>
                        </>
                    )}
                </div>
                {choosing(question.type) && (
                    <ul className="flex flex-col gap-1.5">
                        {question.choices.map((choice, i) => (
                            <li key={i} className="flex items-center gap-2">
                                <Input value={choice.value} onChange={event => set({ choices: question.choices.map((x, j) => (j === i ? { ...x, value: event.target.value } : x)) })} aria-label="Value" placeholder="value" className="w-20 font-mono" />
                                <Input value={choice.text} onChange={event => set({ choices: question.choices.map((x, j) => (j === i ? { ...x, text: event.target.value } : x)) })} aria-label="What it shows" placeholder="What it shows" className="min-w-0 flex-1" />
                                {npsPoll && <Input type="number" value={choice.choiceType} onChange={event => set({ choices: question.choices.map((x, j) => (j === i ? { ...x, choiceType: Number(event.target.value) } : x)) })} aria-label="Follow-up category" title="The category of follow-up it leads to" className="w-16 font-mono" />}
                                <IconButton label="Remove choice" icon={<X />} small disabled={question.choices.length <= 2} onClick={() => set({ choices: question.choices.filter((_, j) => j !== i) })} />
                            </li>
                        ))}
                        <li>
                            <Button variant="ghost" icon={<Plus />} onClick={() => set({ choices: [ ...question.choices, { id: null, value: String(question.choices.length + 1), text: '', choiceType: 0 } ] })}>Add choice</Button>
                        </li>
                    </ul>
                )}
            </div>
            <div className="min-w-0 self-start rounded-lg border border-line px-3 py-2.5">
                <Result result={result} question={question} />
            </div>
        </li>
    );
};

const PollEditor = ({ start, id, canManage, onClose }: { start: PollInput | PollDetail; id: number | null; canManage: boolean; onClose: () => void }) => {
    const [ draft, setDraft ] = useState<PollInput>(start);
    const { save, drop } = usePollChange();
    const detail = id !== null ? (start as PollDetail) : null;
    const set = (change: Partial<PollInput>) => setDraft({ ...draft, ...change });

    const setQuestion = (index: number, question: PollQuestion) => set({ questions: draft.questions.map((x, i) => (i === index ? question : x)) });

    // Questions name their parent by index, so a move or a removal renumbers them.
    const reorder = (order: number[]) => {
        const at = new Map(order.map((from, to) => [ from, to ]));

        set({
            questions: order.map((from, to) => {
                const question = draft.questions[from]!;
                const parent = question.parent === null ? null : at.get(question.parent) ?? null;

                return { ...question, sortOrder: to, parent };
            }),
        });
    };

    const move = (index: number, by: -1 | 1) => {
        const order = draft.questions.map((_, i) => i);

        [ order[index], order[index + by] ] = [ order[index + by]!, order[index]! ];
        reorder(order);
    };

    const removeAt = (index: number) => {
        const question = draft.questions[index]!;
        const lose = question.id !== null && (detail?.results.find(x => x.questionId === question.id)?.answered ?? 0) > 0;
        const go = () => reorder(draft.questions.map((_, i) => i).filter(i => i !== index));

        if (lose)
            ask({ title: `Remove question ${index + 1}?`, body: 'Its answers go when you save.', confirm: 'Remove' }, go);
        else
            go();
    };

    const store = () => save.mutate({ id, input: draft }, {
        onSuccess: () => {
            toast(id === null ? 'Added the poll. Players entering the room are offered it.' : 'Saved the poll.');
            onClose();
        },
        onError: toastError,
    });

    return (
        <Panel
            title={id === null ? 'New poll' : draft.headline || 'Poll'}
            description={detail ? `${detail.roomName ?? `Room ${detail.roomId}`} · ${detail.finished} finished, ${detail.started} started, ${detail.rejected} said no` : 'Offered to everyone who enters the room until they finish it or say no.'}
            actions={<Button variant="ghost" icon={<ChevronLeft />} onClick={onClose}>All polls</Button>}
            className="overflow-clip"
        >
            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    store();
                }}
            >
                <fieldset disabled={!canManage} className="flex flex-col gap-3 border-t border-line px-4 py-4">
                    <div className="grid gap-3 sm:grid-cols-[8rem_minmax(0,1fr)]">
                        <Labeled label="Room id">
                            <Input value={draft.roomId || ''} onChange={event => set({ roomId: Number(event.target.value.replace(/\D/g, '')) })} inputMode="numeric" className="w-full font-mono" required />
                        </Labeled>
                        <Labeled label="Headline" hint="The offer's title.">
                            <Input value={draft.headline} onChange={event => set({ headline: event.target.value })} className="w-full" required />
                        </Labeled>
                    </div>
                    <Labeled label="Summary" hint="The offer's text, under the headline.">
                        <Textarea rows={2} value={draft.summary} onChange={event => set({ summary: event.target.value })} required />
                    </Labeled>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <Labeled label="Start message" hint="Shown above the first question.">
                            <Input value={draft.startMessage} onChange={event => set({ startMessage: event.target.value })} className="w-full" />
                        </Labeled>
                        <Labeled label="End message" hint="Shown once it is done.">
                            <Input value={draft.endMessage} onChange={event => set({ endMessage: event.target.value })} className="w-full" />
                        </Labeled>
                    </div>
                    <div className="flex flex-wrap gap-x-6 gap-y-2">
                        <Switch label="On" hint="Off, it isn't offered." checked={draft.enabled} onChange={enabled => set({ enabled })} />
                        <Switch label="Score poll" hint="A choice decides which follow-up comes next." checked={draft.npsPoll} onChange={npsPoll => set({ npsPoll, questions: npsPoll ? draft.questions : draft.questions.map(x => ({ ...x, parent: null })) })} />
                    </div>
                </fieldset>
                <fieldset disabled={!canManage}>
                    <ul className="divide-y divide-line border-t border-line">
                        {draft.questions.map((question, index) => (
                            <QuestionCard
                                key={question.id ?? `new-${index}`}
                                index={index}
                                question={question}
                                questions={draft.questions}
                                npsPoll={draft.npsPoll}
                                result={detail?.results.find(x => x.questionId === question.id)}
                                onChange={next => setQuestion(index, next)}
                                onRemove={() => removeAt(index)}
                                onMove={by => move(index, by)}
                            />
                        ))}
                    </ul>
                </fieldset>
                {canManage && (
                    <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3">
                        <Button variant="secondary" icon={<Plus />} onClick={() => set({ questions: [ ...draft.questions, blankQuestion(draft.questions.length) ] })}>Add question</Button>
                        <span className="flex-1" />
                        {id !== null && (
                            <Button
                                variant="danger"
                                icon={<Trash2 />}
                                disabled={drop.isPending}
                                onClick={() => ask({ title: `Delete the poll ${draft.headline}?`, body: 'Its answers go with it. Turning it off keeps them.', confirm: 'Delete' }, () => drop.mutate(id, {
                                    onSuccess: () => {
                                        toast('Deleted the poll.');
                                        onClose();
                                    },
                                    onError: toastError,
                                }))}
                            >
                                Delete
                            </Button>
                        )}
                        <Button type="submit" disabled={save.isPending}>Save</Button>
                    </div>
                )}
            </form>
        </Panel>
    );
};

/** A poll opened, read in full first. */
const OpenPoll = ({ id, canManage, onClose }: { id: number; canManage: boolean; onClose: () => void }) => {
    const { data, error } = usePoll(id);

    if (error) return <ErrorNotice error={error} />;
    if (!data) return <Loading />;

    return <PollEditor key={id} start={data} id={id} canManage={canManage} onClose={onClose} />;
};

/**
 * The room polls: each offered to everyone entering its room until they finish it or say no,
 * with what players answered beside each question. A poll's questions are kept by their id when
 * it is saved again, so their answers stay; one taken out loses its answers.
 */
export const PollsTab = () => {
    const { data, error } = usePolls();
    const [ open, setOpen ] = useState<number | 'new' | null>(null);

    if (error) return <ErrorNotice error={error} />;
    if (!data) return <Loading />;

    if (open === 'new')
        return <PollEditor start={BLANK} id={null} canManage={data.canManage} onClose={() => setOpen(null)} />;

    if (open !== null)
        return <OpenPoll id={open} canManage={data.canManage} onClose={() => setOpen(null)} />;

    return (
        <Panel
            title="Room polls"
            description="Offered to everyone who enters the room until they finish it or say no."
            actions={data.canManage && <Button icon={<Plus />} onClick={() => setOpen('new')}>Add poll</Button>}
            className="overflow-clip"
        >
            {data.polls.length === 0
                ? <EmptyState>No polls yet.</EmptyState>
                : (
                        <ul className="divide-y divide-line border-t border-line">
                            {data.polls.map(poll => (
                                <li key={poll.id}>
                                    <button type="button" onClick={() => setOpen(poll.id)} className="flex w-full flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 text-left hover:bg-subtle/60">
                                        <span className={cx('grid size-10 shrink-0 place-items-center rounded-xl [&>svg]:size-5', poll.enabled ? 'bg-accent-soft text-accent' : 'bg-subtle text-muted')}>
                                            <Vote />
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="flex flex-wrap items-center gap-2">
                                                <span className="text-sm font-medium">{poll.headline}</span>
                                                {poll.npsPoll && <Badge>score</Badge>}
                                                {!poll.enabled && <Badge>off</Badge>}
                                            </span>
                                            <span className="block truncate text-xs text-muted">
                                                {poll.roomName ?? `Room ${poll.roomId}`} · {plural(poll.questions, 'question')} · {poll.finished.toLocaleString()} finished, {poll.started.toLocaleString()} started, {poll.rejected.toLocaleString()} said no
                                            </span>
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
        </Panel>
    );
};

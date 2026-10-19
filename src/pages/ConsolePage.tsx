import { type FormEvent, type KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { useCommands, useMe, useRunCommand } from '#/api/queries';
import type { CommandInfo, RunCommandResponse } from '#/api/types';
import { Button, ErrorNotice, FIELD_CLASS, Input, Loading, PageBody, PageHeader, Panel } from '#/components/ui';
import { cx } from '#/lib/cx';
import { useFillHeight } from '#/lib/fillHeight';

interface Entry {
    id: number;
    line: string;
    response?: RunCommandResponse;
    error?: string;
}

const OUTCOMES: Record<string, { label: string; tone: string }> = {
    Completed: { label: 'Done', tone: 'text-good' },
    AwaitingConfirmation: { label: 'Needs confirming', tone: 'text-warn' },
    Refused: { label: 'Not allowed', tone: 'text-bad' },
    Failed: { label: 'Did not go through', tone: 'text-bad' },
    BindFailed: { label: 'Check the arguments', tone: 'text-bad' },
    NeedsRoom: { label: 'Room only', tone: 'text-muted' },
};

const outcomeOf = (entry: Entry) => {
    if (entry.error)
        return { label: 'Failed', tone: 'text-bad' };

    if (!entry.response)
        return { label: 'Running...', tone: 'text-muted' };

    if (!entry.response.found)
        return { label: 'Unknown command', tone: 'text-bad' };

    const outcome = entry.response.outcome ?? '';

    return OUTCOMES[outcome] ?? { label: outcome, tone: 'text-muted' };
};

/**
 * Every command, grouped and searchable. The one picked shows its usage under it; a command that
 * acts on the room you are in says so, and cannot be picked, since the panel is in no room.
 */
const CommandList = ({ commands, picked, onPick }: { commands: CommandInfo[]; picked: CommandInfo | null; onPick: (command: CommandInfo) => void }) => {
    const [ filter, setFilter ] = useState('');

    const groups = useMemo(() => {
        const needle = filter.trim().toLowerCase();
        const shown = commands.filter(command =>
            needle === ''
            || command.name.includes(needle)
            || command.aliases.some(alias => alias.includes(needle))
            || command.description.toLowerCase().includes(needle));

        return Object.entries(Object.groupBy(shown, command => command.category));
    }, [ commands, filter ]);

    const anyRoomOnly = commands.some(command => command.needsRoom);
    const fillCommands = useFillHeight<HTMLElement>();

    return (
        <Panel ref={fillCommands} title="Commands" className="flex max-h-[70dvh] flex-col lg:max-h-(--fill-height)">
            <div className="flex flex-col gap-2 border-b border-line p-3">
                <Input
                    type="search"
                    value={filter}
                    onChange={event => setFilter(event.target.value)}
                    placeholder="Find a command"
                    aria-label="Find a command"
                />
                {anyRoomOnly && <p className="text-xs text-muted">Commands marked room only act on the room you are standing in, so run them in game.</p>}
            </div>
            <div className="min-h-0 overflow-y-auto p-2">
                {groups.length === 0 && <p className="p-2 text-sm text-muted">No command matches.</p>}
                {groups.map(([ category, list ]) => (
                    <div key={category} className="mb-3">
                        <div className="px-2 py-1 text-xs font-semibold tracking-wide text-muted uppercase">{category}</div>
                        {list?.map(command => (
                            <button
                                key={command.name}
                                type="button"
                                disabled={command.needsRoom}
                                onClick={() => onPick(command)}
                                aria-current={picked?.name === command.name || undefined}
                                className="block w-full rounded-md px-2 py-1.5 text-left hover:bg-subtle disabled:cursor-not-allowed aria-[current]:bg-subtle"
                            >
                                <span className={cx('font-mono text-sm', command.needsRoom && 'text-muted')}>{command.name}</span>
                                {command.needsRoom && <span className="ml-2 text-xs text-muted">room only, in game</span>}
                                <span className="block truncate text-xs text-muted">{command.description}</span>
                                {picked?.name === command.name && command.help.length > 0 && (
                                    <span className="mt-1 block font-mono text-[11px] text-muted">
                                        {command.help.map((help, index) => <span key={index} className="block">{help}</span>)}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                ))}
            </div>
        </Panel>
    );
};

/**
 * The operator commands, run as the signed-in player: the same nodes, limits, confirmations and
 * command log as typing them in the hotel.
 */
export const ConsolePage = () => {
    const commands = useCommands();
    const canViewCommandLog = useMe().data?.canViewCommandLog ?? false;
    const run = useRunCommand();
    const [ entries, setEntries ] = useState<Entry[]>([]);
    const [ line, setLine ] = useState('');
    const [ historyIndex, setHistoryIndex ] = useState<number | null>(null);
    const [ picked, setPicked ] = useState<CommandInfo | null>(null);
    const nextId = useRef(0);
    const input = useRef<HTMLInputElement>(null);
    const bottom = useRef<HTMLDivElement>(null);
    const [ params, setParams ] = useSearchParams();
    const wanted = params.get('command');

    const [ taken, setTaken ] = useState<string | null>(null);

    // A command picked in the search (`?command=`): typed in, ready for its arguments.
    if (wanted !== taken && (!wanted || commands.data)) {
        setTaken(wanted);

        const command = wanted ? commands.data?.find(x => x.name === wanted) : undefined;

        if (command) {
            setPicked(command);
            setLine(`${command.name} `);
        }
    }

    useEffect(() => {
        if (!taken)
            return;

        input.current?.focus();
        setParams({}, { replace: true });
    }, [ taken, setParams ]);

    // A block, not an expression: newer browsers return a Promise from scrollIntoView, and an
    // effect may only return a clean-up function.
    useEffect(() => {
        bottom.current?.scrollIntoView({ block: 'end' });
    }, [ entries ]);

    const submit = (text: string) => {
        const trimmed = text.trim();

        if (trimmed === '' || run.isPending)
            return;

        const id = nextId.current++;

        setEntries(previous => [ ...previous, { id, line: trimmed } ]);
        setLine('');
        setHistoryIndex(null);

        run.mutate(trimmed, {
            onSuccess: response => setEntries(previous => previous.map(entry => entry.id === id ? { ...entry, response } : entry)),
            onError: error => setEntries(previous => previous.map(entry => entry.id === id ? { ...entry, error: error.message } : entry)),
        });
    };

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();
        submit(line);
    };

    // Up and down walk through what was typed before, newest first, as a shell does.
    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')
            return;

        const typed = entries.map(entry => entry.line);

        if (typed.length === 0)
            return;

        event.preventDefault();

        const current = historyIndex ?? typed.length;
        const next = event.key === 'ArrowUp' ? Math.max(0, current - 1) : current + 1;

        if (next >= typed.length) {
            setHistoryIndex(null);
            setLine('');

            return;
        }

        setHistoryIndex(next);
        setLine(typed[next] ?? '');
    };

    const pick = (command: CommandInfo) => {
        setPicked(command);
        setLine(`${command.name} `);
        input.current?.focus();
    };

    return (
        <>
            <PageHeader title="Console" description="Operator commands, run as you, with your permissions" />
            <PageBody className="grid gap-4 lg:gap-5 lg:grid-cols-[18rem_1fr]">
                <div className="order-2 lg:order-1">
                    {commands.isPending && <Loading />}
                    {commands.error && <ErrorNotice error={commands.error} />}
                    {commands.data && <CommandList commands={commands.data} picked={picked} onPick={pick} />}
                </div>
                <div className="order-1 flex min-w-0 flex-col gap-3 lg:order-2">
                    <Panel className="min-h-80 flex-1">
                        <div className="max-h-[60dvh] overflow-y-auto p-4 font-mono text-sm">
                            {entries.length === 0 && (
                                <p className="font-sans text-muted">
                                    Type a command as you would in the hotel, without the colon if you like:
                                    {' '}
                                    <code className="font-mono">online</code>
                                    ,
                                    {' '}
                                    <code className="font-mono">whois Alice</code>
                                    ,
                                    {' '}
                                    <code className="font-mono">hotelalert Back in five</code>
                                    .
                                </p>
                            )}
                            {entries.map((entry) => {
                                const outcome = outcomeOf(entry);
                                const awaiting = entry.response?.outcome === 'AwaitingConfirmation';

                                return (
                                    <div key={entry.id} className="mb-4">
                                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                                            <span className="text-muted">
                                                &gt;
                                                {' '}
                                                <span className="text-ink">{entry.line}</span>
                                            </span>
                                            <span className={`font-sans text-xs ${outcome.tone}`}>{outcome.label}</span>
                                        </div>
                                        {entry.error && <p className="mt-1 text-bad">{entry.error}</p>}
                                        {entry.response?.lines.map((output, index) => (
                                            <p
                                                key={index}
                                                className={`mt-1 whitespace-pre-wrap ${output.kind === 'reply' ? 'text-muted' : 'text-ink'}`}
                                            >
                                                {output.text}
                                            </p>
                                        ))}
                                        {awaiting && (
                                            <Button variant="danger" onClick={() => submit('confirm')} disabled={run.isPending} className="mt-2 font-sans">
                                                Confirm
                                            </Button>
                                        )}
                                    </div>
                                );
                            })}
                            <div ref={bottom} />
                        </div>
                    </Panel>
                    {picked && line.startsWith(picked.name) && (
                        <div className="rounded-md border border-line bg-subtle px-3 py-2 text-xs text-muted">
                            <div className="text-ink">
                                <span className="font-mono font-semibold">{picked.name}</span>
                                {picked.description && ` · ${picked.description}`}
                            </div>
                            {picked.help.map((help, index) => <div key={index} className="mt-0.5 font-mono">{help}</div>)}
                        </div>
                    )}
                    <form onSubmit={handleSubmit} className="flex gap-2">
                        <input
                            ref={input}
                            value={line}
                            onChange={event => setLine(event.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Command"
                            aria-label="Command"
                            autoComplete="off"
                            spellCheck={false}
                            className={cx(FIELD_CLASS, 'min-w-0 flex-1 font-mono')}
                        />
                        <Button type="submit" disabled={run.isPending || line.trim() === ''}>Run</Button>
                    </form>
                    {canViewCommandLog && (
                        <p className="text-xs text-muted">
                            {'Every command run here is logged as yours. '}
                            <Link to="/command-log?source=panel" className="font-medium text-accent hover:underline">See the log</Link>
                        </p>
                    )}
                </div>
            </PageBody>
        </>
    );
};

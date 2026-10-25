import { X } from 'lucide-react';
import { type FormEvent, useId, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { type CommandLogEntry, type CommandLogFilter, useCommandLog } from '#/api/commandLog';
import { useCommands } from '#/api/queries';
import { ListToolbar } from '#/components/ListToolbar';
import { LogFilters } from '#/components/LogFilters';
import { PhoneLabel, Row, RowList } from '#/components/RowList';
import { SearchInput } from '#/components/SearchInput';
import { Badge, type BadgeTone, Button, EmptyState, ErrorNotice, Input, Loading, PageBody, PageHeader, Panel, Select } from '#/components/ui';
import { useHubTabs } from '#/layout/nav';
import { cx } from '#/lib/cx';
import { type ListOrder, listQuery, orderOf, pageOf, type Sorting } from '#/lib/sort';
import { fromNow } from '#/lib/time';
import { formatDateTime } from '#/pages/rooms/labels';

/** How a command went, in the words the console uses for the same outcomes. */
const OUTCOMES: Record<string, { label: string; tone: BadgeTone }> = {
    completed: { label: 'Done', tone: 'green' },
    partial: { label: 'Partly done', tone: 'amber' },
    confirm: { label: 'Needs confirming', tone: 'amber' },
    refused: { label: 'Not allowed', tone: 'red' },
    failed: { label: 'Did not go through', tone: 'red' },
    bind_failed: { label: 'Check the arguments', tone: 'red' },
    vetoed: { label: 'Stopped by a plugin', tone: 'amber' },
    canceled: { label: 'Canceled', tone: 'neutral' },
    flood: { label: 'Too fast', tone: 'amber' },
    room_level: { label: 'Room only', tone: 'neutral' },
    error: { label: 'Error', tone: 'red' },
};

const SOURCES: { value: string; label: string }[] = [
    { value: '', label: 'Anywhere' },
    { value: 'player', label: 'In game' },
    { value: 'chat', label: 'Room chat' },
    { value: 'panel', label: 'Admin panel' },
    { value: 'console', label: 'Server console' },
];

const SOURCE_LABELS: Record<string, string> = { player: 'in game', panel: 'panel', console: 'console' };

/** How a command went, as a coloured tag: the log's, and the overview's recent commands. */
export const Outcome = ({ outcome }: { outcome: string }) => {
    const known = OUTCOMES[outcome];

    return <Badge tone={known?.tone ?? 'neutral'}>{known?.label ?? outcome}</Badge>;
};

/** Who ran it: a link to their page, or the console. */
const Who = ({ entry }: { entry: CommandLogEntry }) => {
    if (entry.playerId === 0)
        return <span className="text-muted">console</span>;

    return entry.playerName
        ? <Link to={`/players/${entry.playerId}`} className="font-medium hover:text-accent">{entry.playerName}</Link>
        : <span className="text-muted">player #{entry.playerId}</span>;
};

/** Where it was typed: a room, or where it came from when there was no room. */
const Where = ({ entry }: { entry: CommandLogEntry }) => {
    // The console says so under Who already.
    if (entry.playerId === 0 && entry.roomId === 0)
        return <span className="text-muted max-sm:hidden">-</span>;

    if (entry.roomId === 0)
        return <span className="text-muted">{SOURCE_LABELS[entry.source ?? ''] ?? '-'}</span>;

    return (
        <span className="min-w-0 truncate">
            <PhoneLabel>in </PhoneLabel>
            {entry.roomName
                ? <Link to={`/rooms/${entry.roomId}`} className="hover:text-accent">{entry.roomName}</Link>
                : <span className="text-muted">room #{entry.roomId}</span>}
        </span>
    );
};

const filterOf = (params: URLSearchParams): CommandLogFilter => ({
    player: params.get('player') ?? '',
    command: params.get('command') ?? '',
    outcome: params.get('outcome') ?? '',
    source: params.get('source') ?? '',
});

/**
 * Every logged command, newest first or by command: who ran it, where, with what, and how it went.
 * Narrowed to one player, command, outcome or source; the filter and the order live in the
 * address, so a player's page can link straight to their commands.
 */
export const CommandLogPage = () => {
    const tabs = useHubTabs('logs');
    const [ params, setParams ] = useSearchParams();
    const filter = filterOf(params);
    const page = pageOf(params);
    const order = orderOf(params);
    const [ draft, setDraft ] = useState({ player: filter.player, command: filter.command });
    const log = useCommandLog(filter, page, order);
    const commands = useCommands();
    const listId = useId();
    const pageSize = log.data?.pageSize ?? 1;
    const filtered = Object.values(filter).some(x => x !== '');

    /** Another filter or page, in the same order; another order starts at the first page. */
    const go = ({ page: nextPage, ...next }: Partial<CommandLogFilter> & { page?: number }, nextOrder: ListOrder | null = order) =>
        setParams(listQuery({ ...filter, ...next }, nextPage ?? 1, nextOrder));

    const sorting: Sorting = { order: order ?? log.data?.order, onSort: next => go({}, next) };

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();
        go({ player: draft.player.trim(), command: draft.command.trim(), page: 1 });
    };

    const clear = () => {
        setDraft({ player: '', command: '' });
        setParams(listQuery({}, 1, order));
    };

    return (
        <>
            <PageHeader
                title="Logs"
                tabs={tabs}
                description={log.data
                    ? `${log.data.total.toLocaleString()} ${log.data.total === 1 ? 'command' : 'commands'}${filtered ? ' matching' : ' logged'}`
                    : 'Who ran what, where, and how it went'}
            />
            <PageBody>
                <Panel className="overflow-clip">
                    <ListToolbar
                        watch={[ filter.player, filter.command, filter.outcome, filter.source, page, order ]}
                        page={{
                            offset: (page - 1) * pageSize,
                            limit: pageSize,
                            total: log.data?.total,
                            onChange: offset => go({ page: Math.floor(offset / pageSize) + 1 }),
                        }}
                    >
                        <form onSubmit={handleSubmit} className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                            <SearchInput
                                value={draft.player}
                                onValueChange={player => setDraft({ ...draft, player })}
                                placeholder="Player name or id"
                                aria-label="Player"
                                className="min-w-40 flex-1 sm:max-w-56"
                            />
                            <LogFilters active={[ filter.command, filter.outcome, filter.source ].filter(x => x !== '').length}>
                                <Input
                                    type="search"
                                    value={draft.command}
                                    onChange={event => setDraft({ ...draft, command: event.target.value })}
                                    list={listId}
                                    placeholder="Command"
                                    aria-label="Command"
                                    spellCheck={false}
                                    autoComplete="off"
                                    className="w-36 flex-[1_1_8rem] font-mono sm:flex-none"
                                />
                                <datalist id={listId}>
                                    {commands.data?.map(x => <option key={x.name} value={x.name} />)}
                                </datalist>
                                <Select value={filter.outcome} onChange={event => go({ outcome: event.target.value, page: 1 })} aria-label="Outcome">
                                    <option value="">Any outcome</option>
                                    {Object.entries(OUTCOMES).map(([ value, x ]) => <option key={value} value={value}>{x.label}</option>)}
                                </Select>
                                <Select value={filter.source} onChange={event => go({ source: event.target.value, page: 1 })} aria-label="Where from">
                                    {SOURCES.map(x => <option key={x.value} value={x.value}>{x.label}</option>)}
                                </Select>
                                <Button type="submit">Search</Button>
                                {filtered && <Button type="button" variant="ghost" icon={<X />} onClick={clear}>Clear</Button>}
                            </LogFilters>
                        </form>
                    </ListToolbar>

                    {log.error && <div className="p-4"><ErrorNotice error={log.error} /></div>}
                    {log.isPending && <Loading />}
                    {log.data && (
                        log.data.entries.length === 0
                            ? <EmptyState>{filtered ? 'No logged command matches.' : 'Nothing has been logged yet.'}</EmptyState>
                            : (
                                    <div className={cx('transition-opacity', log.isFetching && 'opacity-60')}>
                                        <RowList
                                            columns="max-content minmax(0,10rem) minmax(0,10rem) minmax(0,1fr) max-content"
                                            headers={[ { label: 'When', sort: 'when', first: 'desc' }, { label: 'Who' }, { label: 'Where' }, { label: 'Command', sort: 'command' }, { label: 'Outcome' } ]}
                                            sorting={sorting}
                                        >
                                            {log.data.entries.map(entry => (
                                                <Row key={entry.id}>
                                                    <span className="text-xs whitespace-nowrap text-muted sm:text-sm" title={formatDateTime(entry.atUtc)}>
                                                        {fromNow(entry.atUtc)}
                                                    </span>
                                                    <span className="truncate"><Who entry={entry} /></span>
                                                    <Where entry={entry} />
                                                    <span className="basis-full wrap-anywhere sm:basis-auto">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setDraft({ ...draft, command: entry.command });
                                                                go({ command: entry.command, page: 1 });
                                                            }}
                                                            className="font-mono text-xs font-semibold hover:text-accent"
                                                            title={`Only :${entry.command}`}
                                                        >
                                                            :{entry.command}
                                                        </button>
                                                        {entry.arguments && <span className="ml-1.5 font-mono text-xs text-muted">{entry.arguments}</span>}
                                                    </span>
                                                    <Outcome outcome={entry.outcome} />
                                                </Row>
                                            ))}
                                        </RowList>
                                    </div>
                                )
                    )}
                </Panel>
            </PageBody>
        </>
    );
};

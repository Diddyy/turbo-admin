import { ArrowRight, MessagesSquare, X } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { type MessageLogEntry, type MessageLogFilter, useMessageLog } from '#/api/messages';
import { useMe } from '#/api/queries';
import { ListToolbar } from '#/components/ListToolbar';
import { LogFilters } from '#/components/LogFilters';
import { PhoneLabel, Row, RowList } from '#/components/RowList';
import { SearchInput } from '#/components/SearchInput';
import { Badge, Button, EmptyState, ErrorNotice, Input, Loading, PageBody, PageHeader, Panel } from '#/components/ui';
import { useHubTabs } from '#/layout/nav';
import { cx } from '#/lib/cx';
import { type ListOrder, listQuery, orderOf, pageOf, type Sorting } from '#/lib/sort';
import { fromNow } from '#/lib/time';
import { formatDateTime } from '#/pages/rooms/labels';

/** A player on a message: a link to their page when you may look at players. */
const Who = ({ id, name, linked }: { id: number; name: string | null; linked: boolean }) => {
    const label = name ?? `player #${id}`;

    return linked
        ? <Link to={`/players/${id}`} className="font-medium hover:text-accent">{label}</Link>
        : <span className={cx('font-medium', !name && 'text-muted')}>{label}</span>;
};

const filterOf = (params: URLSearchParams): MessageLogFilter => ({
    player: params.get('player') ?? '',
    with: params.get('with') ?? '',
    text: params.get('text') ?? '',
});

/**
 * What friends sent each other in the messenger, newest first or oldest first: one player's
 * messages, sent and received, or the conversation between two, or words in them. Any message opens
 * the conversation it is in. The filter, the page and the order live in the address, so a player's
 * page links straight here.
 */
export const MessagesPage = () => {
    const tabs = useHubTabs('logs');
    const linked = useMe().data?.canViewPlayers ?? false;
    const [ params, setParams ] = useSearchParams();
    const filter = filterOf(params);
    const page = pageOf(params);
    const order = orderOf(params);
    const [ draft, setDraft ] = useState(filter);
    const log = useMessageLog(filter, page, order);
    const filtered = Object.values(filter).some(x => x !== '');
    const entries = log.data?.entries ?? [];
    const conversation = filter.player !== '' && filter.with !== '';
    const pageSize = log.data?.pageSize ?? 1;

    /** Another filter, page or order; the search box follows the filter. */
    const go = (next: MessageLogFilter, nextPage = 1, nextOrder: ListOrder | null = order) => {
        setDraft(next);
        setParams(listQuery(next, nextPage, nextOrder));
    };

    const sorting: Sorting = { order: order ?? log.data?.order, onSort: next => go(filter, 1, next) };

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();
        go({ player: draft.player.trim(), with: draft.with.trim(), text: draft.text.trim() });
    };

    const open = (entry: MessageLogEntry) => go({ player: String(entry.senderId), with: String(entry.receiverId), text: '' });

    return (
        <>
            <PageHeader title="Logs" tabs={tabs} description="What friends sent each other in the messenger" />
            <PageBody>
                <Panel className="overflow-clip">
                    <ListToolbar
                        watch={[ filter.player, filter.with, filter.text, page, order ]}
                        page={{
                            offset: (page - 1) * pageSize,
                            limit: pageSize,
                            total: log.data?.total,
                            capped: log.data?.totalCapped,
                            onChange: offset => go(filter, Math.floor(offset / pageSize) + 1),
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
                            <LogFilters active={[ filter.with, filter.text ].filter(x => x !== '').length}>
                                <Input
                                    type="search"
                                    value={draft.with}
                                    onChange={event => setDraft({ ...draft, with: event.target.value })}
                                    placeholder="With (name or id)"
                                    aria-label="The other player of a conversation"
                                    className="min-w-32 flex-1 sm:max-w-48"
                                />
                                <Input
                                    type="search"
                                    value={draft.text}
                                    onChange={event => setDraft({ ...draft, text: event.target.value })}
                                    placeholder="Words"
                                    aria-label="Words in the message"
                                    className="min-w-32 flex-1 sm:max-w-56"
                                />
                                <Button type="submit">Search</Button>
                                {filtered && <Button type="button" variant="ghost" icon={<X />} onClick={() => go({ player: '', with: '', text: '' })}>Clear</Button>}
                            </LogFilters>
                        </form>
                    </ListToolbar>

                    {log.error && <div className="p-4"><ErrorNotice error={log.error} /></div>}
                    {log.isPending && <Loading />}
                    {log.data && (entries.length === 0
                        ? <EmptyState>{filtered ? 'No message matches.' : 'No message has been sent yet.'}</EmptyState>
                        : (
                                <div className={cx('transition-opacity', log.isFetching && 'opacity-60')}>
                                    <RowList
                                        columns={`max-content minmax(0,9rem) minmax(0,9rem) minmax(0,1fr)${conversation ? '' : ' max-content'}`}
                                        headers={[ { label: 'When', sort: 'when', first: 'desc' }, { label: 'From' }, { label: 'To' }, { label: 'Message' }, ...(conversation ? [] : [ {} ]) ]}
                                        sorting={sorting}
                                    >
                                        {entries.map(entry => (
                                            <Row key={entry.id}>
                                                <span className="text-xs whitespace-nowrap text-muted sm:text-sm" title={formatDateTime(entry.atUtc)}>{fromNow(entry.atUtc)}</span>
                                                <span className="truncate"><Who id={entry.senderId} name={entry.senderName} linked={linked} /></span>
                                                <span className="min-w-0 truncate">
                                                    <PhoneLabel><ArrowRight className="mr-1 inline size-3.5" /></PhoneLabel>
                                                    <Who id={entry.receiverId} name={entry.receiverName} linked={linked} />
                                                </span>
                                                <span className="basis-full wrap-anywhere sm:basis-auto">
                                                    {entry.habbiconId > 0 ? <Badge>Habbicon #{entry.habbiconId}</Badge> : entry.message}
                                                    {!entry.delivered && <Badge tone="amber" className="ml-1.5 align-middle">waiting</Badge>}
                                                </span>
                                                {!conversation && (
                                                    <Button
                                                        variant="ghost"
                                                        icon={<MessagesSquare />}
                                                        onClick={() => open(entry)}
                                                        aria-label={`The conversation between ${entry.senderName ?? entry.senderId} and ${entry.receiverName ?? entry.receiverId}`}
                                                        className="row-actions h-9 px-2 text-xs max-sm:ml-auto sm:h-8"
                                                    >
                                                        Conversation
                                                    </Button>
                                                )}
                                            </Row>
                                        ))}
                                    </RowList>
                                </div>
                            ))}
                </Panel>
            </PageBody>
        </>
    );
};

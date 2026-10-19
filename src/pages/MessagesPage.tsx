import { ArrowRight, ChevronLeft, ChevronRight, MessagesSquare, X } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { type MessageLogCursor, type MessageLogEntry, type MessageLogFilter, useMessageLog } from '#/api/messages';
import { useMe } from '#/api/queries';
import { ListToolbar } from '#/components/ListToolbar';
import { LogFilters } from '#/components/LogFilters';
import { PhoneLabel, Row, RowList } from '#/components/RowList';
import { SearchInput } from '#/components/SearchInput';
import { Badge, Button, EmptyState, ErrorNotice, Input, Loading, PageBody, PageHeader, Panel } from '#/components/ui';
import { useHubTabs } from '#/layout/nav';
import { cx } from '#/lib/cx';
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

const cursorOf = (params: URLSearchParams): MessageLogCursor => ({
    before: Number(params.get('before')) || undefined,
    after: Number(params.get('after')) || undefined,
});

/**
 * What friends sent each other in the messenger, newest first: one player's messages, sent and
 * received, or the conversation between two, or words in them. Any message opens the
 * conversation it is in. The filter lives in the address, so a player's page links straight here.
 */
export const MessagesPage = () => {
    const tabs = useHubTabs('logs');
    const linked = useMe().data?.canViewPlayers ?? false;
    const [ params, setParams ] = useSearchParams();
    const filter = filterOf(params);
    const cursor = cursorOf(params);
    const [ draft, setDraft ] = useState(filter);
    const log = useMessageLog(filter, cursor);
    const filtered = Object.values(filter).some(x => x !== '');
    const entries = log.data?.entries ?? [];
    const conversation = filter.player !== '' && filter.with !== '';

    const go = (next: MessageLogFilter, nextCursor: MessageLogCursor = {}) => {
        const search = new URLSearchParams();

        for (const [ key, value ] of Object.entries(next))
            if (value)
                search.set(key, value);

        if (nextCursor.before)
            search.set('before', String(nextCursor.before));

        if (nextCursor.after)
            search.set('after', String(nextCursor.after));

        setDraft(next);
        setParams(search);
    };

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();
        go({ player: draft.player.trim(), with: draft.with.trim(), text: draft.text.trim() });
    };

    const open = (entry: MessageLogEntry) => go({ player: String(entry.senderId), with: String(entry.receiverId), text: '' });

    const first = entries[0];
    const last = entries[entries.length - 1];

    return (
        <>
            <PageHeader title="Logs" tabs={tabs} description="What friends sent each other in the messenger" />
            <PageBody>
                <Panel className="overflow-clip">
                    <ListToolbar watch={[ filter.player, filter.with, filter.text, cursor.before, cursor.after ]}>
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
                        <nav aria-label="Pages" className="ml-auto flex items-center gap-1">
                            <Button variant="ghost" icon={<ChevronLeft />} disabled={!log.data?.hasNewer || !first} onClick={() => first && go(filter, { after: first.id })}>
                                Newer
                            </Button>
                            <Button variant="ghost" disabled={!log.data?.hasOlder || !last} onClick={() => last && go(filter, { before: last.id })}>
                                Older
                                <ChevronRight />
                            </Button>
                        </nav>
                    </ListToolbar>

                    {log.error && <div className="p-4"><ErrorNotice error={log.error} /></div>}
                    {log.isPending && <Loading />}
                    {log.data && (entries.length === 0
                        ? <EmptyState>{filtered ? 'No message matches.' : 'No message has been sent yet.'}</EmptyState>
                        : (
                                <div className={cx('transition-opacity', log.isFetching && 'opacity-60')}>
                                    <RowList
                                        columns={`max-content minmax(0,9rem) minmax(0,9rem) minmax(0,1fr)${conversation ? '' : ' max-content'}`}
                                        headers={[ { label: 'When' }, { label: 'From' }, { label: 'To' }, { label: 'Message' }, ...(conversation ? [] : [ {} ]) ]}
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

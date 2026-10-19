import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { type CurrencyLogCursor, type CurrencyLogEntry, type CurrencyLogFilter, useCurrencyLog } from '#/api/currencyLog';
import { ListToolbar } from '#/components/ListToolbar';
import { LogFilters } from '#/components/LogFilters';
import { PhoneLabel, Row, RowList } from '#/components/RowList';
import { SearchInput } from '#/components/SearchInput';
import { Button, EmptyState, ErrorNotice, Input, Loading, PageBody, PageHeader, Panel, Select, Stat, WarningNotice } from '#/components/ui';
import { useHubTabs } from '#/layout/nav';
import { cx } from '#/lib/cx';
import { fromNow } from '#/lib/time';
import { formatDateTime } from '#/pages/rooms/labels';

const PlayerLink = ({ id, name }: { id: number; name: string | null }) => (
    <Link to={`/players/${id}`} className={cx('font-medium hover:text-accent', !name && 'text-muted')}>{name ?? `player #${id}`}</Link>
);

/** The other side of a change, in words: who it came from or went to, or what. */
const Other = ({ entry }: { entry: CurrencyLogEntry }) => {
    const out = entry.amount < 0;

    switch (entry.other) {
        case 'wallet':
            return <span>{out ? 'to ' : 'from '}{entry.otherPlayerId ? <PlayerLink id={entry.otherPlayerId} name={entry.otherPlayerName} /> : 'a player'}</span>;
        case 'offer':
            return <span className="text-muted">{out ? 'onto' : 'off'} offer #{entry.otherPlaceId}</span>;
        case 'chest':
            return <span className="text-muted">{out ? 'into' : 'out of'} chest #{entry.otherPlaceId}</span>;
        default:
            return <span className="text-muted">{out ? 'spent' : 'given'}</span>;
    }
};

const filterOf = (params: URLSearchParams): CurrencyLogFilter => ({
    player: params.get('player') ?? '',
    currency: params.get('currency') ?? '',
    cause: params.get('cause') ?? '',
});

const cursorOf = (params: URLSearchParams): CurrencyLogCursor => ({
    before: Number(params.get('before')) || undefined,
    after: Number(params.get('after')) || undefined,
});

/**
 * Every change to a wallet the server's ledger kept, newest first: whose, how much in or out,
 * why (its cause, and what it names), who did it and the other side. Narrowed to a player (with
 * what came in and went out of each currency), a currency or a cause. Says so when the ledger is
 * not being kept, as movements are not recorded.
 */
export const CurrencyLogPage = () => {
    const tabs = useHubTabs('logs');
    const [ params, setParams ] = useSearchParams();
    const filter = filterOf(params);
    const cursor = cursorOf(params);
    const [ draft, setDraft ] = useState(filter);
    const log = useCurrencyLog(filter, cursor);
    const filtered = Object.values(filter).some(x => x !== '');
    const entries = log.data?.entries ?? [];

    const go = (next: CurrencyLogFilter, nextCursor: CurrencyLogCursor = {}) => {
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
        go({ player: draft.player.trim(), currency: draft.currency, cause: draft.cause.trim() });
    };

    const first = entries[0];
    const last = entries[entries.length - 1];

    return (
        <>
            <PageHeader title="Logs" tabs={tabs} description="Every change to players' wallets, and why" />
            <PageBody>
                <div className="flex flex-col gap-4">
                    {log.data && !log.data.recording && (
                        <WarningNotice>
                            The ledger isn't being kept now: it grows only while movements are recorded (<code>Turbo:Movements:Enabled</code>, with <code>CurrencyLedger</code> on). What it kept before is still here.
                        </WarningNotice>
                    )}
                    {log.data?.totals && log.data.totals.length > 0 && (
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                            {log.data.totals.map(total => (
                                <Stat key={total.currency} compact label={total.currency} value={(total.in - total.out).toLocaleString()} detail={[ total.in > 0 && `+${total.in.toLocaleString()} in`, total.out > 0 && `−${total.out.toLocaleString()} out` ].filter(Boolean).join(', ')} />
                            ))}
                        </div>
                    )}
                    <Panel className="overflow-clip">
                        <ListToolbar watch={[ filter.player, filter.currency, filter.cause, cursor.before, cursor.after ]}>
                            <form onSubmit={handleSubmit} className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                                <SearchInput
                                    value={draft.player}
                                    onValueChange={player => setDraft({ ...draft, player })}
                                    placeholder="Player name or id"
                                    aria-label="Player"
                                    className="min-w-40 flex-1 sm:max-w-56"
                                />
                                <LogFilters active={[ filter.currency, filter.cause ].filter(x => x !== '').length}>
                                    <Select value={draft.currency} onChange={event => setDraft({ ...draft, currency: event.target.value })} aria-label="Currency" className="w-36 flex-[1_1_8rem] sm:flex-none">
                                        <option value="">Every currency</option>
                                        {(log.data?.currencies ?? []).map(x => <option key={x.typeId} value={x.typeId}>{x.name}</option>)}
                                    </Select>
                                    <Input
                                        type="search"
                                        value={draft.cause}
                                        onChange={event => setDraft({ ...draft, cause: event.target.value })}
                                        placeholder="Cause, e.g. market"
                                        aria-label="Cause, or the start of one"
                                        className="min-w-32 flex-1 font-mono sm:max-w-48"
                                    />
                                    <Button type="submit">Search</Button>
                                    {filtered && <Button type="button" variant="ghost" icon={<X />} onClick={() => go({ player: '', currency: '', cause: '' })}>Clear</Button>}
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
                            ? <EmptyState>{filtered ? 'No change matches.' : 'The ledger has kept nothing yet.'}</EmptyState>
                            : (
                                    <div className={cx('transition-opacity', log.isFetching && 'opacity-60')}>
                                        <RowList
                                            columns="max-content minmax(0,9rem) max-content minmax(0,1fr) minmax(0,10rem) minmax(0,8rem)"
                                            headers={[ { label: 'When' }, { label: 'Player' }, { label: 'Amount', className: 'text-right' }, { label: 'Why' }, { label: 'Other side' }, { label: 'By' } ]}
                                        >
                                            {entries.map(entry => (
                                                <Row key={entry.id}>
                                                    <span className="text-xs whitespace-nowrap text-muted sm:text-sm" title={formatDateTime(entry.atUtc)}>{fromNow(entry.atUtc)}</span>
                                                    <span className="truncate"><PlayerLink id={entry.playerId} name={entry.playerName} /></span>
                                                    <span className={cx('font-mono whitespace-nowrap tabular-nums sm:text-right', entry.amount < 0 ? 'text-bad' : 'text-good')}>
                                                        {entry.amount > 0 ? '+' : '−'}{Math.abs(entry.amount).toLocaleString()} <span className="font-sans text-xs text-muted">{entry.currency}</span>
                                                    </span>
                                                    <span className="min-w-0 truncate">
                                                        <button type="button" onClick={() => go({ ...filter, cause: entry.cause })} className="font-mono text-[13px] hover:text-accent" title="Only this cause">{entry.cause}</button>
                                                        {entry.causeRef && <span className="ml-1.5 font-mono text-xs text-muted" title={entry.causeRef}>{entry.causeRef}</span>}
                                                    </span>
                                                    <span className="min-w-0 truncate text-[13px]"><Other entry={entry} /></span>
                                                    <span className="min-w-0 truncate text-[13px]">
                                                        <PhoneLabel>by </PhoneLabel>
                                                        {entry.actorId ? <PlayerLink id={entry.actorId} name={entry.actorName} /> : <span className="text-muted">the server</span>}
                                                    </span>
                                                </Row>
                                            ))}
                                        </RowList>
                                    </div>
                                ))}
                    </Panel>
                </div>
            </PageBody>
        </>
    );
};

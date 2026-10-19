import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { useMe } from '#/api/queries';
import { type ReportCursor, type ReportFilter, useReports } from '#/api/reports';
import { ListToolbar } from '#/components/ListToolbar';
import { PhoneLabel, Row, RowList } from '#/components/RowList';
import { SearchInput } from '#/components/SearchInput';
import { Button, EmptyState, ErrorNotice, Loading, PageBody, PageHeader, Panel, Segmented } from '#/components/ui';
import { useHubTabs } from '#/layout/nav';
import { cx } from '#/lib/cx';
import { plural } from '#/lib/plural';
import { fromNow } from '#/lib/time';
import { formatDateTime } from '#/pages/rooms/labels';

import { SOURCES } from './labels';
import { PlayerLink, StateBadge } from './parts';

const STATES: { value: ReportFilter['state']; label: string }[] = [
    { value: 'open', label: 'Open' },
    { value: 'closed', label: 'Closed' },
    { value: 'all', label: 'All' },
];

const filterOf = (params: URLSearchParams): ReportFilter => ({
    state: (STATES.find(x => x.value === params.get('state'))?.value) ?? 'open',
    player: params.get('player') ?? '',
});

const cursorOf = (params: URLSearchParams): ReportCursor => ({
    before: Number(params.get('before')) || undefined,
    after: Number(params.get('after')) || undefined,
});

/**
 * The calls for help players send, newest first: the open ones (picked or not) by default, the
 * closed ones or all, narrowed to a player who sent them or is named in them. Each opens on a page
 * of its own to read and close, as the client's mod tool does. The filter lives in the address,
 * so a player's page can link to the reports about them.
 */
export const ReportsPage = () => {
    const tabs = useHubTabs('moderation');
    const me = useMe().data;
    const [ params, setParams ] = useSearchParams();
    const filter = filterOf(params);
    const cursor = cursorOf(params);
    const [ player, setPlayer ] = useState(filter.player);
    const reports = useReports(filter, cursor);
    const entries = reports.data?.entries ?? [];
    const linked = me?.canViewPlayers ?? false;

    const go = (next: ReportFilter, nextCursor: ReportCursor = {}) => {
        const search = new URLSearchParams();

        if (next.state !== 'open')
            search.set('state', next.state);

        if (next.player)
            search.set('player', next.player);

        if (nextCursor.before)
            search.set('before', String(nextCursor.before));

        if (nextCursor.after)
            search.set('after', String(nextCursor.after));

        setParams(search);
    };

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();
        go({ ...filter, player: player.trim() });
    };

    const first = entries[0];
    const last = entries[entries.length - 1];
    const counts = reports.data;

    return (
        <>
            <PageHeader
                title="Moderation"
                tabs={tabs}
                description={counts ? `${plural(counts.open, 'open report')}, ${counts.picked.toLocaleString()} picked by a moderator` : 'The calls for help players send'}
            />
            <PageBody>
                <Panel className="overflow-clip">
                    <ListToolbar watch={[ filter.state, filter.player, cursor.before, cursor.after ]}>
                        <Segmented label="Which reports" value={filter.state} onChange={state => go({ ...filter, state: state as ReportFilter['state'] })} options={STATES} />
                        <form onSubmit={handleSubmit} className="flex min-w-0 flex-1 items-center gap-2">
                            <SearchInput
                                value={player}
                                onValueChange={setPlayer}
                                placeholder="Player name or id"
                                aria-label="Player"
                                className="min-w-40 flex-1 sm:max-w-56"
                            />
                            {filter.player && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    icon={<X />}
                                    onClick={() => {
                                        setPlayer('');
                                        go({ ...filter, player: '' });
                                    }}
                                >
                                    Clear
                                </Button>
                            )}
                        </form>
                        <nav aria-label="Pages" className="ml-auto flex items-center gap-1">
                            <Button variant="ghost" icon={<ChevronLeft />} disabled={!reports.data?.hasNewer || !first} onClick={() => first && go(filter, { after: first.id })}>
                                Newer
                            </Button>
                            <Button variant="ghost" disabled={!reports.data?.hasOlder || !last} onClick={() => last && go(filter, { before: last.id })}>
                                Older
                                <ChevronRight />
                            </Button>
                        </nav>
                    </ListToolbar>

                    {reports.error && <div className="p-4"><ErrorNotice error={reports.error} /></div>}
                    {reports.isPending && <Loading />}
                    {reports.data && (entries.length === 0
                        ? (
                                <EmptyState>
                                    {filter.player
                                        ? 'No report sent by or about that player here.'
                                        : filter.state === 'open' ? 'No report is waiting. Players\' calls for help show here as they send them.' : 'No report yet.'}
                                </EmptyState>
                            )
                        : (
                                <div className={cx('transition-opacity', reports.isFetching && 'opacity-60')}>
                                    <RowList
                                        columns="max-content minmax(0,1.2fr) minmax(0,9rem) minmax(0,9rem) minmax(0,2fr) max-content"
                                        headers={[ { label: 'Sent' }, { label: 'Topic' }, { label: 'About' }, { label: 'From' }, { label: 'Message' }, { label: 'State' } ]}
                                    >
                                        {entries.map(report => (
                                            <Row key={report.id}>
                                                <span className="text-xs whitespace-nowrap text-muted sm:text-sm" title={formatDateTime(report.atUtc)}>
                                                    {fromNow(report.atUtc)}
                                                </span>
                                                <span className="min-w-0 truncate">
                                                    <Link to={`/reports/${report.id}`} className="font-medium hover:text-accent">{report.topic}</Link>
                                                    <span className="block truncate text-xs text-muted">{SOURCES[report.source]}{report.category ? ` · ${report.category}` : ''}</span>
                                                </span>
                                                <span className="min-w-0 truncate">
                                                    <PhoneLabel>about </PhoneLabel>
                                                    {report.reportedId !== null
                                                        ? <PlayerLink id={report.reportedId} name={report.reportedName} linked={linked} />
                                                        : <span className="text-muted">{report.roomName ?? 'no one'}</span>}
                                                </span>
                                                <span className="min-w-0 truncate">
                                                    <PhoneLabel>from </PhoneLabel>
                                                    <PlayerLink id={report.reporterId} name={report.reporterName} linked={linked} />
                                                </span>
                                                <Link to={`/reports/${report.id}`} className="basis-full truncate text-muted hover:text-ink sm:basis-auto">{report.message || '—'}</Link>
                                                <span className="max-sm:ml-auto"><StateBadge report={report} me={me?.id} /></span>
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

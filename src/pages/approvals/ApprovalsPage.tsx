import { X } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { type ApprovalFilter, type ApprovalState, useApprovals } from '#/api/approvals';
import { useMe } from '#/api/queries';
import { ListToolbar } from '#/components/ListToolbar';
import { PhoneLabel, Row, RowList } from '#/components/RowList';
import { SearchInput } from '#/components/SearchInput';
import { Badge, Button, EmptyState, ErrorNotice, Loading, PageBody, PageHeader, Panel, Segmented } from '#/components/ui';
import { cx } from '#/lib/cx';
import { plural } from '#/lib/plural';
import { fromNow } from '#/lib/time';
import { formatDateTime } from '#/pages/rooms/labels';

import { ApprovalBadge, Requester } from './parts';

const STATES: { value: ApprovalFilter['state']; label: string }[] = [
    { value: 'pending', label: 'Pending' },
    { value: 'executed', label: 'Done' },
    { value: 'failed', label: 'Failed' },
    { value: 'denied', label: 'Denied' },
    { value: 'expired', label: 'Expired' },
    { value: 'all', label: 'All' },
];

const filterOf = (params: URLSearchParams): ApprovalFilter => ({
    state: (STATES.find(x => x.value === params.get('state'))?.value as ApprovalState | 'all' | undefined) ?? 'pending',
    kind: params.get('kind') ?? '',
    plugin: params.get('plugin') ?? '',
});

/**
 * What plugins, AI agents and MCP tools asked to do and wait for a person's yes, newest first:
 * the pending ones by default, or those done, failed, denied or expired, narrowed to a kind or a
 * plugin. Each opens on a page of its own to read its arguments and approve or deny it. The filter
 * and the page live in the address.
 */
export const ApprovalsPage = () => {
    const me = useMe().data;
    const [ params, setParams ] = useSearchParams();
    const filter = filterOf(params);
    const page = Math.max(1, Number(params.get('page')) || 1);
    const [ kind, setKind ] = useState(filter.kind);
    const approvals = useApprovals(filter, page);
    const entries = approvals.data?.entries ?? [];
    const linked = me?.canViewPlayers ?? false;
    const pageSize = approvals.data?.pageSize ?? 1;

    /** Another filter or page; pending, the default, and the first page are left out of the address. */
    const go = (next: ApprovalFilter, nextPage = 1) => {
        const query = new URLSearchParams();

        if (next.state !== 'pending')
            query.set('state', next.state);

        if (next.kind)
            query.set('kind', next.kind);

        if (next.plugin)
            query.set('plugin', next.plugin);

        if (nextPage > 1)
            query.set('page', String(nextPage));

        setParams(query);
    };

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();
        go({ ...filter, kind: kind.trim() });
    };

    return (
        <>
            <PageHeader
                title="Approvals"
                description={approvals.data ? `${plural(approvals.data.pending, 'request')} waiting for a yes` : 'What assistants, agents and plugins asked to do'}
            />
            <PageBody>
                <Panel className="overflow-clip">
                    <ListToolbar
                        watch={[ filter.state, filter.kind, filter.plugin, page ]}
                        page={{
                            offset: (page - 1) * pageSize,
                            limit: pageSize,
                            total: approvals.data?.total,
                            onChange: offset => go(filter, Math.floor(offset / pageSize) + 1),
                        }}
                    >
                        <Segmented label="Which requests" value={filter.state} onChange={state => go({ ...filter, state: state as ApprovalFilter['state'] })} options={STATES} />
                        <form onSubmit={handleSubmit} className="flex min-w-0 flex-1 items-center gap-2">
                            <SearchInput
                                value={kind}
                                onValueChange={setKind}
                                placeholder="Kind (mcp.tool)"
                                aria-label="Kind"
                                className="min-w-40 flex-1 sm:max-w-56"
                            />
                            {(filter.kind || filter.plugin) && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    icon={<X />}
                                    onClick={() => {
                                        setKind('');
                                        go({ ...filter, kind: '', plugin: '' });
                                    }}
                                >
                                    Clear
                                </Button>
                            )}
                        </form>
                    </ListToolbar>

                    {approvals.error && <div className="p-4"><ErrorNotice error={approvals.error} /></div>}
                    {approvals.isPending && <Loading />}
                    {approvals.data && (entries.length === 0
                        ? (
                                <EmptyState>
                                    {filter.state === 'pending' && !filter.kind && !filter.plugin
                                        ? 'Nothing waits for a yes. What assistants, agents and plugins ask to do shows here as they ask.'
                                        : 'No request here.'}
                                </EmptyState>
                            )
                        : (
                                <div className={cx('transition-opacity', approvals.isFetching && 'opacity-60')}>
                                    <RowList
                                        columns="max-content minmax(0,2fr) minmax(0,9rem) minmax(0,1fr) max-content"
                                        headers={[ { label: 'Asked' }, { label: 'What' }, { label: 'Kind' }, { label: 'By' }, { label: 'State' } ]}
                                    >
                                        {entries.map(approval => (
                                            <Row key={approval.id}>
                                                <span className="text-xs whitespace-nowrap text-muted sm:text-sm" title={formatDateTime(approval.requestedAtUtc)}>
                                                    {fromNow(approval.requestedAtUtc)}
                                                </span>
                                                <Link to={`/approvals/${approval.id}`} className="basis-full truncate font-medium hover:text-accent sm:basis-auto">{approval.summary}</Link>
                                                <span className="min-w-0 truncate font-mono text-xs">
                                                    <button type="button" className="hover:text-accent" onClick={() => go({ ...filter, kind: approval.kind })}>{approval.kind}</button>
                                                    {approval.plugin && (
                                                        <button type="button" className="block truncate text-muted hover:text-accent" onClick={() => go({ ...filter, plugin: approval.plugin! })}>{approval.plugin}</button>
                                                    )}
                                                </span>
                                                <span className="min-w-0 truncate">
                                                    <PhoneLabel>by </PhoneLabel>
                                                    <Requester approval={approval} linked={linked} />
                                                </span>
                                                <span className="flex items-center gap-1 max-sm:ml-auto">
                                                    <ApprovalBadge approval={approval} />
                                                    {approval.canDecide && <Badge tone="accent">yours to decide</Badge>}
                                                </span>
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

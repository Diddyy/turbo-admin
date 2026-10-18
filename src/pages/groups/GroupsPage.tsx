import { type FormEvent, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { GROUP_TYPES, useGroups } from '#/api/content';
import { ListToolbar } from '#/components/ListToolbar';
import { SearchInput } from '#/components/SearchInput';
import { Button, EmptyState, ErrorNotice, Loading, PageBody, PageHeader, Panel, Td, Th } from '#/components/ui';
import { useHubTabs } from '#/layout/nav';
import { cx } from '#/lib/cx';
import { fromNow } from '#/lib/time';
import { formatDateTime } from '#/pages/rooms/labels';

/**
 * Every group, newest first, found by name, owner, group or home room id. The search lives in
 * the address, so a search can be shared, and Back from a group returns to it.
 */
export const GroupsPage = () => {
    const [ params, setParams ] = useSearchParams();
    const text = params.get('q') ?? '';
    const page = Math.max(1, Number(params.get('page')) || 1);
    const [ draft, setDraft ] = useState(text);
    const search = useGroups(text, page - 1);
    const size = search.data?.pageSize ?? 1;
    const tabs = useHubTabs('groups');

    const go = (next: { q?: string; page?: number }) =>
        setParams({ q: next.q ?? text, page: String(next.page ?? page) });

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();
        go({ q: draft.trim(), page: 1 });
    };

    return (
        <>
            <PageHeader
                title="Groups"
                tabs={tabs}
                description={search.data
                    ? `${search.data.total.toLocaleString()} ${search.data.total === 1 ? 'group' : 'groups'}${text ? ` matching "${text}"` : ', newest first'}`
                    : 'Every group in the hotel'}
            />
            <PageBody>
                <Panel className="overflow-clip">
                    <ListToolbar
                        watch={[ text, page ]}
                        page={{
                            offset: (page - 1) * size,
                            limit: size,
                            total: search.data?.total,
                            onChange: offset => go({ page: Math.floor(offset / size) + 1 }),
                        }}
                    >
                        <form onSubmit={handleSubmit} className="flex min-w-0 flex-1 flex-wrap gap-2">
                            <SearchInput
                                value={draft}
                                onValueChange={setDraft}
                                placeholder="Name, owner, group or room id"
                                aria-label="Find groups"
                                className="min-w-48 flex-1 sm:max-w-80"
                            />
                            <Button type="submit">Search</Button>
                        </form>
                    </ListToolbar>

                    {search.error && <div className="p-4"><ErrorNotice error={search.error} /></div>}
                    {search.isPending && <Loading />}
                    {search.data && (
                        search.data.groups.length === 0
                            ? <EmptyState>No group matches.</EmptyState>
                            : (
                                    <div className={cx('transition-opacity', search.isFetching && 'opacity-60')}>
                                        {/* A phone: one tappable row per group. */}
                                        <ul className="sm:hidden">
                                            {search.data.groups.map(group => (
                                                <li key={group.id} className="border-t border-line first:border-t-0">
                                                    <Link to={`/groups/${group.id}`} className="flex min-h-16 items-center gap-3 px-4 py-2.5 active:bg-subtle">
                                                        <div className="min-w-0 flex-1">
                                                            <div className="truncate font-medium">{group.name}</div>
                                                            <div className="truncate font-mono text-[11px] text-muted">#{group.id} · {group.ownerName} · {(GROUP_TYPES[group.type] ?? String(group.type)).toLowerCase()}</div>
                                                        </div>
                                                        <span className="shrink-0 font-mono text-sm tabular-nums">{group.members}</span>
                                                    </Link>
                                                </li>
                                            ))}
                                        </ul>
                                        <div className="hidden overflow-x-auto sm:block">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr>
                                                        <Th>Group</Th>
                                                        <Th>Owner</Th>
                                                        <Th>Home room</Th>
                                                        <Th>Kind</Th>
                                                        <Th className="text-right">Members</Th>
                                                        <Th>Created</Th>
                                                    </tr>
                                                </thead>
                                                <tbody className="[&>tr:last-child>td]:border-b-0">
                                                    {search.data.groups.map(group => (
                                                        <tr key={group.id} className="hover:bg-subtle/60">
                                                            <Td>
                                                                <Link to={`/groups/${group.id}`} className="font-medium hover:text-accent">{group.name}</Link>
                                                                <span className="ml-2 font-mono text-[11px] text-muted">#{group.id}</span>
                                                            </Td>
                                                            <Td><Link to={`/players/${group.ownerId}`} className="text-muted hover:text-accent">{group.ownerName}</Link></Td>
                                                            <Td><Link to={`/rooms/${group.roomId}`} className="text-muted hover:text-accent">{group.roomName}</Link></Td>
                                                            <Td>{GROUP_TYPES[group.type] ?? group.type}</Td>
                                                            <Td className="text-right font-mono tabular-nums">{group.members.toLocaleString()}</Td>
                                                            <Td className="text-muted"><span title={formatDateTime(group.createdAt)}>{fromNow(group.createdAt)}</span></Td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )
                    )}
                </Panel>
            </PageBody>
        </>
    );
};

import { type FormEvent, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { GROUP_TYPES, useGroups } from '#/api/content';
import { ListToolbar } from '#/components/ListToolbar';
import { SearchInput } from '#/components/SearchInput';
import { PhoneSort } from '#/components/SortHeader';
import { Button, EmptyState, ErrorNotice, Loading, PageBody, PageHeader, Panel, Td, Th } from '#/components/ui';
import { useHubTabs } from '#/layout/nav';
import { cx } from '#/lib/cx';
import { type ListOrder, orderOf, orderParams, pageOf, type Sorting } from '#/lib/sort';
import { fromNow } from '#/lib/time';
import { formatDateTime } from '#/pages/rooms/labels';

/** The columns the list sorts by, as the server names them. */
const SORT_COLUMNS = [
    { label: 'Group', sort: 'name' },
    { label: 'Owner', sort: 'owner' },
    { label: 'Home room', sort: 'room' },
    { label: 'Kind', sort: 'kind' },
    { label: 'Members', sort: 'members', first: 'desc' },
    { label: 'Created', sort: 'created', first: 'desc' },
] as const;

/**
 * Every group, newest first unless sorted otherwise, found by name, owner, group or home room id.
 * The search and its order live in the address, so a search can be shared, and Back from a group
 * returns to it.
 */
export const GroupsPage = () => {
    const [ params, setParams ] = useSearchParams();
    const text = params.get('q') ?? '';
    const page = pageOf(params);
    const order = orderOf(params);
    const [ draft, setDraft ] = useState(text);
    const search = useGroups(text, page - 1, order);
    const size = search.data?.pageSize ?? 1;
    const tabs = useHubTabs('groups');

    const go = (next: { q?: string; page?: number }, nextOrder: ListOrder | null = order) =>
        setParams({ q: next.q ?? text, page: String(next.page ?? page), ...orderParams(nextOrder) });

    const sorting: Sorting = { order: order ?? search.data?.order, onSort: next => go({ page: 1 }, next) };

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
                    ? `${search.data.total.toLocaleString()} ${search.data.total === 1 ? 'group' : 'groups'}${text ? ` matching "${text}"` : ''}`
                    : 'Every group in the hotel'}
            />
            <PageBody>
                <Panel className="overflow-clip">
                    <ListToolbar
                        watch={[ text, page, order ]}
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
                                        <PhoneSort columns={[ ...SORT_COLUMNS ]} sorting={sorting} />
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
                                                        <Th sort="name" sorting={sorting}>Group</Th>
                                                        <Th sort="owner" sorting={sorting}>Owner</Th>
                                                        <Th sort="room" sorting={sorting}>Home room</Th>
                                                        <Th sort="kind" sorting={sorting}>Kind</Th>
                                                        <Th className="text-right" sort="members" first="desc" sorting={sorting}>Members</Th>
                                                        <Th sort="created" first="desc" sorting={sorting}>Created</Th>
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

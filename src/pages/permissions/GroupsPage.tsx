import { Plus } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { groupCalls, type GroupListItem, useGroups, usePermissionChange } from '#/api/permissions';
import { PhoneLabel, Row, SortedRowList } from '#/components/RowList';
import { Badge, Button, EmptyState, ErrorNotice, Field, Loading, PageBody, Panel } from '#/components/ui';
import { cx } from '#/lib/cx';
import type { SortKeys } from '#/lib/sort';

import { PermissionsHeader } from './common';

const GROUP_COLUMNS = [
    { label: 'Group', sort: 'name' },
    { label: 'Weight', className: 'text-right', sort: 'weight', first: 'desc' as const },
    { label: 'Inherits', sort: 'inherits' },
    { label: 'Nodes', className: 'text-right', sort: 'nodes', first: 'desc' as const },
    { label: 'Meta', className: 'text-right', sort: 'meta', first: 'desc' as const },
];

const GROUP_KEYS: SortKeys<GroupListItem> = {
    name: x => x.displayName,
    weight: x => x.weight,
    inherits: x => x.parents.join(', '),
    nodes: x => x.nodeCount,
    meta: x => x.metaCount,
};

const NewGroup = ({ maxWeight }: { maxWeight: number }) => {
    const navigate = useNavigate();
    const create = usePermissionChange(groupCalls('').create);
    const [ name, setName ] = useState('');
    const [ displayName, setDisplayName ] = useState('');
    const [ weight, setWeight ] = useState('0');

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();

        const key = name.trim().toLowerCase();

        create.mutate([ { name: key, displayName: displayName.trim(), weight: Number(weight) } ], {
            onSuccess: () => navigate(`/permissions/groups/${encodeURIComponent(key)}`),
        });
    };

    return (
        <Panel title="New group" description={`Its weight must be below ${maxWeight}, your heaviest group's.`}>
            <form onSubmit={handleSubmit} className="space-y-3 p-4">
                {create.error && <ErrorNotice error={create.error} />}
                <Field
                    label="Name"
                    name="group-name"
                    value={name}
                    onChange={event => setName(event.target.value)}
                    placeholder="events_lead"
                    hint="The key, for good: lowercase letters, digits and _."
                    required
                />
                <Field label="Display name" name="group-display" value={displayName} onChange={event => setDisplayName(event.target.value)} placeholder="Events lead" />
                <Field
                    label="Weight"
                    name="group-weight"
                    type="number"
                    value={weight}
                    onChange={event => setWeight(event.target.value)}
                    max={maxWeight - 1}
                    hint="Higher wins when two groups disagree."
                    required
                />
                <Button type="submit" icon={<Plus />} disabled={create.isPending || name.trim() === ''}>Create group</Button>
            </form>
        </Panel>
    );
};

/** Every group, heaviest first, and making a new one. */
export const GroupsPage = () => {
    const { data, error, isPending } = useGroups();

    return (
        <>
            <PermissionsHeader
                section="groups"
                description={data ? `${data.groups.length} groups. Players reach a group directly or through its children.` : 'Groups and what they hold'}
            />
            <PageBody className="grid gap-4 lg:gap-5 xl:grid-cols-[1fr_20rem]">
                {error && <ErrorNotice error={error} />}
                {isPending && <Loading />}
                {data && (
                    <>
                        <Panel className="overflow-hidden">
                            {data.groups.length === 0
                                ? <EmptyState>There are no groups.</EmptyState>
                                : (
                                        <SortedRowList
                                            columns="minmax(0,1fr) 4rem minmax(0,1fr) 4rem 4rem"
                                            headers={GROUP_COLUMNS}
                                            rows={data.groups}
                                            keys={GROUP_KEYS}
                                            initial={{ sort: 'weight', dir: 'desc' }}
                                        >
                                            {group => (
                                                <Row key={group.id} className="text-muted sm:text-ink">
                                                    <span>
                                                        <Link to={`/permissions/groups/${encodeURIComponent(group.name)}`} className="font-medium text-ink hover:text-accent">
                                                            {group.displayName}
                                                        </Link>
                                                        <span className="ml-2 font-mono text-xs text-muted">{group.name}</span>
                                                        {data.canManage && !group.canEdit && <Badge className="ml-2">read-only</Badge>}
                                                    </span>
                                                    <span className="text-xs tabular-nums sm:text-right sm:text-sm"><PhoneLabel>weight </PhoneLabel>{group.weight}</span>
                                                    <span className={cx('text-xs sm:text-sm sm:text-muted', group.parents.length === 0 && 'max-sm:hidden')}>
                                                        {group.parents.length > 0 ? <><PhoneLabel>inherits </PhoneLabel>{group.parents.join(', ')}</> : '-'}
                                                    </span>
                                                    <span className="text-xs tabular-nums sm:text-right sm:text-sm">{group.nodeCount}<PhoneLabel>{group.nodeCount === 1 ? ' node' : ' nodes'}</PhoneLabel></span>
                                                    <span className="text-xs tabular-nums sm:text-right sm:text-sm">{group.metaCount}<PhoneLabel> meta</PhoneLabel></span>
                                                </Row>
                                            )}
                                        </SortedRowList>
                                    )}
                        </Panel>
                        {data.canManage && data.yourWeight > 0 && <div><NewGroup maxWeight={data.yourWeight} /></div>}
                    </>
                )}
            </PageBody>
        </>
    );
};

import { Plus, Save, Trash2, X } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { groupCalls, type GroupResponse, useGroup, useGroupAudit, useGroupMembers, useGroups, usePermissionChange } from '#/api/permissions';
import { ask } from '#/components/confirm';
import { TabbedPanel } from '#/components/TabbedPanel';
import { Badge, Button, EmptyState, ErrorNotice, Field, Loading, PageBody, Panel, Select } from '#/components/ui';

import { MetaCard, NodesCard } from './AssignmentCards';
import { AuditTable, Expiry, PermissionsHeader, UnsetButton } from './common';
import { LevelCard } from './LevelCard';

/** The group's display name and weight, and deleting it. */
const SettingsCard = ({ group }: { group: GroupResponse }) => {
    const navigate = useNavigate();
    const calls = groupCalls(group.name);
    const update = usePermissionChange(calls.update);
    const remove = usePermissionChange(calls.delete);
    const [ displayName, setDisplayName ] = useState(group.displayName);
    const [ weight, setWeight ] = useState(String(group.weight));
    const dirty = displayName.trim() !== group.displayName || Number(weight) !== group.weight;

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();
        update.mutate([ { displayName: displayName.trim(), weight: Number(weight) } ]);
    };

    const handleDelete = () => {
        ask({ title: `Delete the group ${group.name}?`, body: 'Its members leave it, and its nodes, meta and parents go with it.', confirm: 'Delete' }, () => {
            remove.mutate([], { onSuccess: () => navigate('/permissions/groups') });
        });
    };

    return (
        <Panel title="Settings">
            <form onSubmit={handleSubmit} className="space-y-3 p-4">
                {(update.error ?? remove.error) && <ErrorNotice error={update.error ?? remove.error} />}
                <Field label="Display name" name="display-name" value={displayName} onChange={event => setDisplayName(event.target.value)} required />
                <Field
                    label="Weight"
                    name="weight"
                    type="number"
                    value={weight}
                    onChange={event => setWeight(event.target.value)}
                    hint="Higher wins when two groups disagree."
                    required
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <Button type="submit" icon={<Save />} disabled={!dirty || update.isPending}>Save</Button>
                    {!group.isDefault && (
                        <Button variant="ghost" icon={<Trash2 />} onClick={handleDelete} disabled={remove.isPending} className="text-bad hover:text-bad">
                            Delete group
                        </Button>
                    )}
                </div>
            </form>
        </Panel>
    );
};

/** What the group inherits from. Inheriting a group hands out all it holds, so only lighter ones. */
const ParentsCard = ({ group }: { group: GroupResponse }) => {
    const calls = groupCalls(group.name);
    const add = usePermissionChange(calls.addParent);
    const removeParent = usePermissionChange(calls.removeParent);
    const groups = useGroups();
    const [ parent, setParent ] = useState('');
    const choices = (groups.data?.groups ?? []).filter(x =>
        x.name !== group.name && x.canEdit && !group.parents.some(p => p.name === x.name));

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();
        add.mutate([ parent ], { onSuccess: () => setParent('') });
    };

    return (
        <Panel title="Inherits from" description="Members also hold everything these groups hold.">
            {group.parents.length === 0
                ? <EmptyState>Nothing: it holds only its own nodes.</EmptyState>
                : (
                        <ul className="divide-y divide-line text-sm">
                            {group.parents.map(p => (
                                <li key={p.name} className="flex items-center justify-between gap-2 px-4 py-2">
                                    <span>
                                        <Link to={`/permissions/groups/${encodeURIComponent(p.name)}`} className="font-medium hover:text-accent">{p.displayName}</Link>
                                        <span className="ml-2 text-xs text-muted">weight {p.weight}</span>
                                    </span>
                                    {group.canEdit && (
                                        <UnsetButton
                                            label={`Stop inheriting ${p.name}`}
                                            icon={<X />}
                                            disabled={removeParent.isPending}
                                            onClick={() => ask({ title: `Remove ${p.displayName} from what ${group.displayName} inherits?`, body: 'Whatever it gave this group goes with it.', confirm: 'Remove' }, () => removeParent.mutate([ p.name ]))}
                                        />
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
            {group.canEdit && choices.length > 0 && (
                <form onSubmit={handleSubmit} className="flex gap-2 border-t border-line p-4">
                    <Select value={parent} onChange={event => setParent(event.target.value)} aria-label="Group to inherit" className="min-w-0 flex-1">
                        <option value="">Choose a group</option>
                        {choices.map(x => <option key={x.name} value={x.name}>{x.displayName} ({x.weight})</option>)}
                    </Select>
                    <Button type="submit" icon={<Plus />} disabled={parent === '' || add.isPending}>Inherit</Button>
                </form>
            )}
            {(add.error ?? removeParent.error) && <div className="px-4 pb-3"><ErrorNotice error={add.error ?? removeParent.error} /></div>}
            {group.children.length > 0 && (
                <p className="border-t border-line px-4 py-3 text-xs text-muted">
                    Inherited by
                    {' '}
                    {group.children.map((child, index) => (
                        <span key={child.name}>
                            {index > 0 && ', '}
                            <Link to={`/permissions/groups/${encodeURIComponent(child.name)}`} className="text-ink hover:text-accent">{child.displayName}</Link>
                        </span>
                    ))}
                </p>
            )}
        </Panel>
    );
};

const Members = ({ name, isDefault }: { name: string; isDefault: boolean }) => {
    const members = useGroupMembers(name);

    if (isDefault)
        return <EmptyState>Every player holds default, without being added.</EmptyState>;

    if (members.isPending)
        return <Loading />;

    if (members.error)
        return <div className="p-4"><ErrorNotice error={members.error} /></div>;

    return members.data.length === 0
        ? <EmptyState>Nobody is in this group directly.</EmptyState>
        : (
                <ul className="divide-y divide-line text-sm">
                    {members.data.map(member => (
                        <li key={member.id} className="flex items-center justify-between gap-2 px-4 py-2">
                            <Link to={`/permissions/players/${member.id}`} className="hover:text-accent">{member.name}</Link>
                            <Expiry at={member.expiresAtUtc} />
                        </li>
                    ))}
                </ul>
            );
};

const GroupHistory = ({ name }: { name: string }) => {
    const audit = useGroupAudit(name);

    if (audit.isPending)
        return <Loading />;

    return audit.error ? <div className="p-4"><ErrorNotice error={audit.error} /></div> : <AuditTable entries={audit.data} showTarget={false} />;
};

/** One group: what it holds, what it inherits, who is in it, and its history. */
export const GroupPage = () => {
    const name = useParams().name ?? '';
    const { data: group, error, isPending } = useGroup(name);

    return (
        <>
            <PermissionsHeader
                section="groups"
                title={group?.displayName ?? name}
                back={{ to: '/permissions/groups', label: 'Groups' }}
                description={group && `${group.name}, weight ${group.weight}`}
            >
                {group && !group.canEdit && <Badge>Read-only</Badge>}
            </PermissionsHeader>
            <PageBody>
                {isPending && <Loading />}
                {error && <ErrorNotice error={error} />}
                {group && (
                    <div className="grid gap-5 xl:grid-cols-[22rem_1fr]">
                        <div className="grid content-start gap-5">
                            {group.canEdit && <SettingsCard key={`${group.displayName}|${group.weight}`} group={group} />}
                            <ParentsCard group={group} />
                            <LevelCard level={group.level} who="a member" />
                        </div>
                        <div className="grid min-w-0 content-start gap-5">
                            <NodesCard target={{ kind: 'group', name: group.name }} nodes={group.nodes} canEdit={group.canEdit} />
                            <MetaCard target={{ kind: 'group', name: group.name }} meta={group.meta} canEdit={group.canEdit} />
                            <TabbedPanel
                                tabs={[
                                    { id: 'members', label: 'Members', content: <Members name={group.name} isDefault={group.isDefault} /> },
                                    { id: 'history', label: 'History', content: <GroupHistory name={group.name} /> },
                                ]}
                            />
                        </div>
                    </div>
                )}
            </PageBody>
        </>
    );
};

import { Eraser, MessagesSquare, Save, Trash2, UserMinus } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { FORUM_PERMISSIONS, GROUP_RANKS, GROUP_TYPES, type GroupDetail, type GroupForum, type GroupForumSettings, useCanManageContent, useGroup, useGroupAction } from '#/api/content';
import { ask } from '#/components/confirm';
import { Badge, Button, EmptyState, ErrorNotice, IconButton, Input, Kv, Labeled, Loading, PageBody, PageHeader, Panel, Select, Stat, SuccessNotice, Textarea } from '#/components/ui';
import { fromNow } from '#/lib/time';
import { formatDateTime } from '#/pages/rooms/labels';

type Act = ReturnType<typeof useGroupAction>;

/** The group's name and description, saved through its grain as its owner's change would be. */
const RenameForm = ({ group, canManage, act }: { group: GroupDetail; canManage: boolean; act: Act }) => {
    const [ name, setName ] = useState(group.name);
    const [ description, setDescription ] = useState(group.description);
    const changed = name !== group.name || description !== group.description;

    return (
        <Panel title="Name and description">
            <form
                className="flex flex-col gap-3 p-4"
                onSubmit={(event) => {
                    event.preventDefault();
                    act.mutate({ id: group.id, rename: { name, description } });
                }}
            >
                <Labeled label="Name"><Input value={name} onChange={event => setName(event.target.value)} disabled={!canManage} /></Labeled>
                <Labeled label="Description"><Textarea value={description} onChange={event => setDescription(event.target.value)} rows={3} disabled={!canManage} /></Labeled>
                {canManage && <div><Button type="submit" icon={<Save />} disabled={!changed || act.isPending}>Save</Button></div>}
            </form>
        </Panel>
    );
};

/** Each forum setting: its words, and the lowest it may be (the one before it, as the forum's settings window builds them). */
const FORUM_FIELDS: { key: keyof GroupForumSettings; label: string; lowest: (draft: GroupForumSettings) => number }[] = [
    { key: 'readPermission', label: 'Who may read', lowest: () => 0 },
    { key: 'postMessagePermission', label: 'Who may post messages', lowest: draft => draft.readPermission },
    { key: 'postThreadPermission', label: 'Who may start threads', lowest: draft => draft.postMessagePermission },
    { key: 'moderatePermission', label: 'Who may moderate', lowest: () => 2 },
];

const settingsOf = (forum: GroupForum): GroupForumSettings => ({
    readPermission: forum.readPermission,
    postMessagePermission: forum.postMessagePermission,
    postThreadPermission: forum.postThreadPermission,
    moderatePermission: forum.moderatePermission,
});

/**
 * The group's forum: whether it has one, how busy it is, and who may read, post, start threads
 * and moderate - set through the forum, as its owner's settings window would.
 */
const ForumPanel = ({ group, canManage, act }: { group: GroupDetail; canManage: boolean; act: Act }) => {
    const forum = group.forum;
    const [ draft, setDraft ] = useState<GroupForumSettings | null>(forum && settingsOf(forum));

    if (!forum || !draft)
        return (
            <Panel title={<span className="flex items-center gap-2"><MessagesSquare className="size-4" />Forum</span>}>
                <EmptyState>No forum: its owner opens one by buying a forum terminal for the group.</EmptyState>
            </Panel>
        );

    // A lower setting lifts the ones after it that would allow more than it.
    const set = (key: keyof GroupForumSettings, value: number) => setDraft((current) => {
        const next = { ...current!, [key]: value };

        next.postMessagePermission = Math.max(next.postMessagePermission, next.readPermission);
        next.postThreadPermission = Math.max(next.postThreadPermission, next.postMessagePermission);

        return next;
    });
    const changed = JSON.stringify(draft) !== JSON.stringify(settingsOf(forum));

    return (
        <Panel
            title={<span className="flex items-center gap-2"><MessagesSquare className="size-4" />Forum</span>}
            description={`${forum.threadCount.toLocaleString()} threads, ${forum.messageCount.toLocaleString()} messages${forum.lastMessageAt ? `, the last ${fromNow(forum.lastMessageAt)}` : ''}`}
        >
            <form
                className="flex flex-col gap-3 p-4"
                onSubmit={(event) => {
                    event.preventDefault();
                    act.mutate({ id: group.id, forum: draft });
                }}
            >
                {FORUM_FIELDS.map(field => (
                    <Labeled key={field.key} label={field.label}>
                        <Select value={String(draft[field.key])} onChange={event => set(field.key, Number(event.target.value))} disabled={!canManage}>
                            {Object.entries(FORUM_PERMISSIONS).filter(([ value ]) => Number(value) >= field.lowest(draft)).map(([ value, label ]) => <option key={value} value={value}>{label}</option>)}
                        </Select>
                    </Labeled>
                ))}
                {canManage && <div><Button type="submit" icon={<Save />} disabled={!changed || act.isPending}>Save</Button></div>}
            </form>
        </Panel>
    );
};

/**
 * One group as staff fix it: renamed, its badge put back, members taken out, or deleted - each
 * through the group's own grain, as its owner's change would be.
 */
export const GroupPage = () => {
    const id = Number(useParams().id);
    const navigate = useNavigate();
    const { data: group, error, isPending } = useGroup(id);
    const canManage = useCanManageContent();
    const act = useGroupAction();

    const members = group?.members.filter(x => x.rank <= 2) ?? [];
    const requests = group?.members.filter(x => x.rank === 3).length ?? 0;
    const blocked = group?.members.filter(x => x.rank === 4).length ?? 0;

    return (
        <>
            <PageHeader
                title={group?.name ?? `Group #${id}`}
                back={{ to: '/groups', label: 'Groups' }}
                description={group && `#${group.id} · ${(GROUP_TYPES[group.type] ?? String(group.type)).toLowerCase()} · created ${fromNow(group.createdAt)}`}
            >
                {group && canManage && (
                    <>
                        <Button
                            variant="ghost"
                            icon={<Eraser />}
                            disabled={act.isPending}
                            onClick={() => ask({ title: `Put ${group.name}'s badge back to the default one?`, confirm: 'Reset badge' }, () => act.mutate({ id, resetBadge: true }))}
                        >
                            Reset badge
                        </Button>
                        <Button
                            variant="ghost"
                            icon={<Trash2 />}
                            className="text-bad hover:text-bad"
                            disabled={act.isPending}
                            onClick={() => ask(
                                {
                                    title: `Delete ${group.name}?`,
                                    body: `Its ${members.length} members are told, and its home room's group furni goes back to their owners.`,
                                    confirm: 'Delete',
                                },
                                () => act.mutate({ id, remove: true }, { onSuccess: () => navigate('/groups') }),
                            )}
                        >
                            Delete
                        </Button>
                    </>
                )}
            </PageHeader>
            <PageBody className="flex flex-col gap-4 lg:gap-5">
                {isPending && <Loading />}
                {error && <ErrorNotice error={error} />}
                {act.isSuccess && <SuccessNotice>Done: the owner's group window and the home room show it now.</SuccessNotice>}
                {act.error && <ErrorNotice error={act.error} />}
                {group && (
                    <>
                        <section aria-label="Members" className="grid grid-cols-3 gap-3">
                            <Stat label="Members" value={members.length.toLocaleString()} />
                            <Stat label="Requests" value={requests.toLocaleString()} />
                            <Stat label="Blocked" value={blocked.toLocaleString()} />
                        </section>

                        <div className="flex flex-wrap items-start gap-4 lg:gap-5">
                            <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-4 max-lg:order-1 max-lg:w-full lg:gap-5">
                                <Panel title={`Members, requests and blocks${group.members.length >= 500 ? ', the first 500' : ''}`}>
                                    {group.members.length === 0
                                        ? <EmptyState>No one.</EmptyState>
                                        : (
                                                <ul>
                                                    {group.members.map(member => (
                                                        <li key={member.playerId} className="flex min-h-12 items-center gap-3 border-t border-line px-4 py-2 first:border-t-0">
                                                            <Link to={`/players/${member.playerId}`} className="min-w-0 flex-1 truncate text-sm font-medium hover:text-accent">{member.name}</Link>
                                                            <Badge tone={member.rank === 0 ? 'accent' : member.rank >= 3 ? 'neutral' : 'green'}>{GROUP_RANKS[member.rank] ?? member.rank}</Badge>
                                                            {canManage && member.rank !== 0 && (
                                                                <IconButton
                                                                    label={`Take ${member.name} out`}
                                                                    icon={<UserMinus />}
                                                                    tone="bad"
                                                                    disabled={act.isPending}
                                                                    onClick={() => ask({ title: `Take ${member.name} out of ${group.name}?`, confirm: 'Take out' }, () => act.mutate({ id, removeMember: member.playerId }))}
                                                                />
                                                            )}
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                </Panel>
                            </div>

                            <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-4 max-lg:contents lg:gap-5">
                                <div className="min-w-0 max-lg:order-first max-lg:w-full">
                                    {/* Keyed by what was saved, so a save or another's change shows in the fields. */}
                                    <RenameForm key={`${group.name}\n${group.description}`} group={group} canManage={canManage} act={act} />
                                </div>
                                <div className="min-w-0 max-lg:w-full">
                                    <ForumPanel key={JSON.stringify(group.forum)} group={group} canManage={canManage} act={act} />
                                </div>
                                <Panel title="Group" className="max-lg:order-first max-lg:w-full">
                                    <dl>
                                        <Kv label="Owner"><Link to={`/players/${group.ownerId}`} className="text-accent hover:underline">{group.ownerName}</Link></Kv>
                                        <Kv label="Home room"><Link to={`/rooms/${group.roomId}`} className="text-accent hover:underline">{group.roomName}</Link></Kv>
                                        <Kv label="Kind">{GROUP_TYPES[group.type] ?? group.type}</Kv>
                                        <Kv label="Badge" mono><span className="select-all">{group.badgeCode}</span></Kv>
                                        <Kv label="Created">{formatDateTime(group.createdAt)}</Kv>
                                    </dl>
                                </Panel>
                            </div>
                        </div>
                    </>
                )}
            </PageBody>
        </>
    );
};

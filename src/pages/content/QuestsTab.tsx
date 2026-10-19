import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { type QuestCampaign, type QuestCampaignInput, type QuestInput, type QuestItem, useCampaignChange, useQuestItemChange, useQuests } from '#/api/quests';
import { ask } from '#/components/confirm';
import { toast, toastError } from '#/components/toast';
import { Badge, Button, EmptyState, ErrorNotice, IconButton, Input, Labeled, Loading, Panel, Switch } from '#/components/ui';
import { plural } from '#/lib/plural';
import { formatDateTime } from '#/pages/rooms/labels';

/** A date for an input of type datetime-local, in UTC, and back. */
const toInput = (utc: string | null) => (utc ? utc.slice(0, 16) : '');
const fromInput = (value: string) => (value ? `${value}:00Z` : null);

const CampaignForm = ({ start, busy, onSave, onCancel }: { start: QuestCampaignInput; busy: boolean; onSave: (input: QuestCampaignInput) => void; onCancel: () => void }) => {
    const [ draft, setDraft ] = useState(start);

    return (
        <form
            className="flex flex-col gap-3 border-t border-line bg-subtle/40 px-4 py-4"
            onSubmit={(event) => {
                event.preventDefault();
                onSave({ ...draft, code: draft.code.trim() });
            }}
        >
            <div className="grid gap-3 sm:grid-cols-3">
                <Labeled label="Code" hint="Names the client's quests.<code>.name and images.">
                    <Input value={draft.code} onChange={event => setDraft({ ...draft, code: event.target.value })} maxLength={64} spellCheck={false} className="w-full font-mono" required />
                </Labeled>
                <Labeled label="Order">
                    <Input type="number" value={draft.sortOrder} onChange={event => setDraft({ ...draft, sortOrder: Number(event.target.value) })} className="w-full font-mono" />
                </Labeled>
                <Labeled label="Ends (UTC)" hint="Empty for one that never ends; set, the quest window shows its time left.">
                    <Input type="datetime-local" value={toInput(draft.endsAtUtc)} onChange={event => setDraft({ ...draft, endsAtUtc: fromInput(event.target.value) })} className="w-full font-mono" />
                </Labeled>
            </div>
            <Switch label="On" hint="Off, players don't see it." checked={draft.enabled} onChange={enabled => setDraft({ ...draft, enabled })} />
            <div className="flex flex-wrap gap-2 max-sm:flex-col-reverse">
                <Button variant="secondary" onClick={onCancel}>Cancel</Button>
                <Button type="submit" disabled={busy || draft.code.trim() === ''}>Save</Button>
            </div>
        </form>
    );
};

const QuestForm = ({ start, counted, busy, onSave, onCancel }: { start: QuestInput; counted: string[]; busy: boolean; onSave: (input: QuestInput) => void; onCancel: () => void }) => {
    const [ draft, setDraft ] = useState(start);
    const set = (change: Partial<QuestInput>) => setDraft({ ...draft, ...change });

    return (
        <form
            className="flex flex-col gap-3 border-t border-line bg-subtle/40 px-4 py-4"
            onSubmit={(event) => {
                event.preventDefault();
                onSave({ ...draft, localizationCode: draft.localizationCode.trim(), type: draft.type.trim() });
            }}
        >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Labeled label="Code" hint="Names quests.<campaign>.<code>.* texts.">
                    <Input value={draft.localizationCode} onChange={event => set({ localizationCode: event.target.value })} maxLength={64} spellCheck={false} className="w-full font-mono" required />
                </Labeled>
                <Labeled label="Type" hint={counted.includes(draft.type) ? 'Counted by the server.' : 'Not counted by the server: it never moves.'}>
                    <Input value={draft.type} onChange={event => set({ type: event.target.value.toUpperCase() })} list="quest-types" maxLength={64} spellCheck={false} className="w-full font-mono" required />
                </Labeled>
                <Labeled label="Target" hint="The one value that counts, e.g. a badge code.">
                    <Input value={draft.target} onChange={event => set({ target: event.target.value })} maxLength={128} spellCheck={false} className="w-full font-mono" />
                </Labeled>
                <Labeled label="Steps">
                    <Input type="number" min={1} value={draft.totalSteps} onChange={event => set({ totalSteps: Number(event.target.value) })} className="w-full font-mono" required />
                </Labeled>
                <Labeled label="Reward" hint="Points, 0 for none.">
                    <Input type="number" min={0} value={draft.rewardAmount} onChange={event => set({ rewardAmount: Number(event.target.value) })} className="w-full font-mono" />
                </Labeled>
                <Labeled label="Points number" hint="0 duckets, 5 diamonds.">
                    <Input type="number" min={0} value={draft.activityPointType} onChange={event => set({ activityPointType: Number(event.target.value) })} className="w-full font-mono" />
                </Labeled>
                <Labeled label="Order" hint="Quests are done in this order.">
                    <Input type="number" value={draft.sortOrder} onChange={event => set({ sortOrder: Number(event.target.value) })} className="w-full font-mono" />
                </Labeled>
                <Labeled label="Image version">
                    <Input value={draft.imageVersion} onChange={event => set({ imageVersion: event.target.value })} maxLength={16} className="w-full font-mono" />
                </Labeled>
                <Labeled label="Catalog page">
                    <Input value={draft.catalogPageName} onChange={event => set({ catalogPageName: event.target.value })} maxLength={64} className="w-full font-mono" />
                </Labeled>
                <Labeled label="Chain" hint="A seasonal quest's chain.">
                    <Input value={draft.chainCode} onChange={event => set({ chainCode: event.target.value })} maxLength={64} className="w-full font-mono" />
                </Labeled>
            </div>
            <datalist id="quest-types">{counted.map(x => <option key={x} value={x} />)}</datalist>
            <Switch label="Easy" hint="The daily quest widget's easy one." checked={draft.easy} onChange={easy => set({ easy })} />
            <div className="flex flex-wrap gap-2 max-sm:flex-col-reverse">
                <Button variant="secondary" onClick={onCancel}>Cancel</Button>
                <Button type="submit" disabled={busy || draft.localizationCode.trim() === '' || draft.type.trim() === ''}>Save</Button>
            </div>
        </form>
    );
};

const QuestRow = ({ quest, counted, canManage, editing, onEdit, onDone }: { quest: QuestItem; counted: string[]; canManage: boolean; editing: boolean; onEdit: () => void; onDone: () => void }) => {
    const { save, drop } = useQuestItemChange();

    return (
        <li>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                <span className="w-8 shrink-0 text-right font-mono text-xs text-muted">{quest.sortOrder}</span>
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-medium">{quest.localizationCode}</span>
                        <Badge tone={quest.counted ? 'neutral' : 'amber'}>{quest.type}</Badge>
                        {quest.easy && <Badge>easy</Badge>}
                    </div>
                    <div className="truncate text-xs text-muted">
                        {[
                            quest.target && `target ${quest.target}`,
                            plural(quest.totalSteps, 'step'),
                            quest.rewardAmount > 0 ? `${quest.rewardAmount} ${quest.activityPointType === 0 ? 'duckets' : `points ${quest.activityPointType}`}` : 'no reward',
                            `${quest.started.toLocaleString()} started, ${quest.completed.toLocaleString()} done`,
                        ].filter(Boolean).join(' · ')}
                    </div>
                    {!quest.counted && <div className="text-xs text-warn">The server counts no {quest.type} quest: players can take it, but it never moves.</div>}
                </div>
                {canManage && (
                    <div className="flex items-center gap-1">
                        <IconButton label={`Edit ${quest.localizationCode}`} icon={<Pencil />} onClick={onEdit} />
                        <IconButton
                            label={`Delete ${quest.localizationCode}`}
                            icon={<Trash2 />}
                            tone="bad"
                            disabled={drop.isPending}
                            onClick={() => ask(
                                { title: `Delete the quest ${quest.localizationCode}?`, body: quest.started > 0 ? `${plural(quest.started, 'player')} took it: their progress goes too.` : 'Nobody has taken it.', confirm: 'Delete' },
                                () => drop.mutate(quest.id, { onSuccess: () => toast(`Deleted ${quest.localizationCode}.`), onError: toastError }),
                            )}
                        />
                    </div>
                )}
            </div>
            {editing && (
                <QuestForm
                    start={quest}
                    counted={counted}
                    busy={save.isPending}
                    onSave={input => save.mutate({ id: quest.id, input }, {
                        onSuccess: () => {
                            toast(`Saved ${input.localizationCode}.`);
                            onDone();
                        },
                        onError: toastError,
                    })}
                    onCancel={onDone}
                />
            )}
        </li>
    );
};

const CampaignPanel = ({ campaign, counted, canManage }: { campaign: QuestCampaign; counted: string[]; canManage: boolean }) => {
    const campaigns = useCampaignChange();
    const quests = useQuestItemChange();
    const [ editing, setEditing ] = useState<number | 'campaign' | 'new' | null>(null);
    const last = campaign.quests[campaign.quests.length - 1];

    return (
        <Panel
            className="overflow-clip"
            title={campaign.code}
            description={[
                plural(campaign.quests.length, 'quest'),
                campaign.endsAtUtc ? `ends ${formatDateTime(campaign.endsAtUtc)}` : 'never ends',
                !campaign.enabled && 'off',
            ].filter(Boolean).join(' · ')}
            actions={canManage && (
                <div className="flex items-center gap-1">
                    <Button variant="secondary" icon={<Plus />} onClick={() => setEditing('new')}>Add quest</Button>
                    <IconButton label={`Edit ${campaign.code}`} icon={<Pencil />} onClick={() => setEditing(editing === 'campaign' ? null : 'campaign')} />
                    <IconButton
                        label={`Delete ${campaign.code}`}
                        icon={<Trash2 />}
                        tone="bad"
                        onClick={() => ask(
                            { title: `Delete the campaign ${campaign.code}?`, body: `Its ${plural(campaign.quests.length, 'quest')} and the players' progress on them go too. Turning it off keeps them.`, confirm: 'Delete' },
                            () => campaigns.drop.mutate(campaign.id, { onSuccess: () => toast(`Deleted ${campaign.code}.`), onError: toastError }),
                        )}
                    />
                </div>
            )}
        >
            {editing === 'campaign' && (
                <CampaignForm
                    start={campaign}
                    busy={campaigns.save.isPending}
                    onSave={input => campaigns.save.mutate({ id: campaign.id, input }, {
                        onSuccess: () => {
                            toast(`Saved ${input.code}.`);
                            setEditing(null);
                        },
                        onError: toastError,
                    })}
                    onCancel={() => setEditing(null)}
                />
            )}
            {editing === 'new' && (
                <QuestForm
                    start={{ campaignId: campaign.id, localizationCode: '', type: counted[0] ?? '', target: '', totalSteps: 1, activityPointType: 0, rewardAmount: 0, sortOrder: (last?.sortOrder ?? 0) + 1, imageVersion: '', catalogPageName: '', chainCode: '', easy: false }}
                    counted={counted}
                    busy={quests.save.isPending}
                    onSave={input => quests.save.mutate({ id: null, input }, {
                        onSuccess: () => {
                            toast(`Added ${input.localizationCode}.`);
                            setEditing(null);
                        },
                        onError: toastError,
                    })}
                    onCancel={() => setEditing(null)}
                />
            )}
            {campaign.quests.length === 0
                ? <EmptyState>No quests in it yet.</EmptyState>
                : (
                        <ul className="divide-y divide-line border-t border-line">
                            {campaign.quests.map(quest => (
                                <QuestRow
                                    key={quest.id}
                                    quest={quest}
                                    counted={counted}
                                    canManage={canManage}
                                    editing={editing === quest.id}
                                    onEdit={() => setEditing(editing === quest.id ? null : quest.id)}
                                    onDone={() => setEditing(null)}
                                />
                            ))}
                        </ul>
                    )}
        </Panel>
    );
};

/**
 * The quest campaigns and their quests, done in order, one at a time. The server counts only
 * some types (wearing a badge, feeding a pet, sending friend requests); a quest of another type
 * is marked, as players can take it but it never moves. Quests are read on every use, so a change
 * reaches players at once.
 */
export const QuestsTab = () => {
    const { data, error } = useQuests();
    const { save } = useCampaignChange();
    const [ adding, setAdding ] = useState(false);

    if (error) return <ErrorNotice error={error} />;
    if (!data) return <Loading />;

    return (
        <>
            <Panel
                title="Quest campaigns"
                description={`Each campaign's quests are done in order, one at a time. The server counts ${data.countedTypes.join(', ')}.`}
                actions={data.canManage && !adding && <Button icon={<Plus />} onClick={() => setAdding(true)}>Add campaign</Button>}
                className="overflow-clip"
            >
                {adding && (
                    <CampaignForm
                        start={{ code: '', sortOrder: data.campaigns.length, enabled: true, endsAtUtc: null }}
                        busy={save.isPending}
                        onSave={input => save.mutate({ id: null, input }, {
                            onSuccess: () => {
                                toast(`Added ${input.code}.`);
                                setAdding(false);
                            },
                            onError: toastError,
                        })}
                        onCancel={() => setAdding(false)}
                    />
                )}
                {data.campaigns.length === 0 && <EmptyState>No campaigns.</EmptyState>}
            </Panel>
            {data.campaigns.map(campaign => <CampaignPanel key={campaign.id} campaign={campaign} counted={data.countedTypes} canManage={data.canManage} />)}
        </>
    );
};

import { Plus, Search, UserRound, X } from 'lucide-react';
import { type FormEvent, useId, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';

import { checkNode, type CheckResponse, type CheckSource, playerCalls, type PlayerPermissions, useCatalog, useGroups, usePermissionChange, usePlayerAudit, usePlayerPermissions } from '#/api/permissions';
import { useMe } from '#/api/queries';
import { Badge, Button, EmptyState, ErrorNotice, HeaderLink, Input, Labeled, Loading, PageBody, Panel, Select } from '#/components/ui';

import { MetaCard, NodesCard } from './AssignmentCards';
import { ADD_FORM_CLASS, AuditTable, Expiry, PermissionsHeader, TimingFields, UnsetButton, Verdict } from './common';
import { LevelCard } from './LevelCard';

/** The groups the player holds directly, and putting them in or taking them out of one. */
const GroupsCard = ({ player }: { player: PlayerPermissions }) => {
    const calls = playerCalls(player.id);
    const add = usePermissionChange(calls.addGroup);
    const removeGroup = usePermissionChange(calls.removeGroup);
    const groups = useGroups();
    const [ group, setGroup ] = useState('');
    const [ duration, setDuration ] = useState('');
    const [ extend, setExtend ] = useState(false);
    const choices = (groups.data?.groups ?? []).filter(x => x.canEdit && x.name !== 'default');

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();
        add.mutate([ group, { duration, extend } ], { onSuccess: () => setGroup('') });
    };

    return (
        <Panel title="Groups" description="Held directly. Everyone holds default too.">
            {player.groups.length === 0
                ? <EmptyState>Only default.</EmptyState>
                : (
                        <ul className="divide-y divide-line text-sm">
                            {player.groups.map(g => (
                                <li key={`${g.name}|${g.expiresAtUtc ?? ''}`} className="flex items-center justify-between gap-2 px-4 py-2">
                                    <span className="flex flex-wrap items-center gap-2">
                                        <Link to={`/permissions/groups/${encodeURIComponent(g.name)}`} className="font-medium hover:text-accent">{g.displayName}</Link>
                                        <span className="text-xs text-muted">weight {g.weight}</span>
                                        <Expiry at={g.expiresAtUtc} />
                                    </span>
                                    {player.canEdit && (
                                        <UnsetButton
                                            label={`Take ${player.name} out of ${g.name}`}
                                            icon={<X />}
                                            disabled={removeGroup.isPending}
                                            onClick={() => removeGroup.mutate([ g.name, g.expiresAtUtc !== null ])}
                                        />
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
            {player.canEdit && (
                <form onSubmit={handleSubmit} className={ADD_FORM_CLASS}>
                    <Labeled label="Group" className="sm:min-w-40 sm:flex-1">
                        <Select value={group} onChange={event => setGroup(event.target.value)} className="w-full">
                            <option value="">Choose a group</option>
                            {choices.map(x => <option key={x.name} value={x.name}>{x.displayName} ({x.weight})</option>)}
                        </Select>
                    </Labeled>
                    <TimingFields duration={duration} extend={extend} onDuration={setDuration} onExtend={setExtend} />
                    <Button type="submit" icon={<Plus />} disabled={group === '' || add.isPending}>Add</Button>
                </form>
            )}
            {(add.error ?? removeGroup.error) && <div className="px-4 pb-3"><ErrorNotice error={add.error ?? removeGroup.error} /></div>}
            {player.reachedGroups.length > player.groups.length && (
                <p className="border-t border-line px-4 py-3 text-xs text-muted">
                    Reaches, through inheritance:
                    {' '}
                    {player.reachedGroups.filter(r => !player.groups.some(g => g.name === r.name)).map(r => r.displayName).join(', ')}
                </p>
            )}
        </Panel>
    );
};

const describeSource = (source: CheckSource) =>
    source.source === 'player' ? 'set on the player' : `group ${source.groupName ?? ''} (weight ${source.groupWeight ?? 0})`;

const SourceLine = ({ label, source }: { label: string; source: CheckSource }) => (
    <li className="text-xs">
        <span className="text-muted">{label}</span>
        {' '}
        {describeSource(source)}
        :
        {' '}
        <code className="font-mono">{source.node}</code>
        {' '}
        <Verdict value={source.value} />
        {source.path.length > 1 && <span className="text-muted"> via {source.path.join(' > ')}</span>}
        {source.expiresAtUtc && <span className="ml-1"><Expiry at={source.expiresAtUtc} /></span>}
    </li>
);

/** "Why can't they do that": what decided a node for the player, and what it beat. */
const CheckCard = ({ playerId }: { playerId: number }) => {
    const catalog = useCatalog();
    const listId = useId();
    const [ node, setNode ] = useState('');
    const [ result, setResult ] = useState<CheckResponse | null>(null);
    const [ error, setError ] = useState<unknown>(null);

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        setError(null);

        try {
            setResult(await checkNode(playerId, node.trim()));
        } catch (reason) {
            setError(reason);
            setResult(null);
        }
    };

    return (
        <Panel title="Check a node" description="Why the player does or does not hold it.">
            <form onSubmit={handleSubmit} className="flex gap-2 p-4">
                <Input
                    value={node}
                    onChange={event => setNode(event.target.value)}
                    list={listId}
                    placeholder="room.enter.locked"
                    aria-label="Node to check"
                    spellCheck={false}
                    autoComplete="off"
                    className="min-w-0 flex-1 font-mono"
                />
                <datalist id={listId}>
                    {catalog.data?.nodes.map(x => <option key={x.node} value={x.node}>{x.description}</option>)}
                </datalist>
                <Button type="submit" variant="secondary" icon={<Search />} disabled={node.trim() === ''}>Check</Button>
            </form>
            {error !== null && <div className="px-4 pb-4"><ErrorNotice error={error} /></div>}
            {result && (
                <div className="space-y-2 border-t border-line px-4 py-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                        <code className="font-mono text-xs">{result.node}</code>
                        <Badge tone={result.granted ? 'green' : 'red'}>{result.granted ? 'granted' : 'denied'}</Badge>
                        {!result.isRegistered && <Badge tone="amber">not registered</Badge>}
                    </div>
                    <ul className="space-y-1">
                        {result.decision
                            ? <SourceLine label="Decided by" source={result.decision} />
                            : (
                                    <li className="text-xs text-muted">
                                        Decided by nothing:
                                        {' '}
                                        {result.granted ? 'the node is granted to everyone by default.' : 'no group or player sets it, so it is denied.'}
                                    </li>
                                )}
                        {result.overridden.map((source, index) => <SourceLine key={index} label="Beats" source={source} />)}
                    </ul>
                </div>
            )}
        </Panel>
    );
};

/** Everything the player ends up holding, from every source, with a filter. */
const HoldsCard = ({ player }: { player: PlayerPermissions }) => {
    const [ filter, setFilter ] = useState('');
    const nodes = useMemo(() => player.holds.filter(node => !node.startsWith('group.') && node.includes(filter.trim())), [ player.holds, filter ]);
    const meta = Object.entries(player.resolvedMeta);

    return (
        <Panel title={`Holds (${player.holds.filter(x => !x.startsWith('group.')).length})`} description="What it all resolves to.">
            <div className="border-b border-line p-3">
                <Input type="search" value={filter} onChange={event => setFilter(event.target.value)} placeholder="Filter" aria-label="Filter held nodes" />
            </div>
            <div className="max-h-80 overflow-y-auto px-4 py-3">
                {nodes.length === 0
                    ? <p className="text-sm text-muted">Nothing matches.</p>
                    : (
                            <ul className="columns-1 gap-6 font-mono text-xs sm:columns-2">
                                {nodes.map(node => <li key={node} className="break-all">{node}</li>)}
                            </ul>
                        )}
            </div>
            {meta.length > 0 && (
                <ul className="space-y-1 border-t border-line px-4 py-3 text-xs">
                    {meta.map(([ key, value ]) => (
                        <li key={key}>
                            <code className="font-mono">{key}</code>
                            {' = '}
                            <code className="font-mono">{value}</code>
                        </li>
                    ))}
                </ul>
            )}
            {player.unregistered.length > 0 && (
                <p className="border-t border-line px-4 py-3 text-xs text-warn">
                    Set but not registered, so they do nothing: {player.unregistered.join(', ')}
                </p>
            )}
        </Panel>
    );
};

const PlayerHistory = ({ playerId }: { playerId: number }) => {
    const audit = usePlayerAudit(playerId);

    return (
        <Panel title="History" className="overflow-hidden">
            {audit.isPending && <Loading />}
            {audit.error && <div className="p-4"><ErrorNotice error={audit.error} /></div>}
            {audit.data && <AuditTable entries={audit.data} showTarget={false} />}
        </Panel>
    );
};

/** One player's permissions: what is set on them, what it resolves to, and why. */
export const PlayerPage = () => {
    const id = Number(useParams().id);
    const { data: player, error, isPending } = usePlayerPermissions(id);
    const me = useMe().data;
    const canViewPlayers = me?.canViewPlayers ?? false;
    const isMe = player !== undefined && me?.id === player.id;

    return (
        <>
            <PermissionsHeader
                section="players"
                title={player?.name ?? `Player #${id}`}
                back={{ to: '/permissions/players', label: 'Players' }}
                description={player && `Client level ${player.client.securityLevel} (${player.client.securityLevelValue})${player.client.isAmbassador ? ', ambassador' : ''}${player.client.isModerator ? ', moderator' : ''}`}
            >
                {player && !player.canEdit && <Badge>Read-only</Badge>}
                {isMe && <Badge tone="amber">You</Badge>}
                {player && canViewPlayers && (
                    <HeaderLink to={`/players/${player.id}`} icon={<UserRound />}>Profile</HeaderLink>
                )}
            </PermissionsHeader>
            <PageBody>
                {isPending && <Loading />}
                {error && <ErrorNotice error={error} />}
                {isMe && player.canEdit && (
                    <p className="mb-5 rounded-lg bg-warn-soft px-4 py-3 text-sm text-warn">
                        These are your own permissions. As a superuser you may change them; every change is logged as a self-edit, and you can't take permissions.superuser from yourself.
                    </p>
                )}
                {player && (
                    <div className="grid gap-5 xl:grid-cols-[22rem_1fr]">
                        <div className="grid content-start gap-5">
                            <GroupsCard player={player} />
                            <CheckCard playerId={player.id} />
                            <LevelCard level={player.level} who={player.name} />
                        </div>
                        <div className="grid min-w-0 content-start gap-5">
                            <NodesCard target={{ kind: 'player', id: player.id }} nodes={player.nodes} canEdit={player.canEdit} />
                            <MetaCard target={{ kind: 'player', id: player.id }} meta={player.meta} canEdit={player.canEdit} />
                            <HoldsCard player={player} />
                            <PlayerHistory playerId={player.id} />
                        </div>
                    </div>
                )}
            </PageBody>
        </>
    );
};

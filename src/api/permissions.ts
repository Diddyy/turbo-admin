import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, post, put, remove } from './client';

export interface GroupRef {
    name: string;
    displayName: string;
    weight: number;
}

export interface GroupListItem {
    id: number;
    name: string;
    displayName: string;
    weight: number;
    parents: string[];
    nodeCount: number;
    metaCount: number;
    canEdit: boolean;
}

export interface GroupsResponse {
    groups: GroupListItem[];
    canManage: boolean;
    /** The weight of the signed-in player's heaviest group: they may change groups lighter than it. */
    yourWeight: number;
}

/** A node or wildcard set on a group or player: granted when `value`, denied otherwise. */
export interface NodeAssignment {
    node: string;
    value: boolean;
    expiresAtUtc: string | null;
    description: string | null;
}

export interface MetaAssignment {
    key: string;
    value: string;
    expiresAtUtc: string | null;
    description: string | null;
}

export interface LevelView {
    level: string;
    value: number;
    source: string | null;
    shownButRefused: { node: string; description: string; clientLevel: number }[];
}

export interface GroupResponse {
    id: number;
    name: string;
    displayName: string;
    weight: number;
    isDefault: boolean;
    parents: GroupRef[];
    children: GroupRef[];
    nodes: NodeAssignment[];
    meta: MetaAssignment[];
    level: LevelView;
    canEdit: boolean;
}

export interface MemberView {
    id: number;
    name: string;
    expiresAtUtc: string | null;
}

export interface AuditEntry {
    atUtc: string;
    actorId: number | null;
    /** Null for the server console. */
    actorName: string | null;
    targetType: 'Player' | 'Group';
    targetId: number;
    targetName: string;
    action: string;
    subject: string;
    value: string | null;
    expiresAtUtc: string | null;
    /** A player changed their own permissions, which only a superuser may. */
    self: boolean;
}

export interface PlayerGroup extends GroupRef {
    expiresAtUtc: string | null;
}

export interface PlayerPermissions {
    id: number;
    name: string;
    groups: PlayerGroup[];
    reachedGroups: GroupRef[];
    nodes: NodeAssignment[];
    meta: MetaAssignment[];
    holds: string[];
    resolvedMeta: Record<string, string>;
    unregistered: string[];
    client: {
        securityLevel: string;
        securityLevelValue: number;
        isAmbassador: boolean;
        isModerator: boolean;
        perksAllowed: string[];
    };
    level: LevelView;
    canEdit: boolean;
}

export interface CheckSource {
    source: 'player' | 'group';
    groupName: string | null;
    groupWeight: number | null;
    path: string[];
    node: string;
    value: boolean;
    expiresAtUtc: string | null;
}

export interface CheckResponse {
    node: string;
    isRegistered: boolean;
    granted: boolean;
    decision: CheckSource | null;
    overridden: CheckSource[];
}

export interface Catalog {
    nodes: { node: string; description: string; clientLevel: number | null; grantedByDefault: boolean }[];
    metaKeys: { key: string; description: string; selection: string }[];
}

export interface Holder {
    targetType: 'Player' | 'Group';
    targetId: number;
    targetName: string;
    node: string;
    value: boolean;
    expiresAtUtc: string | null;
}

export interface StaffMember {
    id: number;
    name: string;
    groups: PlayerGroup[];
}

export interface ChangeResponse {
    changed: boolean;
    message: string;
}

/** How long an assignment lasts: empty for permanent, else `30m`, `12h`, `7d`, `2w`. */
export interface Timing {
    duration: string;
    extend: boolean;
}

const query = (params: Record<string, string | number | boolean>) =>
    new URLSearchParams(Object.entries(params).map(([ key, value ]) => [ key, String(value) ])).toString();

const group = (name: string) => `/permissions/groups/${encodeURIComponent(name)}`;
const player = (id: number) => `/permissions/players/${id}`;

export const useGroups = () => useQuery({
    queryKey: [ 'permissions', 'groups' ],
    queryFn: () => api<GroupsResponse>('/permissions/groups'),
});

export const useGroup = (name: string) => useQuery({
    queryKey: [ 'permissions', 'group', name ],
    queryFn: () => api<GroupResponse>(group(name)),
});

export const useGroupMembers = (name: string) => useQuery({
    queryKey: [ 'permissions', 'group', name, 'members' ],
    queryFn: () => api<MemberView[]>(`${group(name)}/members?count=200`),
});

export const useGroupAudit = (name: string) => useQuery({
    queryKey: [ 'permissions', 'group', name, 'audit' ],
    queryFn: () => api<AuditEntry[]>(`${group(name)}/audit?count=100`),
});

export const useStaff = () => useQuery({
    queryKey: [ 'permissions', 'staff' ],
    queryFn: () => api<StaffMember[]>('/permissions/players?count=200'),
});

export const usePlayerPermissions = (id: number) => useQuery({
    queryKey: [ 'permissions', 'player', id ],
    queryFn: () => api<PlayerPermissions>(player(id)),
});

export const usePlayerAudit = (id: number) => useQuery({
    queryKey: [ 'permissions', 'player', id, 'audit' ],
    queryFn: () => api<AuditEntry[]>(`${player(id)}/audit?count=100`),
});

export const findPlayer = (name: string) => api<MemberView>(`/permissions/players/find?${query({ name })}`);

export const checkNode = (id: number, node: string) => api<CheckResponse>(`${player(id)}/check?${query({ node })}`);

export const useCatalog = () => useQuery({
    queryKey: [ 'permissions', 'catalog' ],
    queryFn: () => api<Catalog>('/permissions/catalog'),
    staleTime: 5 * 60_000,
});

export const useHolders = (node: string) => useQuery({
    queryKey: [ 'permissions', 'search', node ],
    queryFn: () => api<Holder[]>(`/permissions/search?${query({ node, count: 200 })}`),
    enabled: node !== '',
});

export const useLog = (search: string) => useQuery({
    queryKey: [ 'permissions', 'log', search ],
    queryFn: () => api<AuditEntry[]>(`/permissions/log?${query({ search, count: 100 })}`),
});

/**
 * Where a change is made: a group or a player, each with the same node, meta and remove calls.
 * Every change refreshes all permission reads, since a group's change reaches its members too.
 */
export type Target = { kind: 'group'; name: string } | { kind: 'player'; id: number };

const base = (target: Target) => (target.kind === 'group' ? group(target.name) : player(target.id));

export const targetCalls = (target: Target) => ({
    setNode: (node: string, value: boolean, timing: Timing) =>
        put<ChangeResponse>(`${base(target)}/nodes`, { node, value, ...timing }),
    unsetNode: (node: string, temporary: boolean) =>
        remove<ChangeResponse>(`${base(target)}/nodes?${query({ node, temporary })}`),
    setMeta: (key: string, value: string, timing: Timing) =>
        put<ChangeResponse>(`${base(target)}/meta`, { key, value, ...timing }),
    unsetMeta: (key: string, temporary: boolean) =>
        remove<ChangeResponse>(`${base(target)}/meta?${query({ key, temporary })}`),
});

export const groupCalls = (name: string) => ({
    create: (body: { name: string; displayName: string; weight: number }) =>
        post<ChangeResponse>('/permissions/groups', body),
    update: (body: { displayName?: string; weight?: number }) => put<ChangeResponse>(group(name), body),
    delete: () => remove<ChangeResponse>(group(name)),
    addParent: (parent: string) => post<ChangeResponse>(`${group(name)}/parents`, { parent }),
    removeParent: (parent: string) => remove<ChangeResponse>(`${group(name)}/parents/${encodeURIComponent(parent)}`),
});

export const playerCalls = (id: number) => ({
    addGroup: (groupName: string, timing: Timing) =>
        post<ChangeResponse>(`${player(id)}/groups`, { group: groupName, ...timing }),
    removeGroup: (groupName: string, temporary: boolean) =>
        remove<ChangeResponse>(`${player(id)}/groups/${encodeURIComponent(groupName)}?${query({ temporary })}`),
});

/** A change that refreshes every permission read once it is made. */
export const usePermissionChange = <A extends unknown[]>(call: (...args: A) => Promise<ChangeResponse>) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (args: A) => call(...args),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: [ 'permissions' ] }),
    });
};

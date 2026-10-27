import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, post } from './client';
import { liveInterval } from './live';
import { useMe } from './queries';

export type ApprovalState = 'pending' | 'approved' | 'executed' | 'failed' | 'denied' | 'expired';
export type ApprovalRequesterKind = 'player' | 'staff' | 'agent' | 'token' | 'plugin' | 'system';

/** An action a plugin, an AI agent or an MCP tool asked to do, waiting for a person's yes or decided. */
export interface ApprovalItem {
    id: number;
    kind: string;
    /** The plugin that asked; null for the server's own. */
    plugin: string | null;
    /** What it will do, in a sentence. */
    summary: string;
    /** What its handler is given, as saved. Shown as text, never run. */
    arguments: unknown;
    requesterKind: ApprovalRequesterKind;
    /** The player it was asked by or for: they can't decide it. */
    requesterId: number | null;
    requesterPlayerName: string | null;
    /** An agent's or a token's name, for a requester that is not a player. */
    requesterName: string | null;
    /** The node deciding it needs. */
    node: string;
    state: ApprovalState;
    requestedAtUtc: string;
    expiresAtUtc: string;
    decidedById: number | null;
    decidedByName: string | null;
    decidedAtUtc: string | null;
    note: string | null;
    executedAtUtc: string | null;
    /** What carrying it out answered, or why it failed. */
    result: string | null;
    /** Pending, not yours, and you hold its node. */
    canDecide: boolean;
    /** Asked by you or for you. */
    own: boolean;
}

export interface ApprovalListResponse {
    total: number;
    page: number;
    pageSize: number;
    /** Waiting for a decision across the hotel. */
    pending: number;
    entries: ApprovalItem[];
}

export interface ApprovalFilter {
    state: ApprovalState | 'all';
    kind: string;
    plugin: string;
}

/** How often the inbox is asked again without the live stream; with it, a change asks at once. */
const REFRESH_MS = 20_000;

const queryOf = (filter: ApprovalFilter, page: number) => {
    const params = new URLSearchParams({ state: filter.state, page: String(page) });

    if (filter.kind)
        params.set('kind', filter.kind);

    if (filter.plugin)
        params.set('plugin', filter.plugin);

    return params.toString();
};

export const useApprovals = (filter: ApprovalFilter, page: number) => useQuery({
    queryKey: [ 'approvals', filter, page ],
    queryFn: () => api<ApprovalListResponse>(`/approvals?${queryOf(filter, page)}`),
    placeholderData: keepPreviousData,
    refetchInterval: page === 1 ? liveInterval(REFRESH_MS) : false,
});

export const useApproval = (id: number) => useQuery({
    queryKey: [ 'approval', id ],
    queryFn: () => api<ApprovalItem>(`/approvals/${id}`),
    refetchInterval: liveInterval(REFRESH_MS),
});

/** How many requests wait for a decision, for the count by the menu's Approvals; none without the node. */
export const useApprovalCount = () => {
    const allowed = useMe().data?.canViewApprovals ?? false;

    return useQuery({
        queryKey: [ 'approvals', 'count' ],
        queryFn: () => api<{ pending: number }>('/approvals/count'),
        enabled: allowed,
        refetchInterval: liveInterval(REFRESH_MS),
    });
};

export interface ApprovalDecisionResponse {
    /** Carried out, or denied; false when it was approved and carrying it out failed. */
    ok: boolean;
    message: string;
    approval: ApprovalItem;
}

/** Approves (and carries out) or denies a request; the inbox and the request are asked again after. */
export const useApprovalDecision = (id: number) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ approve, note }: { approve: boolean; note: string }) =>
            post<ApprovalDecisionResponse>(`/approvals/${id}/${approve ? 'approve' : 'deny'}`, { note: note.trim() || null }),
        onSuccess: decision => queryClient.setQueryData([ 'approval', id ], decision.approval),
        onSettled: () => {
            void queryClient.invalidateQueries({ queryKey: [ 'approvals' ] });
            void queryClient.invalidateQueries({ queryKey: [ 'approval' ] });
        },
    });
};

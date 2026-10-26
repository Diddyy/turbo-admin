import { useQueryClient } from '@tanstack/react-query';

import { api } from '#/api/client';
import type { DashboardResponse } from '#/api/types';
import { plural } from '#/lib/plural';

import { toast } from './toast';

/**
 * What a saved appearance change does, in one sentence every appearance editor uses: who has it
 * now and who gets it when. A player's client reads windows, styles and texts as it loads, so the
 * players online see it at their next load; one who logs in now has it.
 */
export const savedLine = (what: string, online: number | null) => {
    if (online === null) return `${what}: saved. Players get it at their next load.`;

    if (online === 0) return `${what}: saved. No one is online: every player has it from their next load.`;

    return `${what}: saved. ${plural(online, 'player')} online ${online === 1 ? 'gets' : 'get'} it at their next load; anyone logging in now has it.`;
};

/** Says an appearance change was saved (`savedLine`), with the players online now. */
export const useSaved = () => {
    const queryClient = useQueryClient();

    return (what: string) => void queryClient
        .fetchQuery({ queryKey: [ 'dashboard' ], queryFn: () => api<DashboardResponse>('/dashboard'), staleTime: 10_000 })
        .then(dashboard => dashboard.playersOnline, () => null)
        .then(online => toast(savedLine(what, online)));
};

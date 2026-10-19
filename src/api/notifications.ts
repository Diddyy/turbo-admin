import { useQuery } from '@tanstack/react-query';
import { create } from 'zustand';

import { api } from './client';
import { liveInterval } from './live';

/**
 * What the bell lists. `availability` is maintenance or a shutdown, coming or under way (`atUtc`
 * is when it starts); `ban` and `refusedCommand` are the week's, newest first; `report` is a call
 * for help of the week still open, for moderators.
 */
export interface NotificationItem {
    id: string;
    kind: 'availability' | 'ban' | 'refusedCommand' | 'report' | (string & {});
    atUtc: string;
    title: string;
    detail: string | null;
    playerId: number | null;
}

/** How often the bell asks again without the live stream; with it, a ban or maintenance asks at once. */
const POLL_MS = 60_000;

export const useNotifications = () => useQuery({
    queryKey: [ 'notifications' ],
    queryFn: () => api<{ items: NotificationItem[] }>('/notifications'),
    refetchInterval: liveInterval(POLL_MS),
});

/** The most seen ids kept: well over a week's worth. */
const KEEP = 500;

const STORAGE_KEY = 'turbo-admin-seen-notifications';

const load = (): string[] => {
    try {
        const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');

        return Array.isArray(parsed) ? (parsed as string[]) : [];
    } catch {
        return [];
    }
};

/**
 * Which notifications this browser has seen, by id. Kept in this browser alone: another device,
 * a private window or cleared storage shows them all as new again.
 */
export const useSeenNotifications = create<{ seen: string[]; markSeen: (ids: string[]) => void }>(set => ({
    seen: load(),
    markSeen: ids => set((state) => {
        const seen = [ ...ids.filter(id => !state.seen.includes(id)), ...state.seen ].slice(0, KEEP);

        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(seen));
        } catch {
            // Storage blocked: seen for this visit only.
        }

        return { seen };
    }),
}));

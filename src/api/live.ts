import { type Query, type QueryClient, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { create } from 'zustand';

import { useSession } from '#/auth/session';

import { API_URL } from './client';

/** How often a page asks again while the live stream is up: for what no change is sent about. */
export const LIVE_FALLBACK_MS = 60_000;

/** The longest wait between tries to reconnect. */
const MAX_RETRY_MS = 30_000;

/** What changed in the hotel, for the panel to fetch again (the server's LiveChangesMessage). */
interface LiveChanges {
    dashboard: boolean;
    rooms: number[];
    players: number[];
    permissions: number[];
    /** Something new for the bell: a ban, or maintenance or a shutdown coming, starting or called off. */
    notifications: boolean;
    /** Calls for help changed: one sent, picked, let go or closed. Only for moderators. */
    reports: boolean;
}

/** Whether the live stream is up, so pages can ask less often while it is. */
export const useLive = create<{ connected: boolean }>(() => ({ connected: false }));

/** How often a page that changes on its own asks again: rarely while live, else every so often. */
export const liveInterval = (pollMs: number) => () => (useLive.getState().connected ? LIVE_FALLBACK_MS : pollMs);

/** A list query whose current page shows one of the ids. */
const showsAny = (ids: Set<number>, field: 'rooms' | 'players') => (query: Query) => {
    const rows = (query.state.data as Record<string, { id: number }[] | undefined> | undefined)?.[field];

    return rows?.some(row => ids.has(row.id)) ?? false;
};

const apply = (queryClient: QueryClient, changes: LiveChanges) => {
    if (changes.dashboard)
        void queryClient.invalidateQueries({ queryKey: [ 'dashboard' ] });

    if (changes.notifications)
        void queryClient.invalidateQueries({ queryKey: [ 'notifications' ] });

    if (changes.reports) {
        void queryClient.invalidateQueries({ queryKey: [ 'reports' ] });
        void queryClient.invalidateQueries({ queryKey: [ 'report' ] });
    }

    const rooms = new Set(changes.rooms);
    const players = new Set(changes.players);

    for (const id of rooms)
        void queryClient.invalidateQueries({ queryKey: [ 'room', id ] });

    for (const id of players)
        void queryClient.invalidateQueries({ queryKey: [ 'player', id ] });

    if (rooms.size > 0)
        void queryClient.invalidateQueries({ queryKey: [ 'rooms' ], predicate: showsAny(rooms, 'rooms') });

    if (players.size > 0)
        void queryClient.invalidateQueries({ queryKey: [ 'players' ], predicate: showsAny(players, 'players') });

    for (const id of changes.permissions)
        void queryClient.invalidateQueries({ queryKey: [ 'permissions', 'player', id ] });

    if (changes.permissions.length > 0)
        void queryClient.invalidateQueries({ queryKey: [ 'permissions', 'staff' ] });
};

/** Everything a page may be showing that changes on its own, asked again after time away. */
const catchUp = (queryClient: QueryClient) => {
    for (const key of [ 'dashboard', 'room', 'rooms', 'player', 'players', 'permissions', 'notifications', 'reports', 'report' ])
        void queryClient.invalidateQueries({ queryKey: [ key ] });
};

/** Reads server-sent events off a response: each event's name and data, as they arrive. */
async function* events(response: Response, signal: AbortSignal) {
    const reader = response.body!.pipeThrough(new TextDecoderStream()).getReader();
    const abort = () => void reader.cancel().catch(() => undefined);
    let buffer = '';

    signal.addEventListener('abort', abort);

    try {
        for (;;) {
            const { value, done } = await reader.read();

            if (done)
                return;

            buffer += value.replaceAll('\r\n', '\n');

            let end: number;

            while ((end = buffer.indexOf('\n\n')) >= 0) {
                const block = buffer.slice(0, end);
                let name = 'message';
                let data = '';

                buffer = buffer.slice(end + 2);

                for (const line of block.split('\n')) {
                    if (line.startsWith('event:'))
                        name = line.slice(6).trim();
                    else if (line.startsWith('data:'))
                        data += line.slice(5).trim();
                }

                // A block of comments alone is the server keeping the connection open.
                if (block.split('\n').some(line => !line.startsWith(':')))
                    yield { name, data };
            }
        }
    } finally {
        signal.removeEventListener('abort', abort);
    }
}

/**
 * Keeps the live stream open while signed in, and fetches again what it says changed. The stream
 * cannot carry the session in a header the way `EventSource` would need, so it is read with
 * `fetch`. A dropped stream is retried, waiting longer each time up to half a minute; on
 * reconnecting, what is on screen is fetched again for what was missed.
 */
export const useLiveUpdates = () => {
    const queryClient = useQueryClient();
    const token = useSession(state => state.session?.token);

    useEffect(() => {
        if (!token)
            return;

        const stop = new AbortController();
        let connectedBefore = false;

        const run = async () => {
            let wait = 2_000;

            while (!stop.signal.aborted) {
                try {
                    const response = await fetch(`${API_URL}/api/live`, {
                        headers: { Authorization: `Bearer ${token}` },
                        signal: stop.signal,
                    });

                    if (response.status === 401) {
                        useSession.getState().signOut();

                        return;
                    }

                    if (response.ok && response.body) {
                        for await (const event of events(response, stop.signal)) {
                            if (event.name === 'ready') {
                                useLive.setState({ connected: true });
                                wait = 2_000;

                                if (connectedBefore)
                                    catchUp(queryClient);

                                connectedBefore = true;
                            } else if (event.name === 'changes') {
                                apply(queryClient, JSON.parse(event.data) as LiveChanges);
                            }
                        }
                    }
                } catch {
                    // Unreachable, or the stream broke off: tried again below.
                }

                useLive.setState({ connected: false });

                if (stop.signal.aborted)
                    return;

                await new Promise(resolve => setTimeout(resolve, wait));
                wait = Math.min(wait * 2, MAX_RETRY_MS);
            }
        };

        void run();

        return () => {
            stop.abort();
            useLive.setState({ connected: false });
        };
    }, [ queryClient, token ]);
};

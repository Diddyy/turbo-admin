import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';

import { type ListOrder, orderParams } from '#/lib/sort';

import { api, post, put } from './client';
import { liveInterval } from './live';
import type { AccountResponse, CommandInfo, DashboardResponse, MeResponse, RoomDetailResponse, RoomListResponse, RoomSearchMode, RunCommandResponse } from './types';

/** How often the dashboard refreshes while it is open and the live stream is down. */
const DASHBOARD_REFRESH_MS = 10_000;

export const useMe = () => useQuery({
    queryKey: [ 'me' ],
    queryFn: () => api<MeResponse>('/me'),
});

export const useDashboard = () => useQuery({
    queryKey: [ 'dashboard' ],
    queryFn: () => api<DashboardResponse>('/dashboard'),
    refetchInterval: liveInterval(DASHBOARD_REFRESH_MS),
});

export const useCommands = () => useQuery({
    queryKey: [ 'commands' ],
    queryFn: () => api<CommandInfo[]>('/commands'),
    staleTime: 60_000,
});

export const useRunCommand = () => useMutation({
    mutationFn: (line: string) => post<RunCommandResponse>('/commands/run', { line }),
});

export const useAccount = () => useQuery({
    queryKey: [ 'account' ],
    queryFn: () => api<AccountResponse>('/account'),
});

export const useRoomSearch = (text: string, by: RoomSearchMode, page: number, order: ListOrder | null) => useQuery({
    queryKey: [ 'rooms', by, text, page, order ],
    queryFn: () => api<RoomListResponse>(`/rooms?${new URLSearchParams({ q: text, by, page: String(page), ...orderParams(order) })}`),
    // The table keeps showing the last page while the next one loads.
    placeholderData: keepPreviousData,
});

/** One room; the live stream says when who is inside changes, and it is asked again besides. */
export const useRoom = (id: number) => useQuery({
    queryKey: [ 'room', id ],
    queryFn: () => api<RoomDetailResponse>(`/rooms/${id}`),
    refetchInterval: liveInterval(DASHBOARD_REFRESH_MS),
});

/** What the signed-in staff member may do to the whole hotel: one flag per command, and the welcome message. */
export interface HotelAbilities {
    alert: boolean;
    maintenance: boolean;
    shutdown: boolean;
    welcomeMessage: boolean;
}

export const useHotelAbilities = () => useQuery({
    queryKey: [ 'hotel-abilities' ],
    queryFn: () => api<HotelAbilities>('/hotel/abilities'),
    staleTime: 60_000,
});

export interface HotelActionRequest {
    action: 'alert' | 'maintenance' | 'maintenance-off' | 'shutdown' | 'shutdown-cancel';
    minutes?: number;
    /** The alert, or the reason given with a countdown. */
    message?: string;
}

/** Runs an action on the whole hotel: its own command, as you. Answers as the console does. */
export const actOnHotel = (request: HotelActionRequest) => post<RunCommandResponse>('/hotel/actions', request);

/** The message every player is shown when they log in; empty when there is none. */
export interface WelcomeMessage {
    message: string;
    maxLength: number;
}

export const useWelcomeMessage = (enabled = true) => useQuery({
    queryKey: [ 'welcome-message' ],
    queryFn: () => api<WelcomeMessage>('/hotel/welcome-message'),
    enabled,
});

/** Saves the welcome message for every login from now on; an empty one turns it off. */
export const saveWelcomeMessage = (message: string) => put<WelcomeMessage>('/hotel/welcome-message', { message });

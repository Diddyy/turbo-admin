import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, post, put, remove } from './client';
import type { RoomVisitItem } from './players';
import type { RoomCategoryItem, RoomSettingsRequest } from './types';

export interface RoomActionResponse {
    message: string;
}

export const useRoomCategories = () => useQuery({
    queryKey: [ 'room-categories' ],
    queryFn: () => api<RoomCategoryItem[]>('/rooms/categories'),
    staleTime: 5 * 60_000,
});

/** AvatarDanceType. */
export const DANCES: Record<number, string> = { 0: 'Not dancing', 1: 'Dance', 2: 'Pogo mogo', 3: 'Duck funk', 4: 'The Rollie' };

/** A bot standing in a room: whose it is and how it is set. */
export interface RoomBotItem {
    id: number;
    name: string;
    motto: string;
    figure: string;
    gender: number;
    ownerId: number;
    ownerName: string;
    chatText: string;
    autoChat: boolean;
    chatDelaySeconds: number;
    mixSentences: boolean;
    freeRoam: boolean;
    dance: number;
}

/** What staff set on a bot. */
export type RoomBotRequest = Omit<RoomBotItem, 'id' | 'ownerId' | 'ownerName'>;

/** The bots standing in a room, by name. */
export const useRoomBots = (id: number) => useQuery({
    queryKey: [ 'room', id, 'bots' ],
    queryFn: () => api<RoomBotItem[]>(`/rooms/${id}/bots`),
});

/** A pet standing in a room: what it is, whose it is and how it is doing, as last written. */
export interface RoomPetItem {
    id: number;
    name: string;
    typeId: number;
    paletteId: number;
    color: string;
    /** Grows with time: its level is not set by hand. */
    isMonsterplant: boolean;
    ownerId: number;
    ownerName: string;
    level: number;
    energy: number;
    nutrition: number;
    anyoneCanRide: boolean;
    hasBreedingPermission: boolean;
}

/** What staff set on a pet; each value left out stays as the pet has it. */
export type RoomPetRequest = Partial<Pick<RoomPetItem, 'name' | 'level' | 'energy' | 'nutrition' | 'anyoneCanRide' | 'hasBreedingPermission'>>;

/** The pets standing in a room, by name. */
export const useRoomPets = (id: number) => useQuery({
    queryKey: [ 'room', id, 'pets' ],
    queryFn: () => api<RoomPetItem[]>(`/rooms/${id}/pets`),
});

/** The players who went into a room, newest first. */
export const useRoomVisitors = (id: number) => useQuery({
    queryKey: [ 'room', id, 'visitors' ],
    queryFn: () => api<RoomVisitItem[]>(`/rooms/${id}/visitors`),
});

const room = (id: number) => `/rooms/${id}`;

/** Everything the panel can do to one room. Each answers with a sentence to show. */
export const roomCalls = (id: number) => ({
    saveSettings: (settings: RoomSettingsRequest) => put<RoomActionResponse>(`${room(id)}/settings`, settings),
    setStaffPick: (staffPick: boolean) => put<RoomActionResponse>(`${room(id)}/staff-pick`, { staffPick }),
    kick: (playerId: number) => post<RoomActionResponse>(`${room(id)}/kick`, { playerId }),
    mute: (playerId: number, minutes: number) => post<RoomActionResponse>(`${room(id)}/mute`, { playerId, minutes }),
    ban: (target: { playerId?: number; name?: string }, duration: string) =>
        post<RoomActionResponse>(`${room(id)}/ban`, { ...target, duration }),
    unban: (playerId: number) => remove<RoomActionResponse>(`${room(id)}/bans/${playerId}`),
    removeRights: (playerId: number) => remove<RoomActionResponse>(`${room(id)}/rights/${playerId}`),
    removeAllRights: () => remove<RoomActionResponse>(`${room(id)}/rights`),
    kickAll: () => post<RoomActionResponse>(`${room(id)}/kick-all`),
    setMuted: (muted: boolean) => put<RoomActionResponse>(`${room(id)}/muted`, { muted }),
    unload: () => post<RoomActionResponse>(`${room(id)}/unload`),
    alert: (message: string) => post<RoomActionResponse>(`${room(id)}/alert`, { message }),
    saveBot: (botId: number, bot: RoomBotRequest) => put<RoomActionResponse>(`${room(id)}/bots/${botId}`, bot),
    pickupBot: (botId: number) => post<RoomActionResponse>(`${room(id)}/bots/${botId}/pickup`),
    savePet: (petId: number, pet: RoomPetRequest) => put<RoomActionResponse>(`${room(id)}/pets/${petId}`, pet),
    pickupPet: (petId: number) => post<RoomActionResponse>(`${room(id)}/pets/${petId}/pickup`),
});

/**
 * Runs a room action and refreshes the room after it, keeping the last answer to show: the
 * server's sentence, or why it refused.
 */
export const useRoomAction = (id: number) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (action: () => Promise<RoomActionResponse>) => action(),
        onSettled: () => {
            void queryClient.invalidateQueries({ queryKey: [ 'room', id ] });
            void queryClient.invalidateQueries({ queryKey: [ 'rooms' ] });
        },
    });
};

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, post, put, remove } from './client';

/** A track in the list: when players get it (`live` = on and within its dates now) and how much it holds. */
export interface RewardTrackListItem {
    id: string;
    theme: string;
    enabled: boolean;
    startsAt: string | null;
    endsAt: string | null;
    live: boolean;
    hasPremium: boolean;
    tasks: number;
    levels: number;
    prizes: number;
    maxPoints: number;
}

export interface RewardTrackList {
    tracks: RewardTrackListItem[];
    /** The task action types the server counts. */
    actionTypes: string[];
}

export interface RewardTrackPremium {
    taskPointsBoost: number;
    instantPoints: number;
    costCredits: number;
    costDiamonds: number;
}

export interface RewardTrackLevel {
    requiredCount: number;
    points: number;
    premium: boolean;
}

export interface RewardTrackTask {
    id: string;
    actionType: string;
    parameter: string;
    premium: boolean;
    levels: RewardTrackLevel[];
}

/**
 * What a prize gives, as the client's product item type (AS3 `ProductIconWidget`): 0 wall item, 1
 * floor item, 2 effect, 4 badge, 6 bot, 8 activity points, 9 chat style, 10 pet, 12 Habbicon.
 */
export type RewardTrackProductType = 0 | 1 | 2 | 4 | 6 | 8 | 9 | 10 | 12;

export interface RewardTrackPrize {
    id: string;
    requiredPoints: number;
    productType: RewardTrackProductType;
    /** The furni's sprite, the badge code, the effect, the currency type or the Habbicon id. */
    rewardTypeId: string;
    /** A pet's or a bot's figure. */
    extraParams: string;
    amount: number;
    premium: boolean;
    /** The hotel's furni to give, when not the furni of the sprite. */
    furnitureDefinitionId: number | null;
    /** A pet's or a bot's name; empty for the hotel's default. */
    name: string;
}

export interface RewardTrack {
    id: string;
    enabled: boolean;
    startsAt: string | null;
    endsAt: string | null;
    theme: string;
    premium: RewardTrackPremium | null;
    tasks: RewardTrackTask[];
    prizes: RewardTrackPrize[];
}

/** The furni a furni prize gives here. */
export interface RewardTrackPrizeFurni {
    prizeId: string;
    definitionId: number;
    name: string;
}

export interface RewardTrackDetail {
    track: RewardTrack;
    /** What this hotel cannot do of the track: tasks it does not count, prizes it cannot give. */
    warnings: string[];
    furni: RewardTrackPrizeFurni[];
}

/** One track of a capture, and what taking it in does. */
export interface RewardTrackImportChange {
    id: string;
    action: 'added' | 'changed' | 'unchanged';
    premiumChanged: boolean;
    themeChanged: boolean;
    tasksAdded: string[];
    tasksChanged: string[];
    tasksRemoved: string[];
    prizesAdded: string[];
    prizesChanged: string[];
    prizesRemoved: string[];
    warnings: string[];
}

export interface RewardTrackImportPlan {
    tracks: RewardTrackImportChange[];
    saved: boolean;
    changes: boolean;
}

/** Habbo's `RewardTracks` message as its client read it, and the tracks of it to take in (all when empty). */
export interface RewardTrackImportRequest {
    capture: unknown;
    only: string[] | null;
}

const KEY = [ 'reward-tracks' ];

export const useRewardTracks = (enabled = true) => useQuery({
    queryKey: KEY,
    queryFn: () => api<RewardTrackList>('/reward-tracks'),
    enabled,
});

export const useRewardTrack = (id: string | null) => useQuery({
    queryKey: [ ...KEY, id ],
    queryFn: () => api<RewardTrackDetail>(`/reward-tracks/${encodeURIComponent(id!)}`),
    enabled: !!id,
});

/** Each change is sent to the players online at once, so every one refreshes the list and the track. */
const useTrackChange = <A, R>(call: (args: A) => Promise<R>) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: call,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
    });
};

/** Saves a track whole (added, or replaced); answers as reading it does. */
export const useSaveRewardTrack = () => useTrackChange((track: RewardTrack) => put<RewardTrackDetail>(`/reward-tracks/${encodeURIComponent(track.id)}`, track));

export const useDeleteRewardTrack = () => useTrackChange((id: string) => remove<undefined>(`/reward-tracks/${encodeURIComponent(id)}`));

/** Reads the tables again, after an edit made by hand. */
export const useReloadRewardTracks = () => useTrackChange(() => post<{ tracks: RewardTrackListItem[] }>('/reward-tracks/reload'));

export const useImportRewardTracks = () => useTrackChange((request: RewardTrackImportRequest) => post<RewardTrackImportPlan>('/reward-tracks/import', request));

/** What taking a capture in would do; nothing changes. */
export const previewRewardTrackImport = (request: RewardTrackImportRequest) => post<RewardTrackImportPlan>('/reward-tracks/import/preview', request);

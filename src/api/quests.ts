import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, post, put, remove } from './client';

/**
 * A daily task definition. `questType` is `explore` (rooms other players own, each once) or
 * `find_furni` (using one of `target`'s furni). The reward is `points` of the type `rewardTypeId`
 * numbers (0 is duckets) or a `badge` by its code. `problem` says why the hotel can't give it.
 */
export interface DailyTask {
    id: number;
    code: string;
    questType: string;
    target: string;
    requiredRepeats: number;
    imageVersion: string;
    catalogName: string;
    isBonus: boolean;
    enabled: boolean;
    rewardKind: 'points' | 'badge';
    rewardTypeId: string;
    rewardAmount: number;
    problem: string | null;
    /** How many players have been given it. */
    given: number;
}

export type DailyTaskInput = Omit<DailyTask, 'id' | 'problem' | 'given'>;

export interface QuestItem {
    id: number;
    campaignId: number;
    localizationCode: string;
    type: string;
    target: string;
    totalSteps: number;
    activityPointType: number;
    rewardAmount: number;
    sortOrder: number;
    imageVersion: string;
    catalogPageName: string;
    chainCode: string;
    easy: boolean;
    /** Whether the server counts its type: another type can be accepted but never moves. */
    counted: boolean;
    started: number;
    completed: number;
}

export type QuestInput = Omit<QuestItem, 'id' | 'counted' | 'started' | 'completed'>;

export interface QuestCampaign {
    id: number;
    code: string;
    sortOrder: number;
    enabled: boolean;
    /** Set: a seasonal campaign, gone after. */
    endsAtUtc: string | null;
    quests: QuestItem[];
}

export type QuestCampaignInput = Omit<QuestCampaign, 'id' | 'quests'>;

export const useDailyTasks = () => useQuery({
    queryKey: [ 'content', 'daily-tasks' ],
    queryFn: () => api<{ canManage: boolean; types: string[]; tasks: DailyTask[] }>('/quests/daily-tasks'),
});

export const useQuests = () => useQuery({
    queryKey: [ 'content', 'quests' ],
    queryFn: () => api<{ canManage: boolean; countedTypes: string[]; campaigns: QuestCampaign[] }>('/quests'),
});

/** Saves (no id adds) or takes away one thing under `/quests/<path>`; the lists are asked again after. */
const useQuestChange = <T>(path: string) => {
    const queryClient = useQueryClient();
    const settle = () => void queryClient.invalidateQueries({ queryKey: [ 'content' ] });

    const save = useMutation({
        mutationFn: ({ id, input }: { id: number | null; input: T }) => (id === null
            ? post<{ id: number }>(`/quests/${path}`, input)
            : put<{ id: number }>(`/quests/${path}/${id}`, input)),
        onSuccess: settle,
    });
    const drop = useMutation({
        mutationFn: (id: number) => remove<void>(`/quests/${path}/${id}`),
        onSuccess: settle,
    });

    return { save, drop };
};

export const useDailyTaskChange = () => useQuestChange<DailyTaskInput>('daily-tasks');
export const useCampaignChange = () => useQuestChange<QuestCampaignInput>('campaigns');
export const useQuestItemChange = () => useQuestChange<QuestInput>('quests');

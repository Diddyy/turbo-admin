import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, post, put, remove } from './client';

export interface PollListItem {
    id: number;
    roomId: number;
    roomName: string | null;
    headline: string;
    enabled: boolean;
    npsPoll: boolean;
    questions: number;
    /** Opened it, not done yet. */
    started: number;
    finished: number;
    /** Said no: never offered to them again. */
    rejected: number;
}

export type PollQuestionType = 'single' | 'multiple' | 'line' | 'area';

export interface PollChoice {
    id: number | null;
    /** What the client answers with. */
    value: string;
    /** What it shows. */
    text: string;
    choiceType: number;
}

export interface PollQuestion {
    /** Null for a new one; a question kept by its id keeps its answers. */
    id: number | null;
    /** The index of the question it follows up in a score poll; null for one of its own. */
    parent: number | null;
    sortOrder: number;
    type: PollQuestionType;
    text: string;
    category: number;
    answerType: number;
    choices: PollChoice[];
}

export interface PollInput {
    roomId: number;
    type: string;
    headline: string;
    summary: string;
    startMessage: string;
    endMessage: string;
    npsPoll: boolean;
    enabled: boolean;
    questions: PollQuestion[];
}

export interface PollQuestionResult {
    questionId: number;
    answered: number;
    choices: { value: string; count: number }[];
    texts: { playerId: number; playerName: string | null; text: string; atUtc: string }[];
}

export interface PollDetail extends PollInput {
    id: number;
    roomName: string | null;
    started: number;
    finished: number;
    rejected: number;
    results: PollQuestionResult[];
}

export const usePolls = () => useQuery({
    queryKey: [ 'content', 'polls' ],
    queryFn: () => api<{ canManage: boolean; polls: PollListItem[] }>('/polls'),
});

export const usePoll = (id: number | null) => useQuery({
    queryKey: [ 'content', 'polls', id ],
    queryFn: () => api<PollDetail>(`/polls/${id}`),
    enabled: id !== null,
});

/** Saves (no id adds) or deletes a poll; players entering its room see the change at once. */
export const usePollChange = () => {
    const queryClient = useQueryClient();
    const settle = () => void queryClient.invalidateQueries({ queryKey: [ 'content', 'polls' ] });

    const save = useMutation({
        mutationFn: ({ id, input }: { id: number | null; input: PollInput }) => (id === null
            ? post<{ id: number }>('/polls', input)
            : put<{ id: number }>(`/polls/${id}`, input)),
        onSuccess: settle,
    });
    const drop = useMutation({
        mutationFn: (id: number) => remove<void>(`/polls/${id}`),
        onSuccess: settle,
    });

    return { save, drop };
};

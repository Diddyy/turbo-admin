import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, post, remove } from './client';

export interface WordFilterEntry {
    id: number;
    word: string;
    addedAtUtc: string;
}

/** The hotel's word filter: what a word is replaced with, whether you may change it, and its words. */
export interface WordFilterResponse {
    replacement: string;
    canManage: boolean;
    words: WordFilterEntry[];
}

export interface WordFilterAddResponse {
    added: string[];
    existing: string[];
    refused: { word: string; reason: string }[];
}

export interface WordFilterTestResponse {
    shown: string;
    filtered: boolean;
}

export const useWordFilter = () => useQuery({
    queryKey: [ 'word-filter' ],
    queryFn: () => api<WordFilterResponse>('/word-filter'),
});

/** Adds the words typed (spaces, commas or new lines between them); the hotel filters them at once. */
export const useAddFilterWords = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (words: string) => post<WordFilterAddResponse>('/word-filter', { words }),
        onSettled: () => void queryClient.invalidateQueries({ queryKey: [ 'word-filter' ] }),
    });
};

export const useRemoveFilterWord = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: number) => remove<void>(`/word-filter/${id}`),
        onSettled: () => void queryClient.invalidateQueries({ queryKey: [ 'word-filter' ] }),
    });
};

/** A line as players would see it with the list as it is now. */
export const useTestWordFilter = () => useMutation({
    mutationFn: (text: string) => post<WordFilterTestResponse>('/word-filter/test', { text }),
});

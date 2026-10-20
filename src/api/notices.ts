import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, post, put, remove } from './client';
import type { ChangeSet, TextSearchResult, VariableSearchResult } from './gamedata';
import type { HotelViewHabboEntry } from './hotelView';

/** What every key of the client's new feature notices starts with, variables and texts alike. */
export const NOTICE_PREFIX = 'notifications.new_feature.';

/** The hotel's notice variables (each value as JSON) and texts, by key. */
export interface NoticeData {
    variables: Record<string, string>;
    texts: Record<string, string>;
}

/** Every page of a search, as one list. */
const allPages = async <T>(read: (page: number) => Promise<{ items: T[]; total: number; pageSize: number }>) => {
    const first = await read(0);
    const items = [ ...first.items ];

    for (let page = 1; page * first.pageSize < first.total; page++)
        items.push(...(await read(page)).items);

    return items;
};

/** The hotel's notices as the client reads them: its `notifications.new_feature.*` variables and texts. */
export const useNotices = () => useQuery({
    queryKey: [ 'gamedata', 'notices' ],
    queryFn: async (): Promise<NoticeData> => {
        const query = (path: string, page: number) => `/gamedata/${path}?${new URLSearchParams({ q: NOTICE_PREFIX, page: String(page) })}`;
        const [ variables, texts ] = await Promise.all([
            allPages(page => api<VariableSearchResult>(query('variables', page))),
            allPages(page => api<TextSearchResult>(query('texts', page))),
        ]);

        return {
            // The search matches values too: only the keys under the prefix are notices'.
            variables: Object.fromEntries(variables.filter(x => x.key.startsWith(NOTICE_PREFIX)).map(x => [ x.key, x.value ])),
            texts: Object.fromEntries(texts.filter(x => x.key.startsWith(NOTICE_PREFIX)).map(x => [ x.key, x.value ])),
        };
    },
});

/** Habbo's variables under a prefix now, against the hotel's. */
export interface HabboVariablesPreview {
    domain: string;
    prefix: string;
    variables: HotelViewHabboEntry[];
    /** The hotel's under the prefix Habbo has none of. */
    missing: string[];
}

/** Habbo's notices now, read from Habbo when asked (and not again on its own). */
export const useHabboNotices = (enabled: boolean) => useQuery({
    queryKey: [ 'gamedata', 'notices', 'habbo' ],
    queryFn: () => api<HabboVariablesPreview>(`/gamedata/variables/habbo?${new URLSearchParams({ prefix: NOTICE_PREFIX })}`),
    enabled,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: false,
});

/** Habbo's texts of these keys, from the newest of its texts the hotel has found. */
export const useHabboNoticeTexts = (keys: string[], enabled: boolean) => useQuery({
    queryKey: [ 'gamedata', 'notices', 'habbo-texts', keys ],
    queryFn: () => post<{ texts: HotelViewHabboEntry[]; checkedAt: string | null }>('/gamedata/texts/habbo', { keys }),
    enabled: enabled && keys.length > 0,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
});

/** Changes to save: variables to a JSON value or null to remove, texts to a value or null to remove. */
export interface NoticeSave {
    variables: Record<string, string | null>;
    texts: Record<string, string | null>;
}

/**
 * Saves through the variables and texts the client reads: the variables set as one import (one
 * change set), each removed one and each text on its own.
 */
export const useSaveNotices = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (save: NoticeSave) => {
            const set = Object.entries(save.variables).filter((x): x is [ string, string ] => x[1] !== null);
            let changeSet: ChangeSet | null = null;

            if (set.length)
                changeSet = (await post<{ changeSet: ChangeSet | null }>('/gamedata/variables/import', {
                    json: JSON.stringify(Object.fromEntries(set.map(([ key, value ]) => [ key, JSON.parse(value) as unknown ]))),
                    removeMissing: false,
                })).changeSet;

            for (const [ key, value ] of Object.entries(save.variables))
                if (value === null) await remove<void>(`/gamedata/variables?${new URLSearchParams({ key })}`);

            for (const [ key, value ] of Object.entries(save.texts)) {
                if (value === null) await remove<void>(`/gamedata/texts?${new URLSearchParams({ key })}`);
                else await put('/gamedata/texts', { key, value });
            }

            return changeSet;
        },
        onSettled: () => void queryClient.invalidateQueries({ queryKey: [ 'gamedata' ] }),
    });
};

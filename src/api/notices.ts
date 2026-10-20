import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { openZip } from '#/lib/zip';
import { dataUrlOf } from '#/preview/images';

import { useClientAssets } from './assets';
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
        // Answered once the notices are read back, so a saved notice's draft can go without a flash of the old one.
        onSettled: () => queryClient.invalidateQueries({ queryKey: [ 'gamedata' ] }),
    });
};

/** The client library a notice's image name is looked up in, and what its files are called. */
const WINDOW_LIBRARY = 'habbo-window-manager-com';
const WINDOW_IMAGE = new RegExp(`^${WINDOW_LIBRARY}-(.+)\\.png$`);

/**
 * The client's own images a notice can name (`static_bitmap.assetUri` without a `/`): the PNGs of
 * the `habbo-window-manager-com` template bundle, read from where the client loads it
 * (`asset.bundles.templates`), by name. Null names none: the bundle's address isn't known, or it
 * couldn't be read.
 */
export const useClientImages = () => {
    const template = useClientAssets()?.templates ?? '';

    return useQuery({
        queryKey: [ 'notices', 'client-images', template ],
        queryFn: async () => {
            const response = await fetch(template.replaceAll('%libname%', WINDOW_LIBRARY));

            if (!response.ok)
                throw new Error(`The client's ${WINDOW_LIBRARY} bundle answered ${response.status}.`);

            const zip = openZip(await response.arrayBuffer());
            const files = new Map(zip.names.flatMap((file) => {
                const name = WINDOW_IMAGE.exec(file)?.[1];

                return name ? [ [ name, file ] as const ] : [];
            }));

            return {
                names: [ ...files.keys() ].sort(),
                has: (name: string) => files.has(name),
                url: async (name: string) => {
                    const file = files.get(name);
                    const data = file ? await zip.read(file) : null;

                    return data ? dataUrlOf(new Blob([ data as BlobPart ], { type: 'image/png' })) : null;
                },
            };
        },
        enabled: !!template,
        staleTime: Infinity,
        gcTime: Infinity,
        refetchOnWindowFocus: false,
        retry: false,
    });
};

/** One of the client's own images as a data url; null while unknown, or when the client has none by that name. */
export const useClientImageUrl = (name: string | null) => {
    const { data: images } = useClientImages();

    return useQuery({
        queryKey: [ 'notices', 'client-image', name ],
        queryFn: () => images!.url(name!),
        enabled: !!images && !!name && images.has(name),
        staleTime: Infinity,
        refetchOnWindowFocus: false,
    }).data ?? null;
};

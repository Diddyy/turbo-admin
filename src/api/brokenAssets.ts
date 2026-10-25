import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { postForm } from './bundles';
import { api, post } from './client';

export type BrokenAssetSourceId = 'client' | 'check' | 'catalog' | 'badge';

/** A fix that applies: take it from Habbo, upload it, or publish it. */
export type BrokenAssetAction = 'habbo' | 'upload' | 'publish';

/**
 * Something players can't load: where it was found (`source`) and what it is there (`key`), the
 * bundle it is when known (`kind`, `name`), why, and the fixes that apply. Any can be ignored.
 */
export interface BrokenAsset {
    source: BrokenAssetSourceId;
    key: string;
    title: string;
    kind: string | null;
    name: string | null;
    detail: string;
    /** Reports, pages that show it, or players who hold it. */
    count: number;
    actions: BrokenAssetAction[];
    /** Where to read more: the client error that told of it. */
    link: string | null;
    ignored: { note: string; playerId: number; playerName: string | null; ignoredAt: string } | null;
}

/** A source of broken assets; the clients' 404 reports are read only while the client errors plugin is loaded. */
export interface BrokenAssetSource {
    id: BrokenAssetSourceId;
    title: string;
    read: boolean;
    note: string | null;
    /** Broken assets found there, the ignored left out. */
    count: number;
}

const KEY = [ 'assets', 'broken' ];

export const useBrokenAssets = () => useQuery({
    queryKey: KEY,
    queryFn: () => api<{ sources: BrokenAssetSource[]; items: BrokenAsset[] }>('/assets/broken'),
});

const useRefresh = () => {
    const queryClient = useQueryClient();

    return () => void queryClient.invalidateQueries({ queryKey: KEY });
};

/** Ignores broken assets with one why, all or none; with `note` null, brings them back. */
export const useIgnoreBrokenAssets = () => {
    const refresh = useRefresh();

    return useMutation({
        mutationFn: ({ assets, note }: { assets: BrokenAsset[]; note: string | null }) =>
            post<void>(note === null ? '/assets/broken/unignore' : '/assets/broken/ignore', { assets: assets.map(({ source, key }) => ({ source, key })), note }),
        onSuccess: refresh,
    });
};

/** Keeps a GIF or PNG as a badge's picture, the one picture with no upload of its own. */
export const useUploadBadgePicture = () => {
    const refresh = useRefresh();

    return useMutation({
        mutationFn: ({ code, file }: { code: string; file: File }) => {
            const form = new FormData();

            form.append('code', code);
            form.append('file', file);

            return postForm<void>('/assets/broken/badge-picture', form);
        },
        onSuccess: refresh,
    });
};

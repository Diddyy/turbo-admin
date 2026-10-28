import { useQuery } from '@tanstack/react-query';

import { api, post, put } from './client';

export interface AiProvider {
    name: string;
    driver: string;
    url: string;
    model: string;
    hasKey: boolean;
    usable: boolean;
}

export interface AiOverview {
    providers: AiProvider[];
    failover: string[];
    plugins: { key: string; name: string; purpose: string; allowed: boolean }[];
    usage: { day: string; plugin: string; provider: string; model: string; calls: number; failed: number; inputTokens: number; outputTokens: number; cost: number }[];
    since: string;
}

export const useAi = (days: number) => useQuery({
    queryKey: [ 'plugins', 'ai', days ],
    queryFn: () => api<AiOverview | undefined>(`/plugins/ai/?days=${days}`),
});

export const setAiKey = (provider: string, key: string | null) => put<void>(`/plugins/ai/providers/${encodeURIComponent(provider)}/key`, { key });
export const testAi = (provider: string) => post<{ ok: boolean; message: string }>(`/plugins/ai/providers/${encodeURIComponent(provider)}/test`, {});

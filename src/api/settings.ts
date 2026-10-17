import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, put } from './client';

/** Where a setting's value comes from, lowest first: ServerSettingSource. */
export const SETTING_SOURCES: Record<number, string> = { 0: 'default', 1: 'appsettings', 2: 'panel', 3: 'environment' };

export const SOURCE = { default: 0, appSettings: 1, panel: 2, environment: 3 } as const;

/** One server setting. Values are JSON (`"text"`, `true`, `120`, `["a"]`); a secret's are always null. */
export interface ServerSetting {
    /** `Turbo:Rooms:MaxUsersPerRoom`. */
    path: string;
    /** `Turbo:Rooms`. */
    section: string;
    kind: 'string' | 'bool' | 'integer' | 'number' | 'enum' | 'duration' | 'list' | 'map' | 'json';
    /** The names an enum takes. */
    options: string[];
    summary: string;
    secret: boolean;
    /** Shown, never changed here: the panel stands on it. */
    startup: boolean;
    default: string | null;
    /** Configured now, every source applied. */
    value: string | null;
    /** What the server started with and uses now. */
    running: string | null;
    /** Whether it has a value: all a secret shows. */
    isSet: boolean;
    source: number;
    /** The file or variable that sets it: `appsettings.json`, `TURBO__Turbo__Rooms__X`, `command line`. */
    sourceName: string | null;
    /** Configured differs from running: applies after a restart. */
    pendingRestart: boolean;
    /** Read as it is used, so a change applies at once (`[LiveSetting]`). */
    live: boolean;
}

export interface SettingsResponse {
    settings: ServerSetting[];
    canManage: boolean;
}

export interface SettingChange {
    id: number;
    path: string;
    /** The panel's value before, as JSON; null when the panel didn't set it, or for a secret. */
    before: string | null;
    after: string | null;
    secret: boolean;
    playerId: number | null;
    changedAt: string;
}

export interface SettingHistoryPage {
    items: SettingChange[];
    total: number;
    pageSize: number;
}

export const useSettings = () => useQuery({
    queryKey: [ 'settings' ],
    queryFn: () => api<SettingsResponse>('/settings'),
});

export const useSettingHistory = (page: number) => useQuery({
    queryKey: [ 'settings', 'history', page ],
    queryFn: () => api<SettingHistoryPage>(`/settings/history?${new URLSearchParams({ page: String(page) })}`),
    placeholderData: keepPreviousData,
});

const useRefresh = () => {
    const queryClient = useQueryClient();

    // The external variables may follow a setting, so the gamedata is read again too.
    return () => {
        void queryClient.invalidateQueries({ queryKey: [ 'settings' ] });
        void queryClient.invalidateQueries({ queryKey: [ 'gamedata' ] });
    };
};

export const useSaveSetting = () => {
    const refresh = useRefresh();

    return useMutation({
        mutationFn: (setting: { path: string; value: string }) => put<ServerSetting>('/settings', setting),
        onSuccess: refresh,
    });
};

/** Puts a setting back to what appsettings.json (or its default) says. */
export const useResetSetting = () => {
    const refresh = useRefresh();

    return useMutation({
        mutationFn: (path: string) => api<void>(`/settings?${new URLSearchParams({ path })}`, { method: 'DELETE' }),
        onSuccess: refresh,
    });
};

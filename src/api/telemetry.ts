import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { api } from './client';

/** One day (UTC) of client health. Zero where nothing was reported. */
export interface ClientHealthDay {
    day: string;
    reports: number;
    players: number;
    fpsP50: number;
    fpsP95: number;
    memoryP50Mb: number;
    memoryP95Mb: number;
    latencyReports: number;
    latencyP50Ms: number;
    latencyP95Ms: number;
    lagWarnings: number;
}

/** How clients of one browser, system and kind of device ran. Player days count a player once a day. */
export interface ClientHealthDevice {
    browser: string;
    os: string;
    device: string;
    reports: number;
    playerDays: number;
    fpsP50: number;
    fpsP95: number;
    memoryP50Mb: number;
    memoryP95Mb: number;
    latencyReports: number;
    latencyP50Ms: number;
    latencyP95Ms: number;
    slowUpdates: number;
}

export interface ClientHealthRoom {
    roomId: number;
    roomName: string | null;
    lagWarnings: number;
    lagReports: number;
    fpsSamples: number;
    fpsP50: number;
    fpsP95: number;
    latencyReports: number;
    latencyP50Ms: number;
    playerDays: number;
}

export interface ClientLoginStepFigure {
    step: string;
    sessions: number;
    p50Ms: number;
    p95Ms: number;
}

export interface ClientHealthResponse {
    from: string;
    to: string;
    rawRetentionDays: number;
    days: ClientHealthDay[];
    devices: ClientHealthDevice[];
    rooms: ClientHealthRoom[];
    login: ClientLoginStepFigure[];
    filters: { browsers: string[]; oses: string[]; devices: string[] };
}

export interface ClientUsageEvent {
    category: string;
    type: string;
    action: string;
    count: number;
    playerDays: number;
}

export interface ClientUsageResponse {
    from: string;
    to: string;
    rawRetentionDays: number;
    days: { day: string; events: number; players: number }[];
    top: ClientUsageEvent[];
    categories: { category: string; count: number; playerDays: number }[];
}

export interface ClientFunnelStep {
    category: string;
    type: string;
    action: string;
    players: number;
}

export interface ClientPerformanceRow {
    at: string;
    playerId: number;
    playerName: string | null;
    roomId: number | null;
    roomName: string | null;
    browser: string;
    os: string;
    device: string;
    userAgent: string;
    fps: number;
    /** -1 when the browser does not say. */
    memoryMb: number;
    slowUpdates: number;
    garbageCollections: number;
}

export interface ClientLatencyRow {
    at: string;
    playerId: number;
    playerName: string | null;
    roomId: number | null;
    roomName: string | null;
    averageMs: number;
    validAverageMs: number;
    pings: number;
}

export interface ClientLagRow {
    at: string;
    playerId: number;
    playerName: string | null;
    roomId: number | null;
    roomName: string | null;
    warnings: number;
}

export interface ClientEventRow {
    at: string;
    roomId: number | null;
    roomName: string | null;
    category: string;
    type: string;
    action: string;
    extraString: string;
    extraInt: number;
}

export interface ClientTelemetryPlayerResponse {
    playerId: number;
    playerName: string | null;
    performance: ClientPerformanceRow[];
    latency: ClientLatencyRow[];
    lag: ClientLagRow[];
    events: ClientEventRow[];
    logins: { at: string; step: string; msSinceConnect: number }[];
}

export interface ClientTelemetryRoomResponse {
    roomId: number;
    roomName: string | null;
    days: ClientHealthDay[];
    performance: ClientPerformanceRow[];
    latency: ClientLatencyRow[];
    lag: ClientLagRow[];
}

/** A range of days, UTC, both ends included. */
export interface DayRange {
    from: string;
    to: string;
}

const query = (values: Record<string, string | number | undefined | null>) => {
    const params = new URLSearchParams();

    for (const [ key, value ] of Object.entries(values))
        if (value !== undefined && value !== null && value !== '')
            params.set(key, String(value));

    return params.toString();
};

export interface ClientHealthFilter extends DayRange {
    browser?: string;
    os?: string;
    device?: string;
    room?: number;
}

export const useClientHealth = (filter: ClientHealthFilter) => useQuery({
    queryKey: [ 'telemetry', 'health', filter ],
    queryFn: () => api<ClientHealthResponse>(`/telemetry/health?${query({ ...filter })}`),
    placeholderData: keepPreviousData,
});

export const useClientUsage = (range: DayRange, category: string) => useQuery({
    queryKey: [ 'telemetry', 'usage', range, category ],
    queryFn: () => api<ClientUsageResponse>(`/telemetry/usage?${query({ ...range, category })}`),
    placeholderData: keepPreviousData,
});

/** Each step is `category|type|action`; an empty part matches any. */
export const useClientFunnel = (range: DayRange, steps: string[]) => useQuery({
    queryKey: [ 'telemetry', 'funnel', range, steps ],
    queryFn: () => {
        const params = new URLSearchParams(query({ ...range }));

        steps.forEach(step => params.append('step', step));

        return api<ClientFunnelStep[]>(`/telemetry/funnel?${params.toString()}`);
    },
    enabled: steps.length > 0,
    placeholderData: keepPreviousData,
});

export const useClientTelemetryPlayer = (playerId: number, range: DayRange) => useQuery({
    queryKey: [ 'telemetry', 'player', playerId, range ],
    queryFn: () => api<ClientTelemetryPlayerResponse>(`/telemetry/players/${playerId}?${query({ ...range })}`),
});

export const useClientTelemetryRoom = (roomId: number, range: DayRange) => useQuery({
    queryKey: [ 'telemetry', 'room', roomId, range ],
    queryFn: () => api<ClientTelemetryRoomResponse>(`/telemetry/rooms/${roomId}?${query({ ...range })}`),
});

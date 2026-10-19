import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, post } from './client';
import { liveInterval } from './live';

export type ReportState = 'open' | 'picked' | 'closed';
export type ReportSource = 'room' | 'im' | 'photo' | 'forum';
export type CloseReason = 'resolved' | 'useless' | 'abusive';

/** A call for help. Names are null for a player or room that is gone. */
export interface ReportItem {
    id: number;
    atUtc: string;
    state: ReportState;
    source: ReportSource;
    topicId: number;
    /** The client's text for the topic, else its name. */
    topic: string;
    category: string;
    reporterId: number;
    reporterName: string | null;
    /** Null for a report about a room, or no one. */
    reportedId: number | null;
    reportedName: string | null;
    roomId: number | null;
    roomName: string | null;
    /** The moderator who holds it; null while nobody has picked it. */
    pickerId: number | null;
    pickerName: string | null;
    message: string;
    closedAtUtc: string | null;
    closeReason: CloseReason | null;
    sanctioned: boolean;
}

/** A run of reports, newest first, and how many are open and held across the hotel. */
export interface ReportListResponse {
    pageSize: number;
    hasOlder: boolean;
    hasNewer: boolean;
    open: number;
    picked: number;
    entries: ReportItem[];
}

export interface ReportChatLine {
    atUtc: string;
    playerId: number;
    playerName: string | null;
    text: string;
    /** Said by the reported player. */
    reported: boolean;
}

/** Reports about a player (or sent by one), and how they were closed. */
export interface ReportHistory {
    total: number;
    sanctioned: number;
    abusive: number;
    useless: number;
}

/** What closing with the default sanction would give: the next step of the hotel's ladder. */
export interface ReportSanction {
    name: 'ALERT' | 'MUTE' | 'BAN' | 'BAN_PERMANENT' | string;
    lengthHours: number;
}

export interface ReportDetailResponse {
    report: ReportItem;
    lines: ReportChatLine[];
    /** What an unlawful activity report gave. */
    givenName: string | null;
    givenEmail: string | null;
    photoId: string | null;
    itemId: number | null;
    groupId: number | null;
    groupName: string | null;
    forumThreadId: number | null;
    forumMessageId: number | null;
    appeal: 'none' | 'appealed' | 'upheld' | 'dismissed';
    aboutReported: ReportHistory | null;
    bySender: ReportHistory;
    defaultSanction: ReportSanction | null;
    /** The other open reports about the same player, newest first. */
    related: ReportItem[];
}

export interface ReportFilter {
    state: 'open' | 'closed' | 'all';
    /** A name or an id: reports they sent or that are about them. */
    player: string;
}

export interface ReportCursor {
    before?: number;
    after?: number;
}

/** How often the open reports are asked again without the live stream; with it, a change asks at once. */
const REFRESH_MS = 20_000;

export const useReports = (filter: ReportFilter, cursor: ReportCursor) => {
    const query = new URLSearchParams({ state: filter.state });

    if (filter.player)
        query.set('player', filter.player);

    if (cursor.before)
        query.set('before', String(cursor.before));

    if (cursor.after)
        query.set('after', String(cursor.after));

    return useQuery({
        queryKey: [ 'reports', filter, cursor ],
        queryFn: () => api<ReportListResponse>(`/reports?${query}`),
        placeholderData: keepPreviousData,
        refetchInterval: cursor.before || cursor.after ? false : liveInterval(REFRESH_MS),
    });
};

export const useReport = (id: number) => useQuery({
    queryKey: [ 'report', id ],
    queryFn: () => api<ReportDetailResponse>(`/reports/${id}`),
    refetchInterval: liveInterval(REFRESH_MS),
});

export interface CloseReportRequest {
    reason: CloseReason;
    /** Resolved only: gives the reported player the default sanction too. */
    sanction: boolean;
    /** Closes the other open reports about the same player with it. */
    withRelated: boolean;
}

/** Picks, lets go of and closes a report, as the mod tool does; the list and the report are asked again after. */
export const useReportAction = (id: number) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (action: { kind: 'pick' | 'release' } | { kind: 'close'; request: CloseReportRequest }) =>
            action.kind === 'close'
                ? post<ReportDetailResponse>(`/reports/${id}/close`, action.request)
                : post<ReportDetailResponse>(`/reports/${id}/${action.kind}`),
        onSuccess: detail => queryClient.setQueryData([ 'report', id ], detail),
        onSettled: () => {
            void queryClient.invalidateQueries({ queryKey: [ 'reports' ] });
            void queryClient.invalidateQueries({ queryKey: [ 'report' ] });
        },
    });
};

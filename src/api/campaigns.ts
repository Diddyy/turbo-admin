import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, ApiError, post, put, remove } from './client';

/**
 * What a calendar door gives. The client shows the gift by `productCode` (its product data name,
 * else the furni's class name) with `customImage` (under `image.library.url`) or else the furni's
 * icon; the rest is what is given, any mix of it.
 */
export interface CampaignGift {
    dayIndex: number;
    productCode: string;
    customImage: string;
    furnitureClassName: string;
    badgeCode: string;
    credits: number;
    /** A currency type (the hotel's currencies), given `currencyAmount` of. */
    currencyTypeId: number | null;
    currencyAmount: number;
    /** An avatar effect, one timed copy. */
    effectId: number | null;
}

/** A campaign calendar: one door a day for `days` days from `startsAt` (UTC); day 0 is the first. */
export interface CampaignCalendar {
    id: number;
    /** What the client sends back with a door, and the key of its title text (`campaign.calendar.<name>.title`). */
    name: string;
    image: string;
    startsAt: string;
    days: number;
    enabled: boolean;
    rewards: CampaignGift[];
}

/** The field a refused calendar is about (and the day of a gift's), as the server names it. */
export interface CampaignRefusal {
    message: string;
    field: string;
    dayIndex: number | null;
}

/** A save the server refused for one field, read from its answer; null for any other failure. */
export const refusalOf = (error: unknown): CampaignRefusal | null =>
    error instanceof ApiError && error.status === 400 && typeof error.body?.field === 'string'
        ? { message: error.message, field: error.body.field, dayIndex: typeof error.body.dayIndex === 'number' ? error.body.dayIndex : null }
        : null;

const KEY = [ 'campaign-calendars' ];

export const useCampaignCalendars = () => useQuery({
    queryKey: KEY,
    queryFn: () => api<{ calendars: CampaignCalendar[] }>('/campaign-calendars'),
});

export const useCampaignCalendar = (id: number | null) => useQuery({
    queryKey: [ ...KEY, id ],
    queryFn: () => api<CampaignCalendar>(`/campaign-calendars/${id}`),
    enabled: id !== null,
});

const useCalendarChange = <A, R>(call: (args: A) => Promise<R>) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: call,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
    });
};

/** Adds (id 0) or replaces a calendar with its gifts; answers with it as saved. */
export const useSaveCampaignCalendar = () => useCalendarChange((calendar: CampaignCalendar) => (calendar.id === 0
    ? post<CampaignCalendar>('/campaign-calendars', calendar)
    : put<CampaignCalendar>(`/campaign-calendars/${calendar.id}`, calendar)));

/** Removes a calendar, its gifts and who opened which door. */
export const useDeleteCampaignCalendar = () => useCalendarChange((id: number) => remove<undefined>(`/campaign-calendars/${id}`));

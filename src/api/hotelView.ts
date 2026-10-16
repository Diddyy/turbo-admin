import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, post, put } from './client';
import type { ChangeSet, VariableEntry } from './gamedata';

export interface HotelViewResponse {
    /** Every `landing.view.*` variable, by key, each value as JSON. */
    variables: VariableEntry[];
    canManage: boolean;
}

export interface HotelViewText {
    key: string;
    value: string;
}

/** Changes saved as one: variables to a JSON value or null to remove; texts to a value or null to remove. */
export interface HotelViewSave {
    variables: Record<string, string | null>;
    texts: Record<string, string | null>;
}

export const useHotelView = () => useQuery({
    queryKey: [ 'gamedata', 'hotel-view' ],
    queryFn: () => api<HotelViewResponse>('/gamedata/hotel-view'),
});

/** The hotel's texts of these keys; a key it has no text for is left out. */
export const useHotelViewTexts = (keys: string[]) => useQuery({
    queryKey: [ 'gamedata', 'hotel-view', 'texts', keys ],
    queryFn: () => post<{ texts: HotelViewText[] }>('/gamedata/hotel-view/texts', { keys }),
    placeholderData: keepPreviousData,
});

/** One of Habbo's reception values beside the hotel's: a variable's JSON, or a text. */
export interface HotelViewHabboEntry {
    key: string;
    /** Habbo's value. */
    value: string;
    /** The hotel's value; null when it has none. */
    current: string | null;
}

/** Habbo's reception as its external variables have it now, against the hotel's. */
export interface HotelViewHabboPreview {
    domain: string;
    /** Habbo's reception variables, each written as JSON the way the hotel's is. */
    variables: HotelViewHabboEntry[];
    /** The hotel's reception variables Habbo has none of. */
    missing: string[];
}

/** Habbo's reception now, read from Habbo when asked (and not again on its own). */
export const useHabboHotelView = (enabled: boolean) => useQuery({
    queryKey: [ 'gamedata', 'hotel-view', 'habbo' ],
    queryFn: () => api<HotelViewHabboPreview>('/gamedata/hotel-view/habbo'),
    enabled,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: false,
});

/** Habbo's values of these texts, from the newest of its texts the hotel has found. */
export const useHabboHotelViewTexts = (keys: string[], enabled: boolean) => useQuery({
    queryKey: [ 'gamedata', 'hotel-view', 'habbo-texts', keys ],
    queryFn: () => post<{ texts: HotelViewHabboEntry[]; checkedAt: string | null }>('/gamedata/hotel-view/habbo-texts', { keys }),
    enabled: enabled && keys.length > 0,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
});

/** Saves the hotel view's variables and texts as one change set, which rolls back as one. */
export const useSaveHotelView = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (save: HotelViewSave) => put<{ changeSet: ChangeSet | null }>('/gamedata/hotel-view', save),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: [ 'gamedata' ] });
            // The panel's pictures are read from the variables too.
            void queryClient.invalidateQueries({ queryKey: [ 'client-assets' ] });
        },
    });
};

/** Where an article's button goes: PromoArticleLinkType. */
export const ARTICLE_LINK_TYPES: Record<number, string> = { 0: 'Web page', 1: 'Client link', 2: 'No button' };

export interface PromoArticle {
    id: number;
    title: string;
    bodyText: string;
    buttonText: string;
    linkType: number;
    linkContent: string;
    /** The picture's path under the client's image library. */
    imageUrl: string;
    sortOrder: number;
    visible: boolean;
    /** UTC; null for at once. */
    startsAt: string | null;
    /** UTC; null for never. */
    endsAt: string | null;
}

export type PromoArticleDraft = Omit<PromoArticle, 'id' | 'sortOrder'>;

const useRefreshReception = () => {
    const queryClient = useQueryClient();

    return () => void queryClient.invalidateQueries({ queryKey: [ 'hotel-view' ] });
};

export const usePromoArticles = () => useQuery({
    queryKey: [ 'hotel-view', 'articles' ],
    queryFn: () => api<{ articles: PromoArticle[] }>('/hotel-view/articles'),
});

/** Adds an article (no id) at the end, or changes one. */
export const useSavePromoArticle = () => {
    const refresh = useRefreshReception();

    return useMutation({
        mutationFn: ({ id, ...article }: PromoArticleDraft & { id: number | null }) => (id === null
            ? post<PromoArticle>('/hotel-view/articles', article)
            : put<PromoArticle>(`/hotel-view/articles/${id}`, article)),
        onSuccess: refresh,
    });
};

export const useDeletePromoArticle = () => {
    const refresh = useRefreshReception();

    return useMutation({
        mutationFn: (id: number) => api<void>(`/hotel-view/articles/${id}`, { method: 'DELETE' }),
        onSuccess: refresh,
    });
};

export const useReorderPromoArticles = () => {
    const refresh = useRefreshReception();

    return useMutation({
        mutationFn: (ids: number[]) => put<void>('/hotel-view/articles/order', { ids }),
        onSuccess: refresh,
    });
};

/** How a community goal is played: CommunityGoalMode. */
export const GOAL_MODES: Record<number, string> = { 0: 'One meter', 1: 'Two sides', 2: 'Two sides, with a vote' };

export interface CommunityGoal {
    id: number;
    code: string;
    mode: number;
    /** UTC. */
    startsAt: string;
    /** UTC. */
    endsAt: string;
    levelScores: number[];
    rewardRanks: number[];
    sideOnePageId: number | null;
    sideTwoPageId: number | null;
}

export interface GoalContributor {
    playerId: number;
    name: string;
    figure: string;
    rank: number;
    score: number;
}

export interface GoalStanding {
    goalId: number;
    sideOne: number;
    sideTwo: number;
    contributors: number;
    votesOne: number;
    votesTwo: number;
    top: GoalContributor[];
}

export const useCommunityGoals = () => useQuery({
    queryKey: [ 'hotel-view', 'goals' ],
    queryFn: () => api<{ goals: CommunityGoal[] }>('/hotel-view/goals'),
});

export const useGoalStanding = (id: number | null) => useQuery({
    queryKey: [ 'hotel-view', 'goals', id, 'standing' ],
    queryFn: () => api<GoalStanding>(`/hotel-view/goals/${id}/standing`),
    enabled: id !== null,
    refetchInterval: 30_000,
});

/** Adds a goal (no id) or changes one. */
export const useSaveCommunityGoal = () => {
    const refresh = useRefreshReception();

    return useMutation({
        mutationFn: ({ id, ...goal }: Omit<CommunityGoal, 'id'> & { id: number | null }) => (id === null
            ? post<CommunityGoal>('/hotel-view/goals', goal)
            : put<CommunityGoal>(`/hotel-view/goals/${id}`, goal)),
        onSuccess: refresh,
    });
};

export const useDeleteCommunityGoal = () => {
    const refresh = useRefreshReception();

    return useMutation({
        mutationFn: (id: number) => api<void>(`/hotel-view/goals/${id}`, { method: 'DELETE' }),
        onSuccess: refresh,
    });
};

/** What brings a player closer to the bonus rare: BonusRareSource. */
export const BONUS_SOURCES: Record<number, string> = { 0: 'Credits bought', 1: 'Credits spent in the catalogue' };

/** What became of bought credits recorded: BonusRarePurchaseResult. */
export const PURCHASE_RESULTS: Record<number, string> = { 0: 'Recorded', 1: 'That receipt was recorded before: it counts once', 2: 'No running campaign counts bought credits', 3: 'Refused: no credits, no reference or no such player' };

export interface BonusRareCampaign {
    id: number;
    code: string;
    furnitureName: string;
    productCode: string;
    creditsRequired: number;
    source: number;
    /** UTC. */
    startsAt: string;
    /** UTC; null for never. */
    endsAt: string | null;
}

export interface BonusRareStanding {
    code: string;
    playersInProgress: number;
    rewardsGiven: number;
}

export const useBonusRareCampaigns = () => useQuery({
    queryKey: [ 'hotel-view', 'bonus-rare' ],
    queryFn: () => api<{ campaigns: BonusRareCampaign[] }>('/hotel-view/bonus-rare'),
});

export const useBonusRareStanding = (code: string | null) => useQuery({
    queryKey: [ 'hotel-view', 'bonus-rare', 'standing', code ],
    queryFn: () => api<BonusRareStanding>(`/hotel-view/bonus-rare/standing?${new URLSearchParams({ code: code ?? '' })}`),
    enabled: code !== null,
});

/** Adds a campaign (no id) or changes one. */
export const useSaveBonusRareCampaign = () => {
    const refresh = useRefreshReception();

    return useMutation({
        mutationFn: ({ id, ...campaign }: Omit<BonusRareCampaign, 'id'> & { id: number | null }) => (id === null
            ? post<BonusRareCampaign>('/hotel-view/bonus-rare', campaign)
            : put<BonusRareCampaign>(`/hotel-view/bonus-rare/${id}`, campaign)),
        onSuccess: refresh,
    });
};

export const useDeleteBonusRareCampaign = () => {
    const refresh = useRefreshReception();

    return useMutation({
        mutationFn: (id: number) => api<void>(`/hotel-view/bonus-rare/${id}`, { method: 'DELETE' }),
        onSuccess: refresh,
    });
};

/** Records credits a player bought, under the purchase's reference, for the bonus rare. */
export const useRecordBonusRarePurchase = () => {
    const refresh = useRefreshReception();

    return useMutation({
        mutationFn: (purchase: { playerId: number; credits: number; reference: string }) => post<{ result: number }>('/hotel-view/bonus-rare/purchases', purchase),
        onSuccess: refresh,
    });
};

/** A catalogue page the expiring page widget counts down to. */
export interface ExpiringPage {
    id: number;
    pageId: number;
    /** What the client opens it by, and finds its texts and teaser by. */
    pageName: string;
    /** UTC. */
    expiresAt: string;
    image: string;
}

export const useExpiringPages = () => useQuery({
    queryKey: [ 'hotel-view', 'expiring-pages' ],
    queryFn: () => api<{ pages: ExpiringPage[] }>('/hotel-view/expiring-pages'),
});

/** Sets a page's expiry, adding one or moving the one it has. */
export const useSaveExpiringPage = () => {
    const refresh = useRefreshReception();

    return useMutation({
        mutationFn: ({ pageId, expiresAt, image }: { pageId: number; expiresAt: string; image: string }) => put<ExpiringPage>(`/hotel-view/expiring-pages/${pageId}`, { expiresAt, image }),
        onSuccess: refresh,
    });
};

export const useDeleteExpiringPage = () => {
    const refresh = useRefreshReception();

    return useMutation({
        mutationFn: (pageId: number) => api<void>(`/hotel-view/expiring-pages/${pageId}`, { method: 'DELETE' }),
        onSuccess: refresh,
    });
};

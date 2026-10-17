import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { ChatStyleRegPoints } from '#/preview/chatBubble';

import { type AssetBundle, postForm } from './bundles';
import { api, post, put } from './client';

/** AchievementState, as the catalog numbers it. */
export const ACHIEVEMENT_STATES: Record<number, string> = { 0: 'Disabled', 1: 'Enabled', 2: 'Retired', 3: 'Off season', 4: 'Wired controlled' };

/** BadgeRarityType, as the badge directory numbers it. */
export const BADGE_RARITIES: Record<number, string> = { 0: 'Common', 1: 'Uncommon', 2: 'Rare', 3: 'Epic', 4: 'Mythical', 5: 'Legendary', 6: 'Unique' };

export interface AchievementItem {
    id: number;
    key: string;
    revision: number;
    category: string;
    subCategory: string;
    order: number;
    state: number;
    source: string;
    levels: number;
    firstBadge: string | null;
    lastBadge: string | null;
}

/** An achievement definition as the catalog keeps it: its own field names, in PascalCase. */
export interface AchievementDefinition {
    Id: number;
    Key: string;
    Revision: number;
    Category: string;
    SubCategory: string;
    Order: number;
    DisplayMethod: number;
    Source: string;
    SourceVersion: number;
    Reducer: number;
    UnitDivisor: number;
    Levels: AchievementLevel[];
    State: number;
    ActiveFromUtc: string | null;
    ActiveUntilUtc: string | null;
    Match: unknown;
    [field: string]: unknown;
}

export interface AchievementLevel {
    Requirement: number;
    BadgeCode: string;
    Score: number;
    Rewards: AchievementReward[];
}

export interface AchievementReward {
    Handler: string;
    Version: number;
    Currency: unknown;
    Amount: number;
    Payload: string;
}

export interface BadgeItem {
    code: string;
    holders: number;
    /** Pinned rarity; null when it is counted from how many hold it. */
    rarity: number | null;
}

export interface BadgeHolder {
    playerId: number;
    name: string;
    slot: number | null;
}

const useRefreshContent = () => {
    const queryClient = useQueryClient();

    return () => void queryClient.invalidateQueries({ queryKey: [ 'content' ] });
};

export const useAchievements = () => useQuery({
    queryKey: [ 'content', 'achievements' ],
    queryFn: () => api<{ achievements: AchievementItem[]; canManage: boolean }>('/content/achievements'),
});

/** Whether the staff member may change the content (`content.manage`): the achievements' answer says. */
export const useCanManageContent = () => useAchievements().data?.canManage ?? false;

export const useAchievementDefinition = (id: number | null) => useQuery({
    queryKey: [ 'content', 'achievements', id ],
    queryFn: () => api<{ definitionJson: string }>(`/content/achievements/${id}`),
    enabled: id !== null,
});

/** Checks a definition as publishing it would; saves nothing. */
export const useCheckAchievement = () => useMutation({
    mutationFn: (definitionJson: string) => post<{ revision: number }>('/content/achievements/check', { definitionJson }),
});

/** Publishes a definition as its achievement's next revision, on record with why. */
export const usePublishAchievement = () => {
    const refresh = useRefreshContent();

    return useMutation({
        mutationFn: ({ id, definitionJson, reason }: { id: number; definitionJson: string; reason: string }) => put<{ revision: number }>(`/content/achievements/${id}`, { definitionJson, reason }),
        onSuccess: refresh,
    });
};

export const useBadges = (text: string) => useQuery({
    queryKey: [ 'content', 'badges', text ],
    queryFn: () => api<{ badges: BadgeItem[] }>(`/content/badges?${new URLSearchParams({ q: text })}`),
    placeholderData: previous => previous,
});

export const useBadgeHolders = (code: string | null) => useQuery({
    queryKey: [ 'content', 'badges', code, 'holders' ],
    queryFn: () => api<{ holders: BadgeHolder[] }>(`/content/badges/${encodeURIComponent(code ?? '')}/holders`),
    enabled: code !== null,
});

export const useSetBadgeRarity = () => {
    const refresh = useRefreshContent();

    return useMutation({
        mutationFn: ({ code, rarity }: { code: string; rarity: number | null }) => put<void>(`/content/badges/${encodeURIComponent(code)}/rarity`, { rarity }),
        onSuccess: refresh,
    });
};

export const useGiveBadge = () => {
    const refresh = useRefreshContent();

    return useMutation({
        mutationFn: ({ code, playerId }: { code: string; playerId: number }) => post<void>(`/content/badges/${encodeURIComponent(code)}/holders`, { playerId }),
        onSuccess: refresh,
    });
};

export const useTakeBadge = () => {
    const refresh = useRefreshContent();

    return useMutation({
        mutationFn: ({ code, playerId }: { code: string; playerId: number }) => api<void>(`/content/badges/${encodeURIComponent(code)}/holders/${playerId}`, { method: 'DELETE' }),
        onSuccess: refresh,
    });
};

/** A text of the external texts, saved on its own as a change set of the gamedata. */
export const useSaveText = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (text: { key: string; value: string }) => put<unknown>('/gamedata/texts', text),
        onSuccess: () => void queryClient.invalidateQueries({ queryKey: [ 'gamedata' ] }),
    });
};

export interface NavigatorFlatCategory {
    id: number;
    name: string;
    visible: boolean;
    staffOnly: boolean;
    minRank: number;
    requiredNode: string | null;
    orderNum: number;
    automatic: boolean;
    automaticCategory: string | null;
    globalCategory: string | null;
    rooms: number;
}

export interface NavigatorEventCategory {
    id: number;
    name: string;
    visible: boolean;
    events: number;
}

export interface NavigatorTab {
    id: number;
    searchCode: string;
    visible: boolean;
    orderNum: number;
}

export interface NavigatorContent {
    flatCategories: NavigatorFlatCategory[];
    eventCategories: NavigatorEventCategory[];
    contexts: NavigatorTab[];
}

/** Which of the navigator's lists an edit is to: room categories, event categories or tabs. */
export type NavigatorList = 'categories' | 'event-categories' | 'tabs';

export const useNavigatorContent = () => useQuery({
    queryKey: [ 'content', 'navigator' ],
    queryFn: () => api<NavigatorContent>('/content/navigator'),
});

/** Adds (no id) or changes a row of one of the navigator's lists; a field left out keeps what it was. */
export const useSaveNavigator = () => {
    const refresh = useRefreshContent();

    return useMutation({
        mutationFn: ({ list, id, body }: { list: NavigatorList; id: number | null; body: Record<string, unknown> }) => (id === null
            ? post<{ id: number }>(`/content/navigator/${list}`, body)
            : put<{ id: number }>(`/content/navigator/${list}/${id}`, body)),
        onSuccess: refresh,
    });
};

export const useDeleteNavigator = () => {
    const refresh = useRefreshContent();

    return useMutation({
        mutationFn: ({ list, id }: { list: NavigatorList; id: number }) => api<void>(`/content/navigator/${list}/${id}`, { method: 'DELETE' }),
        onSuccess: refresh,
    });
};

/** GuildMemberRank, as groups number it. */
export const GROUP_RANKS: Record<number, string> = { 0: 'Owner', 1: 'Admin', 2: 'Member', 3: 'Requested', 4: 'Blocked' };

/** GuildType. */
export const GROUP_TYPES: Record<number, string> = { 0: 'Open', 1: 'Exclusive', 2: 'Private', 3: 'Large', 4: 'Open, large' };

/** GuildBadgePartType, and GuildColorSlotType. */
export const PART_TYPES: Record<number, string> = { 0: 'Base', 1: 'Symbol' };
export const COLOR_SLOTS: Record<number, string> = { 0: 'Badge', 1: 'Primary', 2: 'Secondary' };

export interface GroupItem {
    id: number;
    name: string;
    badgeCode: string;
    ownerId: number;
    ownerName: string;
    roomId: number;
    roomName: string;
    type: number;
    members: number;
    createdAt: string;
}

export interface GroupDetail {
    id: number;
    name: string;
    description: string;
    badgeCode: string;
    type: number;
    ownerId: number;
    ownerName: string;
    roomId: number;
    roomName: string;
    createdAt: string;
    members: { playerId: number; name: string; rank: number }[];
}

export interface GroupBadgePart {
    id: number;
    partType: number;
    partId: number;
    fileName: string;
    maskFileName: string;
}

export interface GroupColor {
    id: number;
    slot: number;
    colorId: number;
    color: string;
}

export const useGroups = (text: string, page: number) => useQuery({
    queryKey: [ 'content', 'groups', text, page ],
    queryFn: () => api<{ groups: GroupItem[]; total: number; pageSize: number }>(`/content/groups?${new URLSearchParams({ q: text, page: String(page) })}`),
    placeholderData: previous => previous,
});

export const useGroup = (id: number | null) => useQuery({
    queryKey: [ 'content', 'groups', 'detail', id ],
    queryFn: () => api<GroupDetail>(`/content/groups/${id}`),
    enabled: id !== null,
});

export const useGroupEditor = () => useQuery({
    queryKey: [ 'content', 'groups', 'editor' ],
    queryFn: () => api<{ parts: GroupBadgePart[]; colors: GroupColor[] }>('/content/groups/editor'),
});

/** A staff change to a group: renamed, its badge reset, a member removed, or deleted. */
export const useGroupAction = () => {
    const refresh = useRefreshContent();

    return useMutation({
        mutationFn: (action: { id: number; rename?: { name: string; description: string }; resetBadge?: true; removeMember?: number; remove?: true }) => {
            if (action.rename) return put<void>(`/content/groups/${action.id}`, action.rename);
            if (action.resetBadge) return post<void>(`/content/groups/${action.id}/reset-badge`);
            if (action.removeMember !== undefined) return api<void>(`/content/groups/${action.id}/members/${action.removeMember}`, { method: 'DELETE' });

            return api<void>(`/content/groups/${action.id}`, { method: 'DELETE' });
        },
        onSuccess: refresh,
    });
};

/** Adds (no id) or changes a badge part or colour of the group badge editor. */
export const useSaveGroupEditor = () => {
    const refresh = useRefreshContent();

    return useMutation({
        mutationFn: ({ kind, id, body }: { kind: 'parts' | 'colors'; id: number | null; body: Record<string, unknown> }) => (id === null
            ? post<{ id: number }>(`/content/groups/${kind}`, body)
            : put<{ id: number }>(`/content/groups/${kind}/${id}`, body)),
        onSuccess: refresh,
    });
};

export interface PetBreed {
    id: number;
    typeId: number;
    paletteId: number;
    breedId: number;
    rarityLevel: number;
    sellable: boolean;
    rare: boolean;
    colorTag: number;
}

export interface PetLine {
    id: number;
    /** Null: said by every type without lines of its own. */
    typeId: number | null;
    line: string;
}

/** AvatarDanceType. */
export const DANCES: Record<number, string> = { 0: 'Not dancing', 1: 'Dance', 2: 'Pogo mogo', 3: 'Duck funk', 4: 'The Rollie' };

export interface BotItem {
    id: number;
    name: string;
    motto: string;
    figure: string;
    gender: number;
    ownerId: number;
    ownerName: string;
    roomId: number | null;
    roomName: string | null;
    chatText: string;
    autoChat: boolean;
    chatDelaySeconds: number;
    mixSentences: boolean;
    freeRoam: boolean;
    dance: number;
}

export const usePets = () => useQuery({
    queryKey: [ 'content', 'pets' ],
    queryFn: () => api<{ breeds: PetBreed[]; speech: PetLine[] }>('/content/pets'),
});

/** Adds (no id) or changes a pet palette or a line pets say. */
export const useSavePet = () => {
    const refresh = useRefreshContent();

    return useMutation({
        mutationFn: ({ kind, id, body }: { kind: 'breeds' | 'speech'; id: number | null; body: Record<string, unknown> }) => (id === null
            ? post<{ id: number }>(`/content/pets/${kind}`, body)
            : put<{ id: number }>(`/content/pets/${kind}/${id}`, body)),
        onSuccess: refresh,
    });
};

export const useDeletePetLine = () => {
    const refresh = useRefreshContent();

    return useMutation({
        mutationFn: (id: number) => api<void>(`/content/pets/speech/${id}`, { method: 'DELETE' }),
        onSuccess: refresh,
    });
};

export const useBots = (text: string, page: number) => useQuery({
    queryKey: [ 'content', 'bots', text, page ],
    queryFn: () => api<{ bots: BotItem[]; total: number; pageSize: number }>(`/content/bots?${new URLSearchParams({ q: text, page: String(page) })}`),
    placeholderData: previous => previous,
});

/** Sets a placed bot, takes one out of its room, or deletes one from an inventory. */
export const useBotAction = () => {
    const refresh = useRefreshContent();

    return useMutation({
        mutationFn: (action: { id: number; edit?: Omit<BotItem, 'id' | 'ownerId' | 'ownerName' | 'roomId' | 'roomName'>; pickup?: true; remove?: true }) => {
            if (action.edit) return put<void>(`/content/bots/${action.id}`, action.edit);
            if (action.pickup) return post<void>(`/content/bots/${action.id}/pickup`);

            return api<void>(`/content/bots/${action.id}`, { method: 'DELETE' });
        },
        onSuccess: refresh,
    });
};

/** What a currency is: credits, silver, emeralds, or a kind of activity points the client shows by its number. */
export type CurrencyKind = 'credits' | 'silver' | 'emeralds' | 'activity_points';

/** A currency type, and what uses it: players holding it, catalog offers priced in it, vouchers giving it. */
export interface Currency {
    id: number;
    /** How :give names it: lowercase letters, digits and _. */
    name: string;
    type: CurrencyKind;
    /** The number the client shows activity points by (0 duckets, 5 diamonds); null for the rest. */
    activityPointType: number | null;
    enabled: boolean;
    holders: number;
    offers: number;
    vouchers: number;
}

export interface CurrencyInput {
    name: string;
    type: CurrencyKind;
    activityPointType: number | null;
    enabled: boolean;
}

export const useCurrencies = () => useQuery({
    queryKey: [ 'content', 'currencies' ],
    queryFn: () => api<{ items: Currency[] }>('/content/currencies'),
});

/** Adds (no id) or changes a currency; the server's wallets, vouchers and :give use it at once. */
export const useSaveCurrency = () => {
    const refresh = useRefreshContent();

    return useMutation({
        mutationFn: ({ id, input }: { id: number | null; input: CurrencyInput }) => (id === null
            ? post<{ id: number }>('/content/currencies', input)
            : put<{ id: number }>(`/content/currencies/${id}`, input)),
        onSuccess: refresh,
    });
};

/** Deletes a currency nothing uses. */
export const useDeleteCurrency = () => {
    const refresh = useRefreshContent();

    return useMutation({
        mutationFn: (id: number) => api<void>(`/content/currencies/${id}`, { method: 'DELETE' }),
        onSuccess: refresh,
    });
};

/** Every bitmap a chat style can have: the three each has, then the ones only some do. */
export const CHAT_STYLE_FILES = [ 'chat_bubble_base', 'chat_bubble_pointer', 'selector_preview', 'chat_bubble_color', 'icon', 'chat_bubble_emblem', 'chat_bubble_emblem_multiline' ] as const;

export type ChatStyleFile = typeof CHAT_STYLE_FILES[number];

/**
 * A chat bubble style whole: the id the client draws it by and its asset id, who may speak with it
 * (the server checks each line), how it behaves, how it is drawn (its reg points and bitmaps, as
 * `chat-style-definitions.json` has them), and how many own it and have it as their bubble.
 * `drawable` says the bundle carries it: it needs reg points and its three bitmaps.
 */
export interface ChatStyle {
    id: number;
    clientStyleId: number;
    assetId: string;
    clubOnly: boolean;
    ambassadorOnly: boolean;
    staffOnly: boolean;
    purchasable: boolean;
    /** The server's own bubbles (bots, notices, wired): never a player's. */
    system: boolean;
    staffOverrideable: boolean;
    allowHtml: boolean;
    notification: boolean;
    regPoints: ChatStyleRegPoints | null;
    bitmaps: ChatStyleFile[];
    sortOrder: number;
    owners: number;
    preferring: number;
    drawable: boolean;
    /** Its look was taken from Habbo's HTML client. */
    fromClient: boolean;
    /** Taken from the client, then changed here: a new release leaves it alone unless told to replace it. */
    changedHere: boolean;
}

export interface ChatStyleList {
    items: ChatStyle[];
    /** The client id a new style takes. */
    nextId: number;
    /** `habbo-free-flow-chat-com`, built from these; null until the first is drawable. */
    bundle: AssetBundle | null;
    /** The library's own bitmaps, not a style's, kept for the build. */
    libraryBitmaps: number;
}

/**
 * A chat style to add or change: anything left out stays as it was (off, for a new one). `files`
 * sets bitmaps as base64 PNG, or takes an optional one away with null; a new style starts with the
 * bitmaps of `copyFrom` (a style's id) it does not set.
 */
export interface ChatStyleInput {
    clientStyleId?: number;
    assetId?: string;
    clubOnly?: boolean;
    ambassadorOnly?: boolean;
    staffOnly?: boolean;
    purchasable?: boolean;
    system?: boolean;
    staffOverrideable?: boolean;
    allowHtml?: boolean;
    notification?: boolean;
    regPoints?: ChatStyleRegPoints;
    files?: Partial<Record<ChatStyleFile, string | null>>;
    copyFrom?: number;
}

export interface ChatStyleImportResult {
    added: number;
    updated: number;
    libraryBitmaps: number;
    /** Styles changed here since they were taken from the client, left as they are. */
    kept: number;
}

const CHAT_STYLES = [ 'content', 'chat-styles' ];

export const useChatStyles = () => useQuery({
    queryKey: CHAT_STYLES,
    queryFn: () => api<ChatStyleList>('/content/chat-styles'),
});

/** A style's bitmap as the server keeps it. */
export const chatStyleBitmapPath = (id: number, file: ChatStyleFile) => `/content/chat-styles/${id}/bitmaps/${file}`;

/** Adds (no id) or changes a chat style; the bundle is built again, and the next line said follows it. */
export const useSaveChatStyle = () => {
    const refresh = useRefreshContent();

    return useMutation({
        mutationFn: ({ id, input }: { id: number | null; input: ChatStyleInput }) => (id === null
            ? post<{ id: number }>('/content/chat-styles', input)
            : put<{ id: number }>(`/content/chat-styles/${id}`, input)),
        onSuccess: refresh,
    });
};

/** Takes a chat style away, from the server and the bundle. */
export const useDeleteChatStyle = () => {
    const refresh = useRefreshContent();

    return useMutation({
        mutationFn: (id: number) => api<void>(`/content/chat-styles/${id}`, { method: 'DELETE' }),
        onSuccess: refresh,
    });
};

/**
 * Takes in a `habbo-free-flow-chat-com` bundle, a file or the address it is published at: each
 * style's look, and the hotel's say on who may use the ones it has.
 */
export const useImportChatStyles = () => {
    const refresh = useRefreshContent();

    return useMutation({
        mutationFn: (from: File | 'client' | 'client-replace') => {
            if (from === 'client' || from === 'client-replace')
                return post<ChatStyleImportResult>(`/content/chat-styles/import-client${from === 'client-replace' ? '?replace=true' : ''}`);

            const form = new FormData();

            form.append('file', from);

            return postForm<ChatStyleImportResult>('/content/chat-styles/import', form);
        },
        onSuccess: refresh,
    });
};

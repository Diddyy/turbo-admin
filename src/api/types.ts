/** The admin API's shapes, as Turbo.Admin serializes them (camelCase JSON). */

export interface AdminPlayer {
    id: number;
    name: string;
}

export interface SessionResponse {
    sessionToken: string;
    expiresAtUtc: string;
    player: AdminPlayer;
}

export interface MeResponse {
    id: number;
    name: string;
    sessionExpiresAtUtc: string;
    /** Holds `permissions.manage`: may change groups and players lighter than their heaviest group. */
    canManagePermissions: boolean;
    /** Holds `admin.passkeys.reset`: may give other staff a link to set up or replace their passkey. */
    canResetPasskeys: boolean;
    /** Holds `admin.rooms.view`: may find and inspect rooms. */
    canViewRooms: boolean;
    /** Holds `admin.permissions.view`: may see groups, players' permissions and the log. */
    canViewPermissions: boolean;
    /** Holds `admin.players.view`: may find any player and see their profile, wallet, rooms and sanctions. */
    canViewPlayers: boolean;
    /** Holds `admin.commandlog.view`: may read the command log. */
    canViewCommandLog: boolean;
    /** Holds `admin.catalog.view`: may see the catalog editor; changing it needs `catalog.manage`. */
    canViewCatalog: boolean;
    /** Holds `admin.chatlog.view`: may read the room chat log, whispers included. */
    canViewChatlog: boolean;
    canViewGamedata: boolean;
    /** Holds `admin.settings.view`: may see the server's settings; changing them needs `settings.manage`. */
    canViewSettings: boolean;
    /** Holds `admin.content.view`: may see the game's content; changing it needs `content.manage`. */
    canViewContent: boolean;
    /** Holds `admin.plugins.view`: may see the server's plugins; changing them needs `admin.plugins.manage`. */
    canViewPlugins: boolean;
    /** Holds `admin.rewardtracks.manage`: may see and change the reward tracks. */
    canManageRewardTracks: boolean;
    /** Holds `moderation.tool`, the mod tool's node: may read and close the calls for help. */
    canHandleReports: boolean;
    /** Holds `admin.messages.view`: may read players' private messages. */
    canViewMessages: boolean;
}

export interface DashboardRoom {
    id: number;
    name: string;
    ownerName: string;
    population: number;
    playersMax: number;
}

/** The server's `HotelAvailabilityPhase`; an unknown future phase still reads as a string. */
export type AvailabilityPhase = 'Open' | 'MaintenanceScheduled' | 'Maintenance' | 'ShutdownScheduled' | 'ShuttingDown' | (string & {});

export interface DashboardResponse {
    version: string;
    startedAtUtc: string;
    playersOnline: number;
    roomsLoaded: number;
    silosActive: number;
    silosTotal: number;
    workingSetMb: number;
    managedMb: number;
    availability: AvailabilityPhase;
    availabilityAtUtc: string | null;
    busiestRooms: DashboardRoom[];
}

export interface CommandInfo {
    name: string;
    aliases: string[];
    description: string;
    category: string;
    /** A room command: it only runs typed in a room, so the console cannot run it. */
    needsRoom: boolean;
    /** The help the game shows for it: the usage line first, then one line per parameter. */
    help: string[];
}

export interface CommandOutputLine {
    kind: 'reply' | 'notice';
    text: string;
}

/** The command runner's `CommandOutcome`, plus `NeedsRoom` for a room command the console cannot run. */
export type CommandOutcome = 'Completed' | 'Refused' | 'RoomLevel' | 'BindFailed' | 'Vetoed' | 'AwaitingConfirmation' | 'NeedsRoom' | (string & {});

export interface RunCommandResponse {
    found: boolean;
    outcome: CommandOutcome | null;
    lines: CommandOutputLine[];
}

export interface SetupInfoResponse {
    playerName: string;
    /** Finishing the setup replaces the passkeys the player already has. */
    replacesExisting: boolean;
}

export interface AccountPasskey {
    id: number;
    name: string;
    createdAtUtc: string;
    lastUsedAtUtc: string | null;
}

export interface AccountResponse {
    passkeys: AccountPasskey[];
}

export interface PasskeyLinkResponse {
    playerName: string;
    link: string;
    expiresAtUtc: string;
    /** Using it replaces every passkey the player has. */
    replacesExisting: boolean;
    /** Whether they hold `admin.panel`; without it the passkey signs them in to nothing. */
    hasPanelAccess: boolean;
}

export type RoomSearchMode = 'name' | 'owner' | 'id' | 'ownerId';

export interface RoomListItem {
    id: number;
    name: string;
    ownerId: number;
    ownerName: string;
    doorMode: string;
    playersMax: number;
    categoryName: string | null;
    isLoaded: boolean;
    population: number;
    lastActiveUtc: string;
}

export interface RoomListResponse {
    total: number;
    page: number;
    pageSize: number;
    rooms: RoomListItem[];
}

export interface RoomPlayerRef {
    id: number;
    name: string;
    /** Their figure, to draw them by; empty when it isn't known. */
    figure: string;
}

export interface RoomBanItem {
    playerId: number;
    name: string;
    figure: string;
    expiresAtUtc: string;
}

export interface RoomDetailResponse {
    id: number;
    name: string;
    description: string;
    ownerId: number;
    ownerName: string;
    model: string;
    categoryId: number | null;
    categoryName: string | null;
    tags: string[];
    doorMode: string;
    /** Whether the room has a password; the password itself is never sent. */
    hasPassword: boolean;
    playersMax: number;
    tradeMode: string;
    allowPets: boolean;
    allowPetsEat: boolean;
    allowWalkThrough: boolean;
    whoCanMute: string;
    whoCanKick: string;
    whoCanBan: string;
    chatFloodProtection: string;
    hideWalls: boolean;
    wallThickness: string;
    floorThickness: string;
    leaveOnDoorTile: boolean;
    idleSleepEnabled: boolean;
    idleSleepTimeoutSeconds: number;
    idleAutokickEnabled: boolean;
    idleAutokickTimeoutSeconds: number;
    muteAllPets: boolean;
    staffPick: boolean;
    hiddenByBuildersClub: boolean;
    score: number;
    createdAtUtc: string;
    lastActiveUtc: string;
    isLoaded: boolean;
    /** Null for a room that is not loaded: the panel never loads one to ask. */
    isMuted: boolean | null;
    playersInside: RoomPlayerRef[];
    rightsHolders: RoomPlayerRef[];
    bans: RoomBanItem[];
    can: RoomAbilities;
}

/** What the signed-in staff member may do to this room: the nodes the hotel asks for. */
export interface RoomAbilities {
    editSettings: boolean;
    staffPick: boolean;
    moderate: boolean;
    manageRights: boolean;
    kickAll: boolean;
    muteRoom: boolean;
    unload: boolean;
    alert: boolean;
}

export interface RoomCategoryItem {
    id: number;
    name: string;
    visible: boolean;
    staffOnly: boolean;
}

/** Every setting of a room, as the settings form saves it. Enums by name. */
export interface RoomSettingsRequest {
    name: string;
    description: string;
    doorMode: string;
    /** Empty keeps a password door's password. */
    password: string;
    maxPlayers: number;
    categoryId: number | null;
    tags: string[];
    tradeMode: string;
    allowPets: boolean;
    allowPetsEat: boolean;
    allowWalkThrough: boolean;
    hideWalls: boolean;
    wallThickness: string;
    floorThickness: string;
    whoCanMute: string;
    whoCanKick: string;
    whoCanBan: string;
    chatFloodProtection: string;
    leaveOnDoorTile: boolean;
    idleSleepEnabled: boolean;
    idleSleepTimeoutSeconds: number;
    idleAutokickEnabled: boolean;
    idleAutokickTimeoutSeconds: number;
    muteAllPets: boolean;
}

/**
 * The tables the chat style editor is drawn from: every flag a style has, and every bitmap it can
 * have, as nitro-react's `ChatStyleDefinitions.ts` types them. The flags are the hotel's: the
 * server checks each line by the first five, and the bundle it builds tells the client's picker
 * the same (`hcOnly`, `ambassadorOnly`, `purchasable`, `systemStyle`, and the rest as they are).
 */
import type { ChatStyle, ChatStyleFile } from '#/api/content';
import type { ChatStyleRegPoints } from '#/preview/chatBubble';

export type FlagKey = 'clubOnly' | 'ambassadorOnly' | 'staffOnly' | 'purchasable' | 'system' | 'staffOverrideable' | 'allowHtml' | 'notification';

export type Flags = Record<FlagKey, boolean>;

export const FLAG_FIELDS: { key: FlagKey; label: string; hint: string; group: 'who' | 'how' }[] = [
    { key: 'clubOnly', label: 'Club members only', hint: 'The picker offers it to club members, and only while they have the club may they speak with it.', group: 'who' },
    { key: 'purchasable', label: 'Owners only', hint: 'Offered once a player owns it: bought, or an NFT style they hold. The server checks they do.', group: 'who' },
    { key: 'ambassadorOnly', label: 'Ambassadors only', hint: 'Ambassadors, and staff.', group: 'who' },
    { key: 'staffOnly', label: 'Staff only', hint: 'Only those who may use the staff bubble (chat.style.staff). The client offers it by its own rules.', group: 'who' },
    { key: 'system', label: 'System', hint: 'The hotel\'s own - bots, notifications, wired: never offered, and no player may speak with it.', group: 'who' },
    { key: 'staffOverrideable', label: 'Staff may pick it anyway', hint: 'Staff are offered it whatever club or ambassador say.', group: 'who' },
    { key: 'allowHtml', label: 'Formatted text', hint: 'Its text may carry markup, drawn as formatting rather than as words.', group: 'how' },
    { key: 'notification', label: 'Notification', hint: 'A notification bubble: [b], [red]... markup in its text, and its icon centred down the bubble.', group: 'how' },
];

export const flagsOf = (style: ChatStyle | null): Flags => ({
    clubOnly: !!style?.clubOnly,
    ambassadorOnly: !!style?.ambassadorOnly,
    staffOnly: !!style?.staffOnly,
    purchasable: !!style?.purchasable,
    system: !!style?.system,
    staffOverrideable: !!style?.staffOverrideable,
    allowHtml: !!style?.allowHtml,
    notification: !!style?.notification,
});

/** Who may speak with a style, as a filter and as the icons on its card. */
export const WHO_FLAGS: FlagKey[] = [ 'clubOnly', 'purchasable', 'ambassadorOnly', 'staffOnly', 'system' ];

/** Every bitmap a style can have: the three each has, then the ones only some do. */
export const BITMAP_FIELDS: { file: ChatStyleFile; label: string; optional: boolean }[] = [
    { file: 'chat_bubble_base', label: 'The bubble, stretched through its nine-slice', optional: false },
    { file: 'chat_bubble_pointer', label: 'The pointer under it', optional: false },
    { file: 'selector_preview', label: 'Its picture in the style picker', optional: false },
    { file: 'chat_bubble_color', label: 'The colour layer, tinted in the speaker\'s shirt colour', optional: true },
    { file: 'icon', label: 'Its icon, drawn at the head\'s point in place of a head', optional: true },
    { file: 'chat_bubble_emblem', label: 'The emblem over the bubble', optional: true },
    { file: 'chat_bubble_emblem_multiline', label: 'The emblem once the words wrap', optional: true },
];

export const REQUIRED_FILES = BITMAP_FIELDS.filter(x => !x.optional).map(x => x.file);

/**
 * The shape a style without a look starts from when the hotel's normal bubble (0) has none to lend
 * it: the client's normal bubble's, as Habbo's habbo-free-flow-chat-com has it.
 */
export const STARTING_REG_POINTS: ChatStyleRegPoints = {
    scale9: { x: 29, y: 17, width: 1, height: 1 },
    faceXY: { x: 13, y: 12 },
    colorXY: { x: 0, y: 0 },
    textFieldMargins: { x: 28, y: 4, width: 12, height: 7 },
    overlapRect: { x: 0, y: -2, width: 0, height: 0 },
    pointerY: 23,
    fontSize: 12,
    textColorRGB: 0,
    fontFace: 'Ubuntu',
};

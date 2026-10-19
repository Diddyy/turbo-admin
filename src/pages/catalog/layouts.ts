/**
 * The page layouts the client draws, from Flash's `layout_<code>` templates and `PageLocalization`:
 * what each is for, which of a page's images and texts land somewhere on it (by their place in the
 * page's lists), and what its offers are used for. A value at a place the layout has no window
 * for is sent but never seen, so the editor offers only the places a layout shows.
 */

/**
 * How the editor previews a page of the layout: offers in a grid, the picked one shown big
 * (`grid`); one offer and all it gives (`bundle`); the front page's featured items (`featured`);
 * a pet to name (`pets`); floors and wallpapers by pattern (`spaces`); the club window, from
 * memberships anywhere (`club`); the club gifts (`gifts`); or words and pictures alone (`info`).
 */
export type LayoutKind = 'grid' | 'bundle' | 'featured' | 'pets' | 'spaces' | 'club' | 'gifts' | 'info';

export type LayoutGroup = 'Shop' | 'Front page' | 'Info' | 'Club' | 'Pets' | 'Groups' | 'Builders Club' | 'Hotel systems';

export interface LayoutSlot {
    /** Its place in the page's images or texts. */
    index: number;
    label: string;
    hint?: string;
    /** A text the client shows over several lines. */
    long?: boolean;
    /** Where the client puts it, when it is one of the places most layouts share. */
    role?: 'header' | 'teaser' | 'special' | 'description' | 'specialText';
}

export interface LayoutSpec {
    code: string;
    title: string;
    group: LayoutGroup;
    blurb: string;
    kind: LayoutKind;
    images: LayoutSlot[];
    texts: LayoutSlot[];
    /** What its offers do on it, when that isn't the usual buying. */
    offersNote?: string;
}

const HEADER_IMAGE: LayoutSlot = { index: 0, role: 'header', label: 'Header banner', hint: 'Across the top of the page, behind the title.' };
const TEASER_IMAGE: LayoutSlot = { index: 1, role: 'teaser', label: 'Teaser image', hint: 'Fills the preview until a product is picked.' };
const SPECIAL_IMAGE: LayoutSlot = { index: 2, role: 'special', label: 'Special image', hint: 'Beside the special text; hidden once a product is picked.' };
const HEADER_TEXT: LayoutSlot = { index: 0, role: 'header', label: 'Header line', hint: 'Under the title in the header.' };
const DESCRIPTION_TEXT: LayoutSlot = { index: 1, role: 'description', label: 'Description', hint: 'Under the preview; a picked product\'s own description replaces it.', long: true };
const SPECIAL_TEXT: LayoutSlot = { index: 2, role: 'specialText', label: 'Special text', hint: 'Beside the special image.', long: true };

const DEFAULT_SLOTS = { images: [ HEADER_IMAGE, TEASER_IMAGE, SPECIAL_IMAGE ], texts: [ HEADER_TEXT, DESCRIPTION_TEXT, SPECIAL_TEXT ] };
const HEADER_ONLY = { images: [ HEADER_IMAGE ], texts: [ HEADER_TEXT ] };
const DESCRIPTION_ONLY = { images: [ HEADER_IMAGE ], texts: [ { index: 0, label: 'Body', hint: 'This layout has no header line; the first text is the page\'s body.', long: true } ] };

const numbered = (from: number, count: number, first = 1): LayoutSlot[] =>
    Array.from({ length: count }, (_, i) => ({ index: from + i, label: `Text ${first + i}`, long: true }));

export const LAYOUTS: LayoutSpec[] = [
    { code: 'default_3x3', title: 'Shop grid', group: 'Shop', kind: 'grid', blurb: 'The everyday shop page: a grid of offers, the picked one shown big with its price.', ...DEFAULT_SLOTS },
    { code: 'default_3x3_color_grouping', title: 'Shop grid, colours grouped', group: 'Shop', kind: 'grid', blurb: 'Like the shop grid, but colours of one furni (throne*1, throne*2…) share one tile with swatches.', ...DEFAULT_SLOTS },
    { code: 'default_3x3_extrainfo', title: 'Shop grid, extra info', group: 'Shop', kind: 'grid', blurb: 'The shop grid; the client draws it as default_3x3.', ...DEFAULT_SLOTS },
    { code: 'pixeleffects', title: 'Effects', group: 'Shop', kind: 'grid', blurb: 'Avatar effects for sale; drawn as the shop grid.', ...DEFAULT_SLOTS },
    { code: 'bots', title: 'Bots', group: 'Shop', kind: 'grid', blurb: 'Bots for sale; drawn as the shop grid. A bot offer gives a figure.', ...DEFAULT_SLOTS },
    { code: 'single_bundle', title: 'Bundle', group: 'Shop', kind: 'bundle', blurb: 'One offer and everything in it, shown together, bought in one go. A badge in it shows as an add-on.', images: [ HEADER_IMAGE, TEASER_IMAGE, SPECIAL_IMAGE ], texts: [ HEADER_TEXT, DESCRIPTION_TEXT, SPECIAL_TEXT, { index: 3, label: 'Bundle text', long: true } ], offersNote: 'Only the first offer is shown: put the whole bundle in one offer.' },
    { code: 'badge_display', title: 'Badge displays', group: 'Shop', kind: 'grid', blurb: 'Badge display furni: the buyer picks one of their badges to put in it.', ...DEFAULT_SLOTS },
    { code: 'trophies', title: 'Trophies', group: 'Shop', kind: 'grid', blurb: 'Trophies with an engraving. Offers whose name keys end _g, _s and _b are one trophy in gold, silver and bronze.', images: [ HEADER_IMAGE, TEASER_IMAGE ], texts: [ { index: 0, label: 'Trophy description', long: true }, { index: 1, label: 'Engraving hint', hint: 'Over the engraving box.' } ] },
    { code: 'soundmachine', title: 'Trax songs', group: 'Shop', kind: 'grid', blurb: 'Song discs, with a preview of the song and its length.', images: [ HEADER_IMAGE, TEASER_IMAGE ], texts: [ HEADER_TEXT, DESCRIPTION_TEXT ] },
    { code: 'spaces_new', title: 'Spaces', group: 'Shop', kind: 'spaces', blurb: 'Floors, wallpapers and landscapes in three tabs, tried on a room preview.', images: [ HEADER_IMAGE, TEASER_IMAGE ], texts: [ HEADER_TEXT, DESCRIPTION_TEXT ], offersNote: 'Only wall items of class floor, wallpaper or landscape are shown; each one\'s extra parameter is its pattern (e.g. 101).' },
    { code: 'sold_ltd_items', title: 'Sold-out limited', group: 'Shop', kind: 'grid', blurb: 'Limited items that sold out: shown, never sold.', ...DEFAULT_SLOTS, offersNote: 'Every offer here shows as not available.' },
    { code: 'roomads', title: 'Room ads', group: 'Shop', kind: 'info', blurb: 'Promote a room in the navigator for a while.', ...HEADER_ONLY, offersNote: 'Two offers: the one for VIP (club level 2) extends an ad, the other buys one.' },

    { code: 'frontpage4', title: 'Front page', group: 'Front page', kind: 'featured', blurb: 'What the catalogue opens on: the featured items and a box to redeem vouchers.', images: [ HEADER_IMAGE ], texts: [ { index: 1, label: 'Voucher text', hint: 'Over the voucher box.', long: true } ], offersNote: 'Offers aren\'t shown; the featured items are.' },
    { code: 'frontpage_featured', title: 'Featured items', group: 'Front page', kind: 'featured', blurb: 'The featured items alone, without the voucher box.', ...HEADER_ONLY, offersNote: 'Offers aren\'t shown; the featured items are.' },

    { code: 'info_duckets', title: 'About duckets', group: 'Info', kind: 'info', blurb: 'Explains duckets. The purse opens the page named ducket_info.', ...DESCRIPTION_ONLY },
    { code: 'info_loyalty', title: 'About loyalty', group: 'Info', kind: 'info', blurb: 'Explains loyalty points. The purse opens the page named loyalty_info.', ...DESCRIPTION_ONLY },
    { code: 'info_rentables', title: 'About renting', group: 'Info', kind: 'info', blurb: 'Explains rentable furni, in up to five paragraphs.', images: [ HEADER_IMAGE ], texts: [ HEADER_TEXT, ...numbered(1, 5) ] },
    { code: 'monkey', title: 'Monkey promo', group: 'Info', kind: 'info', blurb: 'A promotion whose pictures link out (link.format.monkey).', images: [ HEADER_IMAGE, { index: 1, label: 'Link picture', hint: 'Opens link.format.monkey.' }, { index: 2, label: 'Second link picture', hint: 'Opens link.format.monkey.' } ], texts: [ HEADER_TEXT, DESCRIPTION_TEXT, SPECIAL_TEXT ] },
    { code: 'niko', title: 'Niko promo', group: 'Info', kind: 'info', blurb: 'A promotion whose pictures link out (link.format.niko).', images: [ HEADER_IMAGE, { index: 1, label: 'Link picture', hint: 'Opens link.format.niko.' }, { index: 2, label: 'Second link picture', hint: 'Opens link.format.niko.' } ], texts: [ HEADER_TEXT, DESCRIPTION_TEXT, SPECIAL_TEXT ] },

    { code: 'club_buy', title: 'Habbo Club shop', group: 'Club', kind: 'club', blurb: 'The club window: every shown Habbo Club membership, wherever its offer is. Name it hc_membership so the client\'s club buttons open it.', ...HEADER_ONLY, offersNote: 'It lists every shown membership in the catalog, not only its own offers.' },
    { code: 'vip_buy', title: 'VIP shop', group: 'Club', kind: 'club', blurb: 'VIP memberships.', images: [ HEADER_IMAGE, TEASER_IMAGE ], texts: [ HEADER_TEXT ] },
    { code: 'loyalty_vip_buy', title: 'VIP for loyalty', group: 'Club', kind: 'club', blurb: 'VIP bought with loyalty points.', images: [ HEADER_IMAGE, TEASER_IMAGE ], texts: [ HEADER_TEXT ] },
    { code: 'club_gifts', title: 'Club gifts', group: 'Club', kind: 'gifts', blurb: 'The gifts members claim for their months of club. Name it club_gifts.', ...HEADER_ONLY, offersNote: 'It lists every shown club gift in the catalog.' },

    { code: 'pets', title: 'Pet shop', group: 'Pets', kind: 'pets', blurb: 'Buy a pet: pick a breed and a colour, name it.', images: [ HEADER_IMAGE, { index: 1, label: 'Teaser image', hint: 'Replaced by the pet preview.' } ], texts: [ HEADER_TEXT, ...numbered(1, 3) ], offersNote: 'The first offer is the pet.' },
    { code: 'pets2', title: 'Pet info', group: 'Pets', kind: 'info', blurb: 'About pets.', images: [ HEADER_IMAGE, TEASER_IMAGE ], texts: [ HEADER_TEXT, ...numbered(1, 3) ] },
    { code: 'pets3', title: 'Pet info 2', group: 'Pets', kind: 'info', blurb: 'More about pets.', images: [ HEADER_IMAGE, TEASER_IMAGE ], texts: [ HEADER_TEXT, ...numbered(1, 3) ] },
    { code: 'petcustomization', title: 'Pet accessories', group: 'Pets', kind: 'grid', blurb: 'Saddles, shampoos and the like, tried on a pet preview. Name it pet_accessories for the pet infostand\'s link.', images: [ HEADER_IMAGE, TEASER_IMAGE ], texts: [ HEADER_TEXT, DESCRIPTION_TEXT ] },

    { code: 'guild_frontpage', title: 'Groups', group: 'Groups', kind: 'info', blurb: 'About groups, with the button that starts one.', images: [ HEADER_IMAGE, TEASER_IMAGE ], texts: [ HEADER_TEXT, DESCRIPTION_TEXT, SPECIAL_TEXT ] },
    { code: 'guild_custom_furni', title: 'Group furni', group: 'Groups', kind: 'grid', blurb: 'Furni in a group\'s colours; the buyer picks the group. Name it guild_custom_furni.', images: [ HEADER_IMAGE, TEASER_IMAGE ], texts: [ HEADER_TEXT, DESCRIPTION_TEXT ] },
    { code: 'guild_forum', title: 'Group forums', group: 'Groups', kind: 'grid', blurb: 'Buy a forum for a group; the first offer is picked for the buyer.', images: [ HEADER_IMAGE ], texts: [ HEADER_TEXT, DESCRIPTION_TEXT ] },

    { code: 'builders_club_frontpage', title: 'Builders Club', group: 'Builders Club', kind: 'info', blurb: 'The Builders Club\'s own front page, with its membership.', ...DESCRIPTION_ONLY },
    { code: 'builders_club_addons', title: 'Builders Club add-ons', group: 'Builders Club', kind: 'info', blurb: 'More Builders Club furni slots.', ...DESCRIPTION_ONLY },
    { code: 'recolorable_furniture', title: 'Recolorable furni', group: 'Builders Club', kind: 'grid', blurb: 'The recolorable building blocks (*_recolorable): a palette under the preview picks the colour a builder places each in.', images: [ HEADER_IMAGE, TEASER_IMAGE ], texts: [ HEADER_TEXT, DESCRIPTION_TEXT ], offersNote: 'Builders place these from the Builders Club, each in the colour picked from its palette below; the palettes are set on the server (Turbo:Rooms RecolorablePalettes).' },
    { code: 'builders_club_loyalty', title: 'Builders Club loyalty', group: 'Builders Club', kind: 'info', blurb: 'Builders Club for loyalty points.', ...DESCRIPTION_ONLY },

    { code: 'marketplace', title: 'Marketplace', group: 'Hotel systems', kind: 'info', blurb: 'The player marketplace.', ...HEADER_ONLY, offersNote: 'The marketplace\'s listings, not offers.' },
    { code: 'marketplace_own_items', title: 'My marketplace items', group: 'Hotel systems', kind: 'info', blurb: 'A player\'s own marketplace listings.', ...HEADER_ONLY },
    { code: 'recycler', title: 'Recycler', group: 'Hotel systems', kind: 'info', blurb: 'Opening it turns the inventory into the recycler.', ...HEADER_ONLY },
    { code: 'recycler_info', title: 'Recycler info', group: 'Hotel systems', kind: 'info', blurb: 'How the recycler works.', images: [ HEADER_IMAGE, TEASER_IMAGE ], texts: [ HEADER_TEXT, DESCRIPTION_TEXT, SPECIAL_TEXT ] },
    { code: 'recycler_prizes', title: 'Recycler prizes', group: 'Hotel systems', kind: 'info', blurb: 'What the recycler gives.', images: [ HEADER_IMAGE, TEASER_IMAGE ], texts: [ HEADER_TEXT ] },
];

export const LAYOUT_GROUPS: LayoutGroup[] = [ 'Shop', 'Front page', 'Info', 'Club', 'Pets', 'Groups', 'Builders Club', 'Hotel systems' ];

const BY_CODE = new Map(LAYOUTS.map(x => [ x.code, x ]));

/**
 * A layout's spec. A code the client has no template for draws an empty page; it still gets the
 * usual places, so whatever the page holds can be seen and cleared.
 */
export const layoutOf = (code: string): LayoutSpec => BY_CODE.get(code) ?? {
    code,
    title: code,
    group: 'Shop',
    kind: 'info',
    blurb: 'The client has no template for this layout, so the page shows empty.',
    ...DEFAULT_SLOTS,
};

export const isKnownLayout = (code: string) => BY_CODE.has(code);

/** Whether the layout sells its own offers, so they're worth arranging. */
export const showsOffers = (spec: LayoutSpec) => spec.kind === 'grid' || spec.kind === 'bundle' || spec.kind === 'pets' || spec.kind === 'spaces';

export type FieldKind = 'text' | 'int' | 'number' | 'bool' | 'colors';

export interface FieldInfo {
    key: string;
    label: string;
    kind: FieldKind;
    /** Only a floor item has it. */
    floor?: boolean;
    /** The server's own column: not furnidata's, so Habbo has no value of it and an import never changes it. */
    server?: boolean;
}

/** The fields a definition holds, as the server's FurnitureFields lists them: furnidata's, then the server's own. */
export const FIELDS: FieldInfo[] = [
    { key: 'name', label: 'Name', kind: 'text' },
    { key: 'description', label: 'Description', kind: 'text' },
    { key: 'category', label: 'Category', kind: 'text' },
    { key: 'furniline', label: 'Furni line', kind: 'text' },
    { key: 'environment', label: 'Environment', kind: 'text' },
    { key: 'revision', label: 'Revision', kind: 'int' },
    { key: 'specialtype', label: 'Special type', kind: 'int' },
    { key: 'defaultdir', label: 'Default direction', kind: 'int', floor: true },
    { key: 'xdim', label: 'Width (xdim)', kind: 'int', floor: true },
    { key: 'ydim', label: 'Length (ydim)', kind: 'int', floor: true },
    { key: 'height', label: 'Height', kind: 'number', floor: true },
    { key: 'partcolors', label: 'Part colours', kind: 'colors', floor: true },
    { key: 'adurl', label: 'Ad URL', kind: 'text' },
    { key: 'customparams', label: 'Custom params', kind: 'text', floor: true },
    { key: 'canstandon', label: 'Can stand on', kind: 'bool', floor: true },
    { key: 'cansiton', label: 'Can sit on', kind: 'bool', floor: true },
    { key: 'canlayon', label: 'Can lay on', kind: 'bool', floor: true },
    { key: 'canputstuffon', label: 'Can put stuff on', kind: 'bool', floor: true },
    { key: 'tradeable', label: 'Tradeable', kind: 'bool' },
    { key: 'recyclable', label: 'Recyclable', kind: 'bool' },
    { key: 'states', label: 'States (from its file)', kind: 'int' },
    { key: 'rare', label: 'Rare', kind: 'bool' },
    { key: 'excludeddynamic', label: 'Excluded dynamic', kind: 'bool' },
    { key: 'logic', label: 'Logic', kind: 'text', server: true },
    { key: 'usagepolicy', label: 'Who may use it', kind: 'int', server: true },
    { key: 'cangroup', label: 'Stacks in the inventory', kind: 'bool', server: true },
    { key: 'cansell', label: 'Sellable on the marketplace', kind: 'bool', server: true },
    { key: 'classname', label: 'Classname', kind: 'text', server: true },
    { key: 'id', label: 'Sprite id', kind: 'int', server: true },
    { key: 'extradata', label: 'Extra data (JSON)', kind: 'text', server: true },
];

/** What furnidata's specialtype says a furniture is, as the server's FurnitureCategory names them. */
export const SPECIAL_TYPES: { value: number; label: string }[] = [
    { value: 1, label: 'Default' },
    { value: 2, label: 'Wallpaper' },
    { value: 3, label: 'Floor' },
    { value: 4, label: 'Landscape' },
    { value: 5, label: 'Post-it' },
    { value: 6, label: 'Poster' },
    { value: 7, label: 'Sound set' },
    { value: 8, label: 'Trax song' },
    { value: 9, label: 'Present' },
    { value: 10, label: 'Ecotron box' },
    { value: 11, label: 'Trophy' },
    { value: 12, label: 'Credit furni' },
    { value: 13, label: 'Pet shampoo' },
    { value: 14, label: 'Pet custom part' },
    { value: 15, label: 'Pet custom part shampoo' },
    { value: 16, label: 'Pet saddle' },
    { value: 17, label: 'Group furni' },
    { value: 18, label: 'Game furni' },
    { value: 19, label: 'Monsterplant seed' },
    { value: 20, label: 'Monsterplant revival' },
    { value: 21, label: 'Monsterplant rebreed' },
    { value: 22, label: 'Monsterplant fertilize' },
    { value: 23, label: 'Purchasable clothing' },
];

/** Who may use a furniture (usagepolicy), as the server's FurnitureUsageType numbers them. */
export const USAGE_POLICIES: { value: number; label: string }[] = [
    { value: 0, label: 'Nobody' },
    { value: 1, label: 'With rights' },
    { value: 2, label: 'Everybody' },
];

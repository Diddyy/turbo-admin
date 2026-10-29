type ObjectData = Record<string, unknown>;

export interface VendingData {
    root: ObjectData;
    section: ObjectData;
    handItems: number[];
    animates: boolean;
}

const object = (value: unknown): value is ObjectData => value !== null && typeof value === 'object' && !Array.isArray(value);
const named = (value: ObjectData, name: string) => Object.entries(value).findLast(([ key ]) => key.toLowerCase() === name.toLowerCase())?.[1];

// Compare decimal values without first rounding them through JavaScript numbers.
const numberKey = (literal: string): string => {
    const [ mantissa = '', exponent = '0' ] = literal.toLowerCase().split('e');
    const [ integer = '', fraction = '' ] = mantissa.split('.');
    const negative = integer.startsWith('-');
    let digits = (integer.replace('-', '') + fraction).replace(/^0+/, '');
    if (!digits) return '0';
    let power = BigInt(exponent) - BigInt(fraction.length);
    while (digits.endsWith('0')) {
        digits = digits.slice(0, -1);
        power++;
    }
    return `${negative ? '-' : ''}${digits}e${power}`;
};

const numbersRoundTrip = (raw: string): boolean => {
    const tokens = raw.match(/"(?:[^"\\]|\\.)*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g) ?? [];
    return tokens.every(token => token.startsWith('"') || (Number.isFinite(Number(token)) && numberKey(token) === numberKey(JSON.stringify(Number(token)))));
};

/** Match the server's case-insensitive section properties and refuse destructive repairs. */
export const parseVendingData = (raw: string): VendingData | null => {
    try {
        if (!numbersRoundTrip(raw)) return null;
        const root: unknown = JSON.parse(raw.trim() || '{}');
        if (!object(root) || (root.vending !== undefined && !object(root.vending)))
            return null;
        const section = root.vending as ObjectData | undefined ?? {};
        const ids = named(section, 'handItems') === undefined ? [] : named(section, 'handItems');
        const animates = named(section, 'animates') === undefined ? true : named(section, 'animates');
        // Hand-item IDs travel as signed 32-bit protocol integers.
        if (!Array.isArray(ids) || ids.some(id => !Number.isInteger(id) || id <= 0 || id >= 2 ** 31) || typeof animates !== 'boolean')
            return null;
        return { root, section, handItems: ids as number[], animates };
    } catch {
        return null;
    }
};

/** Retain unrelated sections and extension properties while replacing the edited fields. */
export const writeVendingData = (data: VendingData, handItems: number[], animates = data.animates) => {
    const section = Object.fromEntries(Object.entries(data.section).filter(([ key ]) => ![ 'handitems', 'animates' ].includes(key.toLowerCase())));
    return JSON.stringify({ ...data.root, vending: { ...section, handItems: [ ...handItems ], animates } }, null, 2);
};

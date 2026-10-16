/** A Flash colour number as the `#rrggbb` string canvas takes: the low 24 bits, zero padded. */
export const toCssHexColor = (color: number): string => `#${(color & 0xFFFFFF).toString(16).padStart(6, '0')}`;

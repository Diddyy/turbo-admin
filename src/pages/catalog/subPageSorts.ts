import type { AddFurniSort } from '#/api/catalog';

/** The ways furni are sorted onto pages under a page, as the server sorts them. */
export const SORTS: { value: AddFurniSort; label: string }[] = [
    { value: 'kind', label: 'By kind' },
    { value: 'colour', label: 'By colour' },
    { value: 'kindColour', label: 'Kind, then colour' },
];

export const SORT_HINTS: Record<AddFurniSort, string> = {
    kind: 'A page under it for each kind: pillow, marquee, … Kinds of fewer than 3 share Other.',
    colour: 'A page under it for each colour: pink, blue, … Colours of fewer than 3 share Other colours.',
    kindColour: 'A page for each kind, and under a kind a page for each colour 3 of it share; the rest share Other colours.',
};

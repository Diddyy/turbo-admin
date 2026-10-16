/** What a preview stage is drawn on: a room's floor, the checkerboard, dark or light. */
import type { CSSProperties } from 'react';

export type Backdrop = 'room' | 'checker' | 'dark' | 'light';

const CHECKER: CSSProperties = {
    backgroundColor: '#ffffff',
    backgroundImage: 'linear-gradient(45deg, #d8dde3 25%, transparent 25%), linear-gradient(-45deg, #d8dde3 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #d8dde3 75%), linear-gradient(-45deg, transparent 75%, #d8dde3 75%)',
    backgroundSize: '16px 16px',
    backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0',
};

export const BACKDROPS: { value: Backdrop; label: string; style: CSSProperties }[] = [
    { value: 'room', label: 'A room\'s floor', style: { backgroundColor: '#8c7a58' } },
    { value: 'checker', label: 'Checkerboard', style: CHECKER },
    { value: 'dark', label: 'Dark', style: { backgroundColor: '#18181b' } },
    { value: 'light', label: 'Light', style: { backgroundColor: '#f4f4f5' } },
];

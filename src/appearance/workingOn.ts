import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { useThemes } from '#/api/appearance';
import { themeName } from '#/pages/appearance/themes';

/** The hotel's own data plugin: where staff edits land unless they work on a theme. */
export const HOTEL = 'hotel';

interface WorkingOnState {
    key: string;
    setKey: (key: string) => void;
}

const useWorkingOnStore = create<WorkingOnState>()(
    persist(
        set => ({
            key: HOTEL,
            setKey: key => set({ key }),
        }),
        { name: 'turbo-admin-working-on', storage: createJSONStorage(() => localStorage) },
    ),
);

/**
 * The theme staff work on (XenForo's development mode, one primitive for every appearance editor):
 * every style, patch, image, skin and font they save lands in its files (`plugins/<key>/`), the
 * hotel's own (`hotel`) by default. One the hotel no longer has falls back to the hotel.
 */
export const useWorkingOn = () => {
    const { key, setKey } = useWorkingOnStore();
    const { data } = useThemes();
    const theme = data?.themes.find(found => found.key === key);
    // Unknown until the list is read; then a theme gone (uninstalled, renamed) is the hotel again.
    const current = !data || theme ? key : HOTEL;

    return { key: current, name: theme ? themeName(theme) : themeName({ key: current, name: null }), hotel: current === HOTEL, setKey };
};

/** Where a theme's edits land, as staff read it. */
export const folderOf = (key: string) => `plugins/${key}/`;

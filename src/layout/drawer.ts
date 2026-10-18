import { create } from 'zustand';

interface DrawerState {
    open: boolean;
    setOpen: (open: boolean) => void;
}

/** Whether the menu is open on a phone or a tablet: the sidebar sliding in from the left, opened from the header. */
export const useDrawer = create<DrawerState>(set => ({
    open: false,
    setOpen: open => set({ open }),
}));

import { create } from 'zustand';

type NotificationStore = {
  unreadCount: number;
  isOpen: boolean;
  setUnreadCount: (count: number) => void;
  togglePanel: () => void;
  decrementUnread: () => void;
  setOpen: (isOpen: boolean) => void;
};

export const useNotificationStore = create<NotificationStore>((set) => ({
  unreadCount: 0,
  isOpen: false,
  setUnreadCount: (count) => set({ unreadCount: Math.max(0, count) }),
  togglePanel: () => set((s) => ({ isOpen: !s.isOpen })),
  decrementUnread: () => set((s) => ({ unreadCount: Math.max(0, s.unreadCount - 1) })),
  setOpen: (isOpen) => set({ isOpen }),
}));

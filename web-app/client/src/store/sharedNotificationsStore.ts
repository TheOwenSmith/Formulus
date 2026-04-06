import { create } from 'zustand';

const LAST_VIEWED_KEY = 'phoenix_shared_last_viewed';

interface SharedNotificationsStore {
  lastViewedAt: Date | null;
  markAsViewed: () => void;
}

export const useSharedNotificationsStore = create<SharedNotificationsStore>((set) => ({
  lastViewedAt: (() => {
    const stored = localStorage.getItem(LAST_VIEWED_KEY);
    return stored ? new Date(stored) : null;
  })(),
  markAsViewed: () => {
    const now = new Date();
    localStorage.setItem(LAST_VIEWED_KEY, now.toISOString());
    set({ lastViewedAt: now });
  },
}));

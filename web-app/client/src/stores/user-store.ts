import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UserState {
  hasAccount: boolean;
  setHasAccount: (hasAccount: boolean) => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      hasAccount: false,
      setHasAccount: (hasAccount: boolean) => set({ hasAccount }),
    }),
    {
      name: 'user-storage',
    },
  ),
);

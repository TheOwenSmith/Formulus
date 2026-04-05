import { create } from 'zustand';

interface BacktestStore {
  pendingAlgorithmIds: string[];
  pendingPublicId: string | null;
  setPending: (algorithmIds: string[], publicId: string) => void;
  clearPending: () => void;
}

export const useBacktestStore = create<BacktestStore>((set) => ({
  pendingAlgorithmIds: [],
  pendingPublicId: null,
  setPending: (algorithmIds, publicId) => set({ pendingAlgorithmIds: algorithmIds, pendingPublicId: publicId }),
  clearPending: () => set({ pendingAlgorithmIds: [], pendingPublicId: null }),
}));

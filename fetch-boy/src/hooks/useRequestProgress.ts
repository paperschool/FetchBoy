import { create } from 'zustand';

interface RequestProgressState {
  isRequestInFlight: boolean;
  requestProgress: number;
  startRequest: () => void;
  updateProgress: (progress: number) => void;
  completeRequest: () => void;
  cancelRequest: () => void;
  reset: () => void;
}

export const useRequestProgressStore = create<RequestProgressState>((set) => ({
  isRequestInFlight: false,
  requestProgress: 0,
  
  startRequest: () => set({ isRequestInFlight: true, requestProgress: 0 }),
  
  updateProgress: (progress) => set({ 
    requestProgress: Math.min(progress, 80) // Cap at 80% until complete
  }),
  
  completeRequest: () => set({ 
    requestProgress: 100,
    isRequestInFlight: false 
  }),
  
  cancelRequest: () => set({ 
    isRequestInFlight: false,
    requestProgress: 0 
  }),
  
  reset: () => set({ 
    isRequestInFlight: false, 
    requestProgress: 0 
  }),
}));

// Hook to automatically manage progress based on request state
export function useRequestProgress() {
  const store = useRequestProgressStore();
  
  // Simulate progress during request
  const simulateProgress = () => {
    const interval = setInterval(() => {
      const current = useRequestProgressStore.getState().requestProgress;
      if (current < 80) {
        useRequestProgressStore.getState().updateProgress(current + 10);
      }
    }, 200);
    return interval;
  };
  
  return {
    ...store,
    simulateProgress,
  };
}

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface TourState {
  hasCompletedTour: boolean;
  currentStep: number;
  setCurrentStep: (step: number) => void;
  completeTour: () => void;
  resetTour: () => void;
}

export const useTourStore = create<TourState>()(
  persist(
    (set) => ({
      hasCompletedTour: false,
      currentStep: 0,
      setCurrentStep: (step) => set({ currentStep: step }),
      completeTour: () => set({ hasCompletedTour: true, currentStep: 0 }),
      resetTour: () => set({ hasCompletedTour: false, currentStep: 0 }),
    }),
    {
      name: 'fetchboy-tour-storage',
    }
  )
);

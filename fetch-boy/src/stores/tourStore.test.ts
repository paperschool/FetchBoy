import { describe, it, expect, beforeEach } from 'vitest';
import { useTourStore } from './tourStore';
import { act } from '@testing-library/react';

beforeEach(() => {
  // Reset store to initial state before each test
  useTourStore.setState({ hasCompletedTour: false, currentStep: 0 });
  localStorage.clear();
});

describe('useTourStore', () => {
  it('has correct initial state', () => {
    const state = useTourStore.getState();
    expect(state.hasCompletedTour).toBe(false);
    expect(state.currentStep).toBe(0);
  });

  it('setCurrentStep updates currentStep', () => {
    act(() => {
      useTourStore.getState().setCurrentStep(3);
    });
    expect(useTourStore.getState().currentStep).toBe(3);
  });

  it('completeTour sets hasCompletedTour and resets currentStep', () => {
    act(() => {
      useTourStore.getState().setCurrentStep(2);
      useTourStore.getState().completeTour();
    });
    const state = useTourStore.getState();
    expect(state.hasCompletedTour).toBe(true);
    expect(state.currentStep).toBe(0);
  });

  it('resetTour clears hasCompletedTour and resets currentStep', () => {
    act(() => {
      useTourStore.getState().completeTour();
      useTourStore.getState().resetTour();
    });
    const state = useTourStore.getState();
    expect(state.hasCompletedTour).toBe(false);
    expect(state.currentStep).toBe(0);
  });

  it('resetTour from mid-tour resets step to 0', () => {
    act(() => {
      useTourStore.getState().setCurrentStep(3);
      useTourStore.getState().resetTour();
    });
    expect(useTourStore.getState().currentStep).toBe(0);
    expect(useTourStore.getState().hasCompletedTour).toBe(false);
  });
});

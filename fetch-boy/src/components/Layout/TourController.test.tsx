import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react';
import { TourController } from './TourController';
import { useTourStore } from '@/stores/tourStore';

// Mock react-joyride since it relies on DOM measurements not available in jsdom
vi.mock('react-joyride', () => ({
  default: vi.fn(({ run, stepIndex, steps, callback, showSkipButton }: {
    run: boolean;
    stepIndex: number;
    steps: Array<{ target: string; content: string; title?: string }>;
    callback: (data: { action: string; index: number; status: string; type: string }) => void;
    showSkipButton: boolean;
  }) => {
    if (!run) return null;
    const step = steps[stepIndex];
    if (!step) return null;
    return (
      <div data-testid="joyride-tooltip">
        {step.title && <div data-testid="joyride-title">{step.title}</div>}
        <div data-testid="joyride-content">{step.content}</div>
        <button
          data-testid="joyride-next"
          onClick={() => callback({ action: 'next', index: stepIndex, status: 'running', type: 'step:after' })}
        >
          Next
        </button>
        {showSkipButton && (
          <button
            data-testid="joyride-skip"
            onClick={() => callback({ action: 'skip', index: stepIndex, status: 'skipped', type: 'tour:end' })}
          >
            Skip
          </button>
        )}
        <button
          data-testid="joyride-finish"
          onClick={() => callback({ action: 'next', index: stepIndex, status: 'finished', type: 'tour:end' })}
        >
          Finish
        </button>
      </div>
    );
  }),
  ACTIONS: { PREV: 'prev', NEXT: 'next' },
  EVENTS: { STEP_AFTER: 'step:after', TARGET_NOT_FOUND: 'error:target_not_found' },
  STATUS: { FINISHED: 'finished', SKIPPED: 'skipped' },
}));

beforeEach(() => {
  useTourStore.setState({ hasCompletedTour: false, currentStep: 0 });
});

describe('TourController', () => {
  it('renders tour when not completed', () => {
    render(<TourController />);
    expect(screen.getByTestId('joyride-tooltip')).toBeInTheDocument();
  });

  it('renders nothing when tour is completed', () => {
    useTourStore.setState({ hasCompletedTour: true, currentStep: 0 });
    const { container } = render(<TourController />);
    expect(container.firstChild).toBeNull();
  });

  it('shows first step content initially', () => {
    render(<TourController />);
    expect(screen.getByTestId('joyride-content')).toHaveTextContent('Organize your API requests here');
  });

  it('shows first step title', () => {
    render(<TourController />);
    expect(screen.getByTestId('joyride-title')).toHaveTextContent('Collections');
  });

  it('advances to next step when Next is clicked', () => {
    render(<TourController />);
    act(() => {
      fireEvent.click(screen.getByTestId('joyride-next'));
    });
    expect(useTourStore.getState().currentStep).toBe(1);
  });

  it('shows skip button', () => {
    render(<TourController />);
    expect(screen.getByTestId('joyride-skip')).toBeInTheDocument();
  });

  it('completes tour when skip is clicked', () => {
    render(<TourController />);
    act(() => {
      fireEvent.click(screen.getByTestId('joyride-skip'));
    });
    expect(useTourStore.getState().hasCompletedTour).toBe(true);
  });

  it('completes tour when finish is clicked on last step', () => {
    render(<TourController />);
    act(() => {
      fireEvent.click(screen.getByTestId('joyride-finish'));
    });
    expect(useTourStore.getState().hasCompletedTour).toBe(true);
  });

  it('shows correct step content for step 2 (request builder)', () => {
    useTourStore.setState({ hasCompletedTour: false, currentStep: 1 });
    render(<TourController />);
    expect(screen.getByTestId('joyride-content')).toHaveTextContent('Build your HTTP request');
  });

  it('shows correct step content for step 3 (send button)', () => {
    useTourStore.setState({ hasCompletedTour: false, currentStep: 2 });
    render(<TourController />);
    expect(screen.getByTestId('joyride-content')).toHaveTextContent('Click to send your request');
  });

  it('shows correct step content for step 4 (response panel)', () => {
    useTourStore.setState({ hasCompletedTour: false, currentStep: 3 });
    render(<TourController />);
    expect(screen.getByTestId('joyride-content')).toHaveTextContent('View your API response here');
  });

  it('shows correct step content for step 5 (settings/env)', () => {
    useTourStore.setState({ hasCompletedTour: false, currentStep: 4 });
    render(<TourController />);
    expect(screen.getByTestId('joyride-content')).toHaveTextContent('Configure environments and auth');
  });
});

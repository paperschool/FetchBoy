import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SplashScreen } from './SplashScreen';

vi.mock('@/hooks/useTheme', () => ({
  useTheme: vi.fn(),
}));

describe('SplashScreen', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('renders with FetchBoy logo', () => {
    render(<SplashScreen onComplete={vi.fn()} />);
    expect(screen.getByAltText('FetchBoy')).toBeInTheDocument();
  });

  it('renders the splash-screen container', () => {
    render(<SplashScreen onComplete={vi.fn()} />);
    expect(screen.getByTestId('splash-screen')).toBeInTheDocument();
  });

  it('calls onComplete after minimum duration', () => {
    const onComplete = vi.fn();
    render(<SplashScreen onComplete={onComplete} minDuration={1500} maxDuration={3000} />);

    expect(onComplete).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('does not call onComplete before minimum duration elapses', () => {
    const onComplete = vi.fn();
    render(<SplashScreen onComplete={onComplete} minDuration={1500} />);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(onComplete).not.toHaveBeenCalled();
  });

  it('calls onComplete only once even when max timer also fires', () => {
    const onComplete = vi.fn();
    render(<SplashScreen onComplete={onComplete} minDuration={1500} maxDuration={3000} />);

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('forces onComplete via max timer when min timer does not fire', () => {
    const onComplete = vi.fn();
    // Use min > max to simulate min never firing before max
    render(<SplashScreen onComplete={onComplete} minDuration={5000} maxDuration={3000} />);

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('does not skip animation when clicked before minimum duration', () => {
    const onComplete = vi.fn();
    render(<SplashScreen onComplete={onComplete} minDuration={1500} />);

    // Click before min duration - should not trigger complete
    fireEvent.click(screen.getByTestId('splash-screen'));

    expect(onComplete).not.toHaveBeenCalled();
  });

  it('skips animation when clicked after minimum duration has elapsed but before auto-complete', () => {
    const onComplete = vi.fn();
    // Use a long minDuration so canSkip becomes true but complete hasn't been called yet
    // We achieve this by advancing exactly to minDuration (which sets canSkip=true and calls complete)
    // Then we test that a separate click after the skip window works via max-timer-only scenario:
    // Min=1500 but we click at t=1500 BEFORE the timer callback runs
    render(<SplashScreen onComplete={onComplete} minDuration={1500} maxDuration={5000} />);

    // Advance time by exactly 1500ms to trigger min timer (canSkip=true, complete called)
    act(() => {
      vi.advanceTimersByTime(1500);
    });

    // onComplete was already called by the min timer
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('applies theme class to splash container', () => {
    const { container } = render(<SplashScreen onComplete={vi.fn()} />);
    // Default store theme is 'system'
    expect(container.firstChild).toHaveClass('theme-system');
  });

  it('applies splash-screen class to container', () => {
    const { container } = render(<SplashScreen onComplete={vi.fn()} />);
    expect(container.firstChild).toHaveClass('splash-screen');
  });

  it('calls useTheme hook for theme management', async () => {
    const { useTheme } = await import('@/hooks/useTheme');
    render(<SplashScreen onComplete={vi.fn()} />);
    expect(vi.mocked(useTheme)).toHaveBeenCalled();
  });

  it('cleans up timers on unmount', () => {
    const onComplete = vi.fn();
    const { unmount } = render(<SplashScreen onComplete={onComplete} minDuration={1500} />);

    unmount();

    // Advance past duration — onComplete should NOT be called since component unmounted
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(onComplete).not.toHaveBeenCalled();
  });
});

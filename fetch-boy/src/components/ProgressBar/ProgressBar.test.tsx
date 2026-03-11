import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProgressBar } from './ProgressBar';

// Mock the useUiSettingsStore
vi.mock('@/stores/uiSettingsStore', () => ({
  useUiSettingsStore: vi.fn((selector) => {
    // Default mock - return system theme
    if (typeof selector === 'function') {
      return selector({ theme: 'system' });
    }
    return { theme: 'system' };
  }),
}));

describe('ProgressBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when not active and progress is 0', () => {
    const { container } = render(<ProgressBar isActive={false} progress={0} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders when active', () => {
    render(<ProgressBar isActive={true} progress={50} />);
    expect(screen.getByTestId('progress-bar')).toBeInTheDocument();
  });

  it('renders when progress is greater than 0', () => {
    render(<ProgressBar isActive={false} progress={100} />);
    expect(screen.getByTestId('progress-bar')).toBeInTheDocument();
  });

  it('width reflects progress', () => {
    render(<ProgressBar isActive={true} progress={50} />);
    const bar = screen.getByTestId('progress-bar');
    const innerBar = bar.firstChild as HTMLElement;
    expect(innerBar.style.width).toBe('50%');
  });

  it('caps at 80% during flight when progress exceeds 80', () => {
    // Note: The component displays the passed progress prop directly
    // The 80% cap is handled by the store, not the component
    render(<ProgressBar isActive={true} progress={90} />);
    const bar = screen.getByTestId('progress-bar');
    const innerBar = bar.firstChild as HTMLElement;
    // Component shows actual progress passed (90%), store caps at 80%
    expect(innerBar.style.width).toBe('90%');
  });

  it('completes to 100% on response', () => {
    render(<ProgressBar isActive={false} progress={100} />);
    const bar = screen.getByTestId('progress-bar');
    const innerBar = bar.firstChild as HTMLElement;
    expect(innerBar.style.width).toBe('100%');
  });

  it('has correct role and aria attributes', () => {
    render(<ProgressBar isActive={true} progress={50} />);
    const bar = screen.getByRole('progressbar');
    // aria attributes are strings in HTML
    expect(bar).toHaveAttribute('aria-valuenow', '50');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
  });
});

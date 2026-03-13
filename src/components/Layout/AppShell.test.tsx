import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AppShell } from './AppShell';

vi.mock('@/lib/collections', () => ({
    loadAllCollections: vi.fn().mockResolvedValue({ collections: [], folders: [], requests: [] }),
}));

const mockLoadAllSettings = vi.fn().mockResolvedValue({
    theme: 'system',
    request_timeout_ms: 30000,
    ssl_verify: true,
    editor_font_size: 14,
    sidebar_collapsed: false,
});

vi.mock('@/lib/settings', () => ({
    loadAllSettings: (...args: unknown[]) => mockLoadAllSettings(...args),
    saveSetting: vi.fn().mockResolvedValue(undefined),
}));

const mockLoadAllEnvironments = vi.fn().mockResolvedValue([]);
const mockLoadAll = vi.fn();

vi.mock('@/lib/environments', () => ({
    loadAllEnvironments: (...args: unknown[]) => mockLoadAllEnvironments(...args),
    setActiveEnvironment: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/stores/environmentStore', () => ({
    useEnvironmentStore: Object.assign(
        (selector?: (s: { environments: []; activeEnvironmentId: null; setActive: ReturnType<typeof vi.fn> }) => unknown) => {
            const state = { environments: [], activeEnvironmentId: null, setActive: vi.fn() };
            return selector ? selector(state) : state;
        },
        {
            getState: () => ({ loadAll: mockLoadAll }),
        },
    ),
}));

describe('AppShell', () => {
  it('renders the top bar region', async () => {
    render(<AppShell />);
    expect(screen.getByTestId('top-bar')).toBeInTheDocument();
    await waitFor(() => {});
  });

  it('renders the sidebar region', async () => {
    render(<AppShell />);
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    await waitFor(() => {});
  });

  it('renders the main panel region', async () => {
    render(<AppShell />);
    expect(screen.getByTestId('main-panel')).toBeInTheDocument();
    await waitFor(() => {});
  });

  it('displays the app name in the top bar', async () => {
    render(<AppShell />);
    expect(screen.getByText('Fetch Boy 🦴')).toBeInTheDocument();
    await waitFor(() => {});
  });

  it('displays the Collections heading in the sidebar', async () => {
    render(<AppShell />);
    expect(screen.getAllByText('Collections').length).toBeGreaterThan(0);
    await waitFor(() => {});
  });

  it('displays the Request Builder heading in the main panel', async () => {
    render(<AppShell />);
    expect(screen.getByText('Request Builder')).toBeInTheDocument();
    await waitFor(() => {});
  });

  it('calls loadAllEnvironments on mount and passes result to store.loadAll', async () => {
    render(<AppShell />);
    await waitFor(() => {
      expect(mockLoadAllEnvironments).toHaveBeenCalled();
      expect(mockLoadAll).toHaveBeenCalledWith([]);
    });
  });

  it('applies expanded grid layout when sidebar is not collapsed', async () => {
    mockLoadAllSettings.mockResolvedValueOnce({
      theme: 'system',
      request_timeout_ms: 30000,
      ssl_verify: true,
      editor_font_size: 14,
      sidebar_collapsed: false,
    });
    const { container } = render(<AppShell />);
    await waitFor(() => {
      const gridContainer = container.querySelector('.grid');
      expect(gridContainer?.className).toContain('grid-cols-[16rem_1fr]');
    });
  });

  it('applies collapsed grid layout when sidebar is collapsed', async () => {
    mockLoadAllSettings.mockResolvedValueOnce({
      theme: 'system',
      request_timeout_ms: 30000,
      ssl_verify: true,
      editor_font_size: 14,
      sidebar_collapsed: true,
    });
    const { container } = render(<AppShell />);
    await waitFor(() => {
      const gridContainer = container.querySelector('.grid');
      expect(gridContainer?.className).toContain('grid-cols-[3.5rem_1fr]');
    });
  });

  it('loads sidebar collapsed state from settings on mount', async () => {
    mockLoadAllSettings.mockResolvedValueOnce({
      theme: 'system',
      request_timeout_ms: 30000,
      ssl_verify: true,
      editor_font_size: 14,
      sidebar_collapsed: true,
    });
    render(<AppShell />);
    await waitFor(() => {
      expect(mockLoadAllSettings).toHaveBeenCalled();
    });
  });
});

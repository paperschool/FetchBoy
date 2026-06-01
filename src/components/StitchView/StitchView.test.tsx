import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StitchView } from './StitchView';
import { useStitchStore } from '@/stores/stitchStore';

const mockShellOpen = vi.fn();
vi.mock('@tauri-apps/plugin-shell', () => ({
  open: (...args: unknown[]) => mockShellOpen(...args),
}));

vi.mock('@/lib/stitch', () => ({
  loadChains: vi.fn().mockResolvedValue([]),
  loadChainWithNodes: vi.fn(),
  insertChain: vi.fn(),
  updateChain: vi.fn(),
  deleteChain: vi.fn(),
  insertNode: vi.fn(),
  updateNode: vi.fn(),
  deleteNode: vi.fn(),
  insertConnection: vi.fn(),
  deleteConnection: vi.fn(),
}));

describe('StitchView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(localStorage.getItem).mockReturnValue(null);
    useStitchStore.setState({
      chains: [],
      activeChainId: null,
      nodes: [],
      connections: [],
      selectedNodeId: null,
      executionState: 'idle',
    });
  });

  it('renders the heading', () => {
    render(<StitchView />);
    expect(screen.getByText('Stitch — Request Chain Builder')).toBeInTheDocument();
  });

  it('shows empty state when no chains', () => {
    render(<StitchView />);
    expect(screen.getByText('No chains yet')).toBeInTheDocument();
  });

  it('shows the under-development warning and dismisses it', () => {
    render(<StitchView />);
    const banner = screen.getByTestId('stitch-dev-warning');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent(/under development/i);

    fireEvent.click(screen.getByRole('button', { name: /dismiss warning/i }));
    expect(screen.queryByTestId('stitch-dev-warning')).not.toBeInTheDocument();
  });

  it('opens the GitHub issues page from the "here" link', () => {
    render(<StitchView />);
    fireEvent.click(screen.getByRole('button', { name: 'here' }));
    expect(mockShellOpen).toHaveBeenCalledWith('https://github.com/paperschool/FetchBoy/issues');
  });

  it('stays dismissed when previously dismissed (persisted)', () => {
    vi.mocked(localStorage.getItem).mockReturnValue('1');
    render(<StitchView />);
    expect(screen.queryByTestId('stitch-dev-warning')).not.toBeInTheDocument();
  });

  it('renders chain names in sidebar', () => {
    useStitchStore.setState({
      chains: [
        { id: 'c1', name: 'Auth Flow', createdAt: 'ts', updatedAt: 'ts' },
        { id: 'c2', name: 'Data Pipeline', createdAt: 'ts', updatedAt: 'ts' },
      ],
    });
    render(<StitchView />);
    expect(screen.getByText('Auth Flow')).toBeInTheDocument();
    expect(screen.getByText('Data Pipeline')).toBeInTheDocument();
  });
});

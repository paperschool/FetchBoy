import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RequestNodeEditor } from './RequestNodeEditor';
import { useStitchStore } from '@/stores/stitchStore';
import { useEnvironmentStore } from '@/stores/environmentStore';
import type { StitchNode } from '@/types/stitch';

vi.mock('@monaco-editor/react', () => ({
  default: ({ value, onChange }: { value: string; onChange?: (v: string) => void }) => (
    <textarea
      data-testid="mock-monaco"
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
    />
  ),
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

const makeRequestNode = (config: Record<string, unknown> = {}, label = 'API Call'): StitchNode => ({
  id: 'node-1',
  chainId: 'chain-1',
  type: 'request',
  positionX: 0,
  positionY: 0,
  config: { method: 'GET', url: '', headers: [], queryParams: [], body: '', bodyType: 'none', ...config },
  label,
  createdAt: 'ts',
  updatedAt: 'ts',
});

describe('RequestNodeEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useStitchStore.setState({
      chains: [],
      activeChainId: 'chain-1',
      nodes: [],
      connections: [],
      selectedNodeId: null,
      executionState: 'idle',
    });
    useEnvironmentStore.setState({ environments: [] });
  });

  it('renders method selector with GET default', () => {
    render(<RequestNodeEditor node={makeRequestNode()} />);
    const select = screen.getByTestId('request-method') as HTMLSelectElement;
    expect(select.value).toBe('GET');
  });

  it('renders the URL input with highlighting', () => {
    render(<RequestNodeEditor node={makeRequestNode({ url: 'https://api.test.com/{{id}}' })} />);
    expect(screen.getByLabelText('Request URL')).toBeInTheDocument();
  });

  it('renders Headers, Query Params, and Body tabs', () => {
    render(<RequestNodeEditor node={makeRequestNode()} />);
    expect(screen.getByTestId('tab-headers')).toBeInTheDocument();
    expect(screen.getByTestId('tab-params')).toBeInTheDocument();
    expect(screen.getByTestId('tab-body')).toBeInTheDocument();
  });

  it('shows body type selector when Body tab is active', () => {
    render(<RequestNodeEditor node={makeRequestNode()} />);
    fireEvent.click(screen.getByTestId('tab-body'));
    expect(screen.getByLabelText('Request Body Language')).toBeInTheDocument();
  });

  it('renders KeyValueRows for headers with add button', () => {
    render(<RequestNodeEditor node={makeRequestNode()} />);
    expect(screen.getByText('Add Header')).toBeInTheDocument();
  });

  it('renders KeyValueRows for query params when tab switched', () => {
    render(<RequestNodeEditor node={makeRequestNode()} />);
    fireEvent.click(screen.getByTestId('tab-params'));
    expect(screen.getByText('Add Query Param')).toBeInTheDocument();
  });
});

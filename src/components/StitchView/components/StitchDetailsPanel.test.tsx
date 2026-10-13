import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StitchDetailsPanel } from './StitchDetailsPanel';
import { useStitchStore } from '@/stores/stitchStore';
import type { ExecutionLogEntry, StitchExecutionState, StitchNode } from '@/types/stitch';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

vi.mock('@monaco-editor/react', () => ({
  default: ({ value }: { value: string }) => (
    <textarea data-testid="mock-monaco" value={value} readOnly />
  ),
}));

const makeNode = (type: StitchNode['type'], config: Record<string, unknown> = {}, label = 'Test'): StitchNode => ({
  id: 'n1', chainId: 'c1', type, positionX: 0, positionY: 0,
  config, label, createdAt: 'ts', updatedAt: 'ts',
});

function setStoreState(overrides: {
  executionLogs?: ExecutionLogEntry[];
  executionState?: StitchExecutionState;
  executionError?: { nodeId: string; message: string } | null;
}): void {
  useStitchStore.setState({
    executionLogs: overrides.executionLogs ?? [],
    executionState: overrides.executionState ?? 'idle',
    executionError: overrides.executionError ?? null,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  useStitchStore.setState({
    nodes: [],
    connections: [],
    selectedNodeId: null,
    executionLogs: [],
    executionState: 'idle',
    executionError: null,
    executionNodeOutputs: {},
    bottomPanel: 'none',
  });
});

describe('StitchDetailsPanel', () => {
  it('renders empty state when no logs', () => {
    render(<StitchDetailsPanel onClose={vi.fn()} />);
    expect(screen.getByText('Waiting for execution...')).toBeInTheDocument();
  });

  it('renders log entries', () => {
    const logs: ExecutionLogEntry[] = [
      {
        nodeId: 'n1',
        nodeLabel: 'JSON 1',
        nodeType: 'json-object',
        status: 'started',
        timestamp: 0,
      },
      {
        nodeId: 'n1',
        nodeLabel: 'JSON 1',
        nodeType: 'json-object',
        status: 'completed',
        timestamp: 50,
        durationMs: 50,
        output: { key: 'value' },
      },
    ];
    setStoreState({ executionLogs: logs, executionState: 'completed' });

    render(<StitchDetailsPanel onClose={vi.fn()} />);
    expect(screen.getByText('Completed (1 nodes)')).toBeInTheDocument();
    // started + completed for the same node merge into a single row.
    expect(screen.getAllByText('JSON 1')).toHaveLength(1);
    expect(screen.getByText('completed')).toBeInTheDocument();
  });

  it('highlights error entry', () => {
    const logs: ExecutionLogEntry[] = [
      {
        nodeId: 'n1',
        nodeLabel: 'Bad Node',
        nodeType: 'json-object',
        status: 'error',
        timestamp: 10,
        error: 'Parse failed',
      },
    ];
    setStoreState({
      executionLogs: logs,
      executionState: 'error',
      executionError: { nodeId: 'n1', message: 'Parse failed' },
    });

    render(<StitchDetailsPanel onClose={vi.fn()} />);
    expect(screen.getByTestId('log-error-message')).toHaveTextContent('Parse failed');
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked with no node selected', async () => {
    const onClose = vi.fn();
    render(<StitchDetailsPanel onClose={onClose} />);

    await userEvent.click(screen.getByTestId('details-panel-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows running state', () => {
    setStoreState({ executionState: 'running' });
    render(<StitchDetailsPanel onClose={vi.fn()} />);
    expect(screen.getByText('Running...')).toBeInTheDocument();
  });

  it('clicking a log entry\u2019s open-node button selects that node', async () => {
    useStitchStore.setState({ nodes: [makeNode('json-object', { json: '{}' }, 'Seed')] });
    setStoreState({
      executionLogs: [
        { nodeId: 'n1', nodeLabel: 'Seed', nodeType: 'json-object', status: 'completed', timestamp: 0, output: { a: 1 } },
      ],
      executionState: 'completed',
    });

    render(<StitchDetailsPanel onClose={vi.fn()} />);
    await userEvent.click(screen.getByTestId('debug-log-open-node-n1'));
    expect(useStitchStore.getState().selectedNodeId).toBe('n1');
  });

  it('shows a Node tab, auto-selected, when a node is selected', () => {
    useStitchStore.setState({ nodes: [makeNode('json-object', { json: '{}' }, 'Seed')], selectedNodeId: 'n1' });
    render(<StitchDetailsPanel onClose={vi.fn()} />);
    expect(screen.getByTestId('details-tab-node')).toBeInTheDocument();
    expect(screen.getByTestId('json-object-editor')).toBeInTheDocument();
  });

  it('hides the Node tab and deselects on close when a node is selected', async () => {
    const selectNode = vi.fn();
    useStitchStore.setState({
      nodes: [makeNode('json-object', { json: '{}' }, 'Seed')],
      selectedNodeId: 'n1',
      selectNode,
    });
    render(<StitchDetailsPanel onClose={vi.fn()} />);
    await userEvent.click(screen.getByTestId('details-panel-close'));
    expect(selectNode).toHaveBeenCalledWith(null);
  });
});

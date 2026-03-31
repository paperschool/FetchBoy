import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StitchDebugLog } from './StitchDebugLog';
import { useStitchStore } from '@/stores/stitchStore';
import type { ExecutionLogEntry, StitchExecutionState } from '@/types/stitch';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

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
    executionLogs: [],
    executionState: 'idle',
    executionError: null,
  });
});

describe('StitchDebugLog', () => {
  it('renders empty state when no logs', () => {
    render(<StitchDebugLog onClose={vi.fn()} />);
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

    render(<StitchDebugLog onClose={vi.fn()} />);
    expect(screen.getByText('Completed (1 nodes)')).toBeInTheDocument();
    expect(screen.getAllByText('JSON 1')).toHaveLength(2);
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

    render(<StitchDebugLog onClose={vi.fn()} />);
    expect(screen.getByTestId('log-error-message')).toHaveTextContent('Parse failed');
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', async () => {
    const onClose = vi.fn();
    render(<StitchDebugLog onClose={onClose} />);

    await userEvent.click(screen.getByTestId('debug-log-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows running state', () => {
    setStoreState({ executionState: 'running' });
    render(<StitchDebugLog onClose={vi.fn()} />);
    expect(screen.getByText('Running...')).toBeInTheDocument();
  });
});

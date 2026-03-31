import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StitchDebugLogEntry } from './StitchDebugLogEntry';
import type { ExecutionLogEntry } from '@/types/stitch';

describe('StitchDebugLogEntry', () => {
  const baseEntry: ExecutionLogEntry = {
    nodeId: 'n1',
    nodeLabel: 'My Node',
    nodeType: 'json-object',
    status: 'completed',
    timestamp: 1230,
    durationMs: 45,
  };

  it('renders node label and status', () => {
    render(<StitchDebugLogEntry entry={baseEntry} isError={false} />);
    expect(screen.getByText('My Node')).toBeInTheDocument();
    expect(screen.getByText('completed')).toBeInTheDocument();
    expect(screen.getByText('+1.23s')).toBeInTheDocument();
    expect(screen.getByText('45ms')).toBeInTheDocument();
  });

  it('renders error message when present', () => {
    const errorEntry: ExecutionLogEntry = {
      ...baseEntry,
      status: 'error',
      error: 'Something went wrong',
    };
    render(<StitchDebugLogEntry entry={errorEntry} isError={true} />);
    expect(screen.getByTestId('log-error-message')).toHaveTextContent('Something went wrong');
  });

  it('toggles input and output editors', async () => {
    const entry: ExecutionLogEntry = {
      ...baseEntry,
      input: { foo: 'bar' },
      output: { result: 42 },
    };
    render(<StitchDebugLogEntry entry={entry} isError={false} />);

    // Editors should be collapsed by default
    expect(screen.queryByTestId('debug-input-editor-n1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('debug-output-editor-n1')).not.toBeInTheDocument();

    // Expand input
    await userEvent.click(screen.getByText('Input'));
    expect(screen.getByTestId('debug-input-editor-n1')).toBeInTheDocument();

    // Expand output
    await userEvent.click(screen.getByText('Output'));
    expect(screen.getByTestId('debug-output-editor-n1')).toBeInTheDocument();
  });

  it('does not show input/output buttons when data is empty', () => {
    render(<StitchDebugLogEntry entry={baseEntry} isError={false} />);
    expect(screen.queryByText('Input')).not.toBeInTheDocument();
    expect(screen.queryByText('Output')).not.toBeInTheDocument();
  });
});

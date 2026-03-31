import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { JsSnippetEditor } from './JsSnippetEditor';
import { useStitchStore } from '@/stores/stitchStore';
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

const makeJsNode = (code: string, label = 'Transform'): StitchNode => ({
  id: 'node-1',
  chainId: 'chain-1',
  type: 'js-snippet',
  positionX: 0,
  positionY: 0,
  config: { code },
  label,
  createdAt: 'ts',
  updatedAt: 'ts',
});

describe('JsSnippetEditor', () => {
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
  });

  it('renders the panel header with node label', () => {
    render(<JsSnippetEditor node={makeJsNode('return { a: 1 }')} />);
    expect(screen.getByText('JS Snippet — Transform')).toBeInTheDocument();
  });

  it('renders the Monaco editor', () => {
    render(<JsSnippetEditor node={makeJsNode('return { a: 1 }')} />);
    expect(screen.getByTestId('js-snippet-editor')).toBeInTheDocument();
  });

  it('shows export keys for valid return object', () => {
    render(<JsSnippetEditor node={makeJsNode('return { foo: 1, bar: 2 }')} />);
    expect(screen.getByTestId('export-key-foo')).toBeInTheDocument();
    expect(screen.getByTestId('export-key-bar')).toBeInTheDocument();
  });

  it('shows "No exports detected" when no return', () => {
    render(<JsSnippetEditor node={makeJsNode('const x = 1;')} />);
    expect(screen.getByText('No exports detected')).toBeInTheDocument();
  });

  it('shows "No input connected" when no connections', () => {
    render(<JsSnippetEditor node={makeJsNode('return { a: 1 }')} />);
    expect(screen.getByText('No input connected')).toBeInTheDocument();
  });

  it('shows input keys as chips when connections exist', () => {
    useStitchStore.setState({
      connections: [
        { id: 'c1', chainId: 'chain-1', sourceNodeId: 'src', sourceKey: 'name', targetNodeId: 'node-1', targetSlot: 'in', createdAt: 'ts' },
        { id: 'c2', chainId: 'chain-1', sourceNodeId: 'src', sourceKey: 'age', targetNodeId: 'node-1', targetSlot: 'in', createdAt: 'ts' },
      ],
    });
    render(<JsSnippetEditor node={makeJsNode('return { a: 1 }')} />);
    expect(screen.getByTestId('input-key-name')).toBeInTheDocument();
    expect(screen.getByTestId('input-key-age')).toBeInTheDocument();
  });

  it('shows error for unbalanced braces', () => {
    render(<JsSnippetEditor node={makeJsNode('return { foo: 1')} />);
    expect(screen.getByTestId('editor-js-error')).toBeInTheDocument();
  });
});

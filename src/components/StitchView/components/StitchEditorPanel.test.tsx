import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StitchEditorPanel } from './StitchEditorPanel';
import { StitchConnectionDragProvider } from './StitchConnectionDragContext';
import { useStitchStore } from '@/stores/stitchStore';
import type { StitchNode } from '@/types/stitch';

vi.mock('@monaco-editor/react', () => ({
  default: ({ value }: { value: string }) => (
    <textarea data-testid="mock-monaco" value={value} readOnly />
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

const makeNode = (type: StitchNode['type'], config: Record<string, unknown> = {}, label = 'Test'): StitchNode => ({
  id: 'n1', chainId: 'c1', type, positionX: 0, positionY: 0,
  config, label, createdAt: 'ts', updatedAt: 'ts',
});

function renderPanel(node: StitchNode): ReturnType<typeof render> {
  return render(
    <StitchConnectionDragProvider>
      <StitchEditorPanel node={node} />
    </StitchConnectionDragProvider>,
  );
}

describe('StitchEditorPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useStitchStore.setState({
      chains: [], activeChainId: 'c1', nodes: [], connections: [],
      selectedNodeId: 'n1', selectedConnectionId: null, executionState: 'idle',
    });
  });

  it('renders header with type icon, label, and close button', () => {
    renderPanel(makeNode('json-object', { json: '{}' }, 'Seed'));
    expect(screen.getByText('JSON Object')).toBeInTheDocument();
    expect(screen.getByText('Seed')).toBeInTheDocument();
    expect(screen.getByTestId('editor-close')).toBeInTheDocument();
  });

  it('renders JSON Object editor for json-object type', () => {
    renderPanel(makeNode('json-object', { json: '{"a":1}' }));
    expect(screen.getByTestId('json-object-editor')).toBeInTheDocument();
  });

  it('renders JS Snippet editor for js-snippet type', () => {
    renderPanel(makeNode('js-snippet', { code: 'return {}' }));
    expect(screen.getByTestId('js-snippet-editor')).toBeInTheDocument();
  });

  it('renders Request editor for request type', () => {
    renderPanel(makeNode('request', { method: 'GET', url: '' }));
    expect(screen.getByTestId('request-method')).toBeInTheDocument();
  });

  it('renders Sleep editor for sleep type', () => {
    renderPanel(makeNode('sleep', { mode: 'fixed', durationMs: 1000 }));
    expect(screen.getByTestId('duration-input')).toBeInTheDocument();
  });

  it('close button calls selectNode(null)', () => {
    const selectNode = vi.fn();
    useStitchStore.setState({ selectNode });
    renderPanel(makeNode('json-object', { json: '{}' }));
    fireEvent.click(screen.getByTestId('editor-close'));
    expect(selectNode).toHaveBeenCalledWith(null);
  });
});

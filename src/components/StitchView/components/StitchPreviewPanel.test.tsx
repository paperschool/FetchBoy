import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StitchPreviewPanel } from './StitchPreviewPanel';
import { useStitchStore } from '@/stores/stitchStore';
import type { StitchNode } from '@/types/stitch';

vi.mock('@monaco-editor/react', () => ({
  default: ({ value, options }: { value: string; options?: { readOnly?: boolean } }) => (
    <textarea data-testid="mock-monaco" value={value} readOnly={options?.readOnly} />
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

const makeNode = (id: string, type: StitchNode['type'] = 'json-object', label = 'Test Node'): StitchNode => ({
  id, chainId: 'c1', type, positionX: 0, positionY: 0,
  config: {}, label, createdAt: 'ts', updatedAt: 'ts',
});

describe('StitchPreviewPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useStitchStore.setState({
      chains: [],
      activeChainId: 'c1',
      nodes: [makeNode('n1', 'request', 'My Request')],
      connections: [],
      selectedNodeId: null,
      selectedConnectionId: null,
      executionState: 'idle',
      previewNodeId: null,
      executionNodeOutputs: {},
      executionRequestNodeOutputs: {},
    });
  });

  it('returns null when no preview node is set', () => {
    const { container } = render(<StitchPreviewPanel />);
    expect(container.firstChild).toBeNull();
  });

  it('shows "No results" message when node has no output', () => {
    useStitchStore.setState({ previewNodeId: 'n1', bottomPanel: 'preview' });
    render(<StitchPreviewPanel />);
    expect(screen.getByText(/No results yet/)).toBeInTheDocument();
  });

  it('shows formatted JSON output in Monaco on the Details tab', () => {
    const output = { status: 200, body: { id: 1 } };
    useStitchStore.setState({
      previewNodeId: 'n1',
      bottomPanel: 'preview',
      executionNodeOutputs: { n1: output },
    });
    render(<StitchPreviewPanel />);
    expect(screen.getByTestId('preview-panel')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Raw Response'));
    const monaco = screen.getByTestId('mock-monaco') as HTMLTextAreaElement;
    expect(JSON.parse(monaco.value)).toEqual(output);
  });

  it('defaults to the Response tab, reusing the intercept detail viewer without action buttons', () => {
    useStitchStore.setState({
      previewNodeId: 'n1',
      bottomPanel: 'preview',
      executionNodeOutputs: { n1: { status: 200, headers: { 'content-type': 'application/json' }, body: { id: 1 } } },
    });
    render(<StitchPreviewPanel />);
    expect(screen.getByTestId('intercept-detail-viewer')).toBeInTheDocument();
    expect(screen.queryByText('Open in Fetch')).not.toBeInTheDocument();
    expect(screen.queryByText('Add Mapping')).not.toBeInTheDocument();
    expect(screen.queryByText('Add Breakpoint')).not.toBeInTheDocument();
  });

  it('displays node label in header', () => {
    useStitchStore.setState({
      previewNodeId: 'n1',
      bottomPanel: 'preview',
      executionNodeOutputs: { n1: { data: true } },
    });
    render(<StitchPreviewPanel />);
    expect(screen.getByText(/Preview: My Request/)).toBeInTheDocument();
  });

  it('close button clears preview', () => {
    const clearPreview = vi.fn();
    useStitchStore.setState({
      previewNodeId: 'n1',
      bottomPanel: 'preview',
      executionNodeOutputs: { n1: {} },
      clearPreview,
    });
    render(<StitchPreviewPanel />);
    fireEvent.click(screen.getByTestId('preview-close'));
    expect(clearPreview).toHaveBeenCalled();
  });

  it('shows a Request tab for a mapping-response node with request-phase output, defaulting to it', () => {
    useStitchStore.setState({
      nodes: [makeNode('n1', 'mapping-response', 'Response')],
      previewNodeId: 'n1',
      bottomPanel: 'preview',
      executionNodeOutputs: {},
      executionRequestNodeOutputs: {
        n1: { method: 'POST', url: 'https://rewritten.example.com/test', headers: { 'x-custom': '1' }, body: { id: 9 } },
      },
    });
    render(<StitchPreviewPanel />);
    expect(screen.getByText('Request')).toBeInTheDocument();
    expect(screen.getByTestId('intercept-detail-viewer')).toBeInTheDocument();
  });

  it('does not show a Request tab for non-response nodes even with request-phase data', () => {
    useStitchStore.setState({
      nodes: [makeNode('n1', 'js-snippet', 'Transform')],
      previewNodeId: 'n1',
      bottomPanel: 'preview',
      executionNodeOutputs: { n1: { result: 'ok' } },
      executionRequestNodeOutputs: { n1: { result: 'ok' } },
    });
    render(<StitchPreviewPanel />);
    expect(screen.queryByText('Request')).not.toBeInTheDocument();
  });
});

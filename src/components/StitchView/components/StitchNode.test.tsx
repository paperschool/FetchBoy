import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StitchNode } from './StitchNode';
import { StitchConnectionDragProvider } from './StitchConnectionDragContext';
import type { StitchNode as StitchNodeType } from '@/types/stitch';

const makeNode = (overrides: Partial<StitchNodeType> = {}): StitchNodeType => ({
  id: 'node-1',
  chainId: 'chain-1',
  type: 'request',
  positionX: 100,
  positionY: 200,
  config: {},
  label: 'My Request',
  createdAt: 'ts',
  updatedAt: 'ts',
  ...overrides,
});

const defaultProps = {
  zoom: 1,
  panX: 0,
  panY: 0,
  selected: false,
  onSelect: vi.fn(),
  onUpdatePosition: vi.fn(),
  onUpdateLabel: vi.fn(),
  onDelete: vi.fn(),
};

function renderNode(props: Partial<Parameters<typeof StitchNode>[0]> = {}): ReturnType<typeof render> {
  return render(
    <StitchConnectionDragProvider>
      <StitchNode {...defaultProps} node={makeNode()} {...props} />
    </StitchConnectionDragProvider>,
  );
}

describe('StitchNode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('displays node label', () => {
    renderNode();
    expect(screen.getByText('My Request')).toBeInTheDocument();
  });

  it('displays method badge for request type', () => {
    renderNode();
    expect(screen.getByTestId('method-badge')).toHaveTextContent('GET');
  });

  it('displays type as label when label is null', () => {
    renderNode({ node: makeNode({ label: null }) });
    expect(screen.getByText('request')).toBeInTheDocument();
  });

  it('applies selected styling when selected', () => {
    renderNode({ selected: true });
    const nodeEl = screen.getByTestId('stitch-node-node-1');
    expect(nodeEl.className).toContain('ring-2');
  });

  it('does not apply selected styling when not selected', () => {
    renderNode({ selected: false });
    const nodeEl = screen.getByTestId('stitch-node-node-1');
    expect(nodeEl.className).not.toContain('ring-2');
  });

  it('calls onDelete on right-click', () => {
    const onDelete = vi.fn();
    renderNode({ onDelete });
    fireEvent.contextMenu(screen.getByTestId('stitch-node-node-1'));
    expect(onDelete).toHaveBeenCalledWith('node-1');
  });

  it('enters edit mode on double-click label', () => {
    renderNode();
    const label = screen.getByText('My Request');
    fireEvent.doubleClick(label);
    const input = screen.getByDisplayValue('My Request');
    expect(input).toBeInTheDocument();
  });

  it('renders different node types with correct type text', () => {
    renderNode({ node: makeNode({ type: 'js-snippet', label: 'Code' }) });
    expect(screen.getByText('Code')).toBeInTheDocument();
    expect(screen.getByText('js-snippet')).toBeInTheDocument();
  });

  it('renders input slot', () => {
    renderNode();
    expect(screen.getByTestId('input-slot')).toBeInTheDocument();
  });
});

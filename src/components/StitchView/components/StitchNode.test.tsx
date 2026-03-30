import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StitchNode } from './StitchNode';
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

describe('StitchNode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('displays node label', () => {
    render(<StitchNode {...defaultProps} node={makeNode()} />);
    expect(screen.getByText('My Request')).toBeInTheDocument();
  });

  it('displays node type', () => {
    render(<StitchNode {...defaultProps} node={makeNode()} />);
    expect(screen.getByText('request')).toBeInTheDocument();
  });

  it('displays type as label when label is null', () => {
    render(<StitchNode {...defaultProps} node={makeNode({ label: null })} />);
    expect(screen.getAllByText('request')).toHaveLength(2); // type label fallback + body type
  });

  it('applies selected styling when selected', () => {
    render(<StitchNode {...defaultProps} node={makeNode()} selected={true} />);
    const nodeEl = screen.getByTestId('stitch-node-node-1');
    expect(nodeEl.className).toContain('ring-2');
  });

  it('does not apply selected styling when not selected', () => {
    render(<StitchNode {...defaultProps} node={makeNode()} selected={false} />);
    const nodeEl = screen.getByTestId('stitch-node-node-1');
    expect(nodeEl.className).not.toContain('ring-2');
  });

  it('calls onDelete on right-click', () => {
    const onDelete = vi.fn();
    render(<StitchNode {...defaultProps} node={makeNode()} onDelete={onDelete} />);
    fireEvent.contextMenu(screen.getByTestId('stitch-node-node-1'));
    expect(onDelete).toHaveBeenCalledWith('node-1');
  });

  it('enters edit mode on double-click label', () => {
    render(<StitchNode {...defaultProps} node={makeNode()} />);
    const label = screen.getByText('My Request');
    fireEvent.doubleClick(label);
    const input = screen.getByDisplayValue('My Request');
    expect(input).toBeInTheDocument();
  });

  it('renders different node types with correct type text', () => {
    render(<StitchNode {...defaultProps} node={makeNode({ type: 'js-snippet', label: 'Code' })} />);
    expect(screen.getByText('Code')).toBeInTheDocument();
    expect(screen.getByText('js-snippet')).toBeInTheDocument();
  });
});

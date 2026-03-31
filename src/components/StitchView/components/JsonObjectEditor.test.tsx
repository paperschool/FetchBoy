import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { JsonObjectEditor } from './JsonObjectEditor';
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

const makeJsonNode = (json: string, label = 'Seed Data'): StitchNode => ({
  id: 'node-1',
  chainId: 'chain-1',
  type: 'json-object',
  positionX: 0,
  positionY: 0,
  config: { json },
  label,
  createdAt: 'ts',
  updatedAt: 'ts',
});

describe('JsonObjectEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the Monaco editor', () => {
    render(<JsonObjectEditor node={makeJsonNode('{"a": 1}')} />);
    expect(screen.getByTestId('json-object-editor')).toBeInTheDocument();
  });

  it('shows export keys for valid JSON', () => {
    render(<JsonObjectEditor node={makeJsonNode('{"name": "John", "age": 30}')} />);
    expect(screen.getByTestId('export-key-name')).toBeInTheDocument();
    expect(screen.getByTestId('export-key-age')).toBeInTheDocument();
  });

  it('shows error for invalid JSON', () => {
    render(<JsonObjectEditor node={makeJsonNode('{bad}')} />);
    expect(screen.getByTestId('editor-json-error')).toBeInTheDocument();
  });

  it('shows "No keys" for empty object', () => {
    render(<JsonObjectEditor node={makeJsonNode('{}')} />);
    expect(screen.getByText('No keys')).toBeInTheDocument();
  });
});

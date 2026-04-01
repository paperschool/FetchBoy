import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { useChainExecutionListener } from './useChainExecutionListener';

// Mock Tauri event module
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(),
}));

// Mock Tauri core module
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

// Mock stitch lib (loadChainWithNodes)
vi.mock('@/lib/stitch', () => ({
  loadChainWithNodes: vi.fn(),
}));

// Mock stitch engine (executeMappingNode)
vi.mock('@/lib/stitchEngine', () => ({
  executeMappingNode: vi.fn(),
}));

import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { loadChainWithNodes } from '@/lib/stitch';
import { executeMappingNode } from '@/lib/stitchEngine';

function TestHost() {
  useChainExecutionListener();
  return null;
}

describe('useChainExecutionListener', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers listener for mapping:chain-execute on mount', () => {
    const mockUnlisten = vi.fn();
    vi.mocked(listen).mockResolvedValue(mockUnlisten);

    render(<TestHost />);

    expect(listen).toHaveBeenCalledWith('mapping:chain-execute', expect.any(Function));
  });

  it('executes chain and sends result back via resume_chain', async () => {
    let capturedHandler: ((event: { payload: unknown }) => void) | null = null;
    vi.mocked(listen).mockImplementation(async (_event, handler) => {
      capturedHandler = handler as (event: { payload: unknown }) => void;
      return vi.fn();
    });

    const mappingNode = {
      id: 'mapping-1',
      chainId: 'chain-1',
      type: 'mapping',
      positionX: 0,
      positionY: 0,
      config: {},
      label: 'Mapping',
      parentNodeId: null,
      createdAt: '',
      updatedAt: '',
    };

    vi.mocked(loadChainWithNodes).mockResolvedValue({
      chain: { id: 'chain-1', name: 'Test', mappingId: null, createdAt: '', updatedAt: '' },
      nodes: [mappingNode],
      connections: [],
    });

    vi.mocked(executeMappingNode).mockResolvedValue({
      status: 201,
      headers: { 'x-custom': 'test' },
      body: '{"ok":true}',
      bodyContentType: 'application/json',
    });

    render(<TestHost />);

    // Simulate the event
    await act(async () => {
      capturedHandler?.({
        payload: {
          requestId: 'req-1',
          chainId: 'chain-1',
          mappingId: 'mapping-1',
          status: 200,
          headers: { 'content-type': 'application/json' },
          body: '{"original":true}',
        },
      });
      // Allow microtasks to settle
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(loadChainWithNodes).toHaveBeenCalledWith('chain-1');
    expect(executeMappingNode).toHaveBeenCalledWith(
      mappingNode,
      { status: 200, headers: { 'content-type': 'application/json' }, body: { original: true } },
      [mappingNode],
      [],
      expect.any(Object),
      expect.any(Object),
      expect.any(Object),
    );
    expect(invoke).toHaveBeenCalledWith('resume_chain', {
      requestId: 'req-1',
      success: true,
      status: 201,
      headers: { 'x-custom': 'test' },
      body: '{"ok":true}',
      bodyContentType: 'application/json',
    });
  });

  it('sends failure on chain error', async () => {
    let capturedHandler: ((event: { payload: unknown }) => void) | null = null;
    vi.mocked(listen).mockImplementation(async (_event, handler) => {
      capturedHandler = handler as (event: { payload: unknown }) => void;
      return vi.fn();
    });

    vi.mocked(loadChainWithNodes).mockRejectedValue(new Error('Chain not found'));

    render(<TestHost />);

    await act(async () => {
      capturedHandler?.({
        payload: {
          requestId: 'req-2',
          chainId: 'missing-chain',
          mappingId: 'mapping-1',
          status: 200,
          headers: {},
          body: '',
        },
      });
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(invoke).toHaveBeenCalledWith('resume_chain', {
      requestId: 'req-2',
      success: false,
      status: null,
      headers: null,
      body: null,
      bodyContentType: null,
    });
  });

  it('sends failure when no mapping node found in chain', async () => {
    let capturedHandler: ((event: { payload: unknown }) => void) | null = null;
    vi.mocked(listen).mockImplementation(async (_event, handler) => {
      capturedHandler = handler as (event: { payload: unknown }) => void;
      return vi.fn();
    });

    vi.mocked(loadChainWithNodes).mockResolvedValue({
      chain: { id: 'chain-1', name: 'Test', mappingId: null, createdAt: '', updatedAt: '' },
      nodes: [
        { id: 'n1', chainId: 'chain-1', type: 'json-object' as const, positionX: 0, positionY: 0, config: {}, label: null, parentNodeId: null, createdAt: '', updatedAt: '' },
      ],
      connections: [],
    });

    render(<TestHost />);

    await act(async () => {
      capturedHandler?.({
        payload: {
          requestId: 'req-3',
          chainId: 'chain-1',
          mappingId: 'mapping-1',
          status: 200,
          headers: {},
          body: '',
        },
      });
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(invoke).toHaveBeenCalledWith('resume_chain', {
      requestId: 'req-3',
      success: false,
      status: null,
      headers: null,
      body: null,
      bodyContentType: null,
    });
  });
});

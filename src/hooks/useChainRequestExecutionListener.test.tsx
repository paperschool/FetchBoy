import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { useChainRequestExecutionListener } from './useChainRequestExecutionListener';

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/stitch', () => ({
  loadChainWithNodes: vi.fn(),
}));

// Pass-through — covered separately in stitchMappingMigration.test.ts
vi.mock('@/lib/stitchMappingMigration', () => ({
  ensureMappingChainUpToDate: vi.fn((_chainId, nodes, connections) => Promise.resolve({ nodes, connections })),
}));

vi.mock('@/lib/stitchEngine', () => ({
  executeMappingRequestSegment: vi.fn(),
}));

import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { loadChainWithNodes } from '@/lib/stitch';
import { executeMappingRequestSegment } from '@/lib/stitchEngine';
import { useStitchStore } from '@/stores/stitchStore';

function TestHost() {
  useChainRequestExecutionListener();
  return null;
}

describe('useChainRequestExecutionListener', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers listener for mapping:chain-execute-request on mount', () => {
    vi.mocked(listen).mockResolvedValue(vi.fn());

    render(<TestHost />);

    expect(listen).toHaveBeenCalledWith('mapping:chain-execute-request', expect.any(Function));
  });

  it('executes the Entry segment and sends the result back via resume_chain_request', async () => {
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

    vi.mocked(executeMappingRequestSegment).mockResolvedValue({
      method: 'POST',
      url: 'https://rewritten.example.com/api',
      headers: { 'x-custom': 'test' },
      body: '{"rewritten":true}',
    });

    render(<TestHost />);

    await act(async () => {
      capturedHandler?.({
        payload: {
          requestId: 'req-1',
          chainId: 'chain-1',
          mappingId: 'mapping-1',
          method: 'GET',
          host: 'example.com',
          path: '/api',
          headers: { cookie: 'session=old' },
          body: '{"original":true}',
        },
      });
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(loadChainWithNodes).toHaveBeenCalledWith('chain-1');
    expect(executeMappingRequestSegment).toHaveBeenCalledWith(
      mappingNode,
      {
        method: 'GET',
        url: 'https://example.com/api',
        headers: { cookie: 'session=old' },
        body: { original: true },
      },
      [mappingNode],
      [],
      expect.any(Object),
      expect.any(Object),
      expect.any(Object),
    );
    expect(invoke).toHaveBeenCalledWith('resume_chain_request', {
      requestId: 'req-1',
      success: true,
      method: 'POST',
      url: 'https://rewritten.example.com/api',
      headers: { 'x-custom': 'test' },
      body: '{"rewritten":true}',
    });
  });

  it('clears stale executionNodeOutputs from a previous run before starting a new one', async () => {
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

    vi.mocked(executeMappingRequestSegment).mockResolvedValue({
      method: 'GET', url: 'https://example.com/api', headers: {}, body: '',
    });

    // Simulate leftover "success" state from the previous request's full
    // response-phase run — every node in it would otherwise instantly read
    // as done before this run has touched anything.
    useStitchStore.setState({
      activeChainId: 'chain-1',
      executionNodeOutputs: { 'stale-node': { anything: true } },
    });

    render(<TestHost />);

    await act(async () => {
      capturedHandler?.({
        payload: {
          requestId: 'req-1',
          chainId: 'chain-1',
          mappingId: 'mapping-1',
          method: 'GET',
          host: 'example.com',
          path: '/api',
          headers: {},
          body: '',
        },
      });
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(useStitchStore.getState().executionNodeOutputs).toEqual({});
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
          method: 'GET',
          host: 'example.com',
          path: '/api',
          headers: {},
          body: '',
        },
      });
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(invoke).toHaveBeenCalledWith('resume_chain_request', {
      requestId: 'req-2',
      success: false,
      method: null,
      url: null,
      headers: null,
      body: null,
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
          method: 'GET',
          host: 'example.com',
          path: '/api',
          headers: {},
          body: '',
        },
      });
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(invoke).toHaveBeenCalledWith('resume_chain_request', {
      requestId: 'req-3',
      success: false,
      method: null,
      url: null,
      headers: null,
      body: null,
    });
  });
});

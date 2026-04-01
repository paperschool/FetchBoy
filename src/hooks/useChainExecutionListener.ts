import { useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useTauriListener } from '@/hooks/useTauriListener';
import { loadChainWithNodes } from '@/lib/stitch';
import { executeMappingNode } from '@/lib/stitchEngine';
import { useEnvironmentStore } from '@/stores/environmentStore';
import { useStitchStore } from '@/stores/stitchStore';
import type { ExecutionCallbacks, StitchNode } from '@/types/stitch';

interface ChainExecutionRequestPayload {
  requestId: string;
  chainId: string;
  mappingId: string;
  status: number;
  headers: Record<string, string>;
  body: string;
}

/**
 * Global listener for `mapping:chain-execute` events from the proxy.
 * When a mapping with `use_chain=true` matches, the proxy emits this event
 * and pauses. This hook loads the Stitch chain, executes it with the
 * intercepted request data, and sends the result back via `resume_chain`.
 *
 * Must be mounted at the app root (always active, not just when Stitch tab is visible).
 */
export function useChainExecutionListener(): void {
  const handleChainExecute = useCallback(async (payload: ChainExecutionRequestPayload) => {
    const { requestId, chainId, status, headers, body } = payload;

    try {
      // Load chain nodes and connections from DB
      const { nodes, connections } = await loadChainWithNodes(chainId);

      // Find the mapping container node (the chain is bound to a mapping)
      const mappingNode = nodes.find((n) => n.type === 'mapping');
      if (!mappingNode) {
        throw new Error('No mapping container node found in chain');
      }

      // Resolve environment variables
      const envState = useEnvironmentStore.getState();
      const activeEnv = envState.environments.find((e) => e.id === envState.activeEnvironmentId);
      const envVariables: Record<string, string> = {};
      if (activeEnv?.variables) {
        for (const v of activeEnv.variables) {
          if (v.enabled && v.key) envVariables[v.key] = v.value;
        }
      }

      // Show visual feedback and debug log if the fired chain is currently being viewed
      const isActiveChain = useStitchStore.getState().activeChainId === chainId;
      const startTime = Date.now();
      const findNode = (id: string): StitchNode | undefined => nodes.find((n) => n.id === id);

      if (isActiveChain) {
        useStitchStore.setState((s) => {
          s.executionState = 'running';
          s.executionNodeOutputs = {};
          s.executionError = null;
          s.executionLogs = [];
          s.executionStartTime = startTime;
          s.bottomPanel = 'debug';
        });
      }

      const callbacks: ExecutionCallbacks = {
        onNodeStart: (nodeId, loopCtx) => {
          if (!isActiveChain) return;
          const node = findNode(nodeId);
          useStitchStore.setState((s) => {
            s.executionCurrentNodeId = nodeId;
            s.executionLogs.push({
              nodeId,
              nodeLabel: node?.label ?? '',
              nodeType: node?.type ?? 'json-object',
              status: 'started',
              timestamp: Date.now() - startTime,
              url: node?.type === 'request' ? (node.config as { url?: string }).url : undefined,
              loopIteration: loopCtx?.iteration,
              loopNodeId: loopCtx?.loopNodeId,
            });
          });
        },
        onNodeComplete: (nodeId, output, durationMs, loopCtx, consoleLogs) => {
          if (!isActiveChain) return;
          const node = findNode(nodeId);
          useStitchStore.setState((s) => {
            s.executionNodeOutputs[nodeId] = output;
            s.executionCurrentNodeId = null;
            s.executionLogs.push({
              nodeId,
              nodeLabel: node?.label ?? '',
              nodeType: node?.type ?? 'json-object',
              status: 'completed',
              timestamp: Date.now() - startTime,
              durationMs,
              output,
              loopIteration: loopCtx?.iteration,
              loopNodeId: loopCtx?.loopNodeId,
              consoleLogs,
            });
          });
        },
        onError: (nodeId, error) => {
          if (!isActiveChain) return;
          const node = findNode(nodeId);
          useStitchStore.setState((s) => {
            s.executionState = 'error';
            s.executionError = { nodeId, message: error };
            s.executionCurrentNodeId = null;
            s.executionLogs.push({
              nodeId,
              nodeLabel: node?.label ?? nodeId,
              nodeType: node?.type ?? 'json-object',
              status: 'error',
              timestamp: Date.now() - startTime,
              error,
            });
          });
        },
        onSleepStart: (nodeId, durationMs) => {
          if (!isActiveChain) return;
          useStitchStore.setState((s) => {
            s.sleepCountdown = { nodeId, durationMs };
            s.executionLogs.push({
              nodeId,
              nodeLabel: findNode(nodeId)?.label ?? '',
              nodeType: 'sleep',
              status: 'sleeping',
              timestamp: Date.now() - startTime,
            });
          });
        },
        onChainComplete: () => {
          if (!isActiveChain) return;
          useStitchStore.setState((s) => {
            s.executionState = 'completed';
            s.executionCurrentNodeId = null;
            s.sleepCountdown = null;
          });
          // Fade out green highlights after 4 seconds so subsequent runs are visible
          setTimeout(() => {
            useStitchStore.setState((s) => {
              s.executionNodeOutputs = {};
              s.executionState = 'idle';
            });
          }, 4000);
        },
      };

      const cancelledRef = { current: false };

      // Parse body as JSON if possible, otherwise pass as string
      let parsedBody: unknown = body;
      try {
        parsedBody = JSON.parse(body);
      } catch {
        // Not JSON — keep as raw string
      }

      // Execute the mapping container with intercepted request data
      const result = await executeMappingNode(
        mappingNode,
        { status, headers, body: parsedBody },
        nodes,
        connections,
        envVariables,
        callbacks,
        cancelledRef,
      );

      callbacks.onChainComplete();

      // Send the result back to the proxy
      await invoke('resume_chain', {
        requestId,
        success: true,
        status: typeof result.status === 'number' ? result.status : 200,
        headers: typeof result.headers === 'object' && result.headers !== null ? result.headers : {},
        body: typeof result.body === 'string' ? result.body : JSON.stringify(result.body ?? ''),
        bodyContentType: typeof result.bodyContentType === 'string' ? result.bodyContentType : 'application/json',
      });
    } catch (err) {
      console.error('[ChainExecutionListener] Chain execution failed:', err);
      // Signal failure — proxy will fall through to original response
      await invoke('resume_chain', {
        requestId,
        success: false,
        status: null,
        headers: null,
        body: null,
        bodyContentType: null,
      });
    }
  }, []);

  useTauriListener<ChainExecutionRequestPayload>('mapping:chain-execute', handleChainExecute);
}

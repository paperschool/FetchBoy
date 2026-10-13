import { useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useTauriListener } from '@/hooks/useTauriListener';
import { loadChainWithNodes } from '@/lib/stitch';
import { ensureMappingChainUpToDate } from '@/lib/stitchMappingMigration';
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
  url: string;
  requestMethod: string;
  requestHeaders: Record<string, string>;
  requestBody: string;
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
    const { requestId, chainId, status, headers, body, url, requestMethod, requestHeaders, requestBody } = payload;

    try {
      // Load chain nodes and connections from DB
      const loaded = await loadChainWithNodes(chainId);
      // Legacy mappings predate keyed connections and/or the Response node —
      // upgrade in place so they run correctly on their first live trigger,
      // rather than only self-healing when a user happens to open the chain.
      const { nodes, connections } = await ensureMappingChainUpToDate(chainId, loaded.nodes, loaded.connections, payload.mappingId);

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

      // Show visual feedback and debug log if the fired chain is currently being
      // viewed. On a fresh session no chain has been opened yet (activeChainId
      // is null), which previously meant live executions never lit up the
      // canvas until the user happened to open the chain manually (e.g. via
      // the Mapping's "chain config" button) — adopt this chain automatically
      // in that case rather than silently doing nothing. Don't steal it away
      // from a chain the user is already actively viewing/editing, though.
      const activeChainId = useStitchStore.getState().activeChainId;
      const isActiveChain = activeChainId === chainId || activeChainId === null;
      if (activeChainId === null) {
        useStitchStore.setState((s) => {
          const idx = s.chains.findIndex((c) => c.id === loaded.chain.id);
          if (idx >= 0) s.chains[idx] = loaded.chain;
          else s.chains.push(loaded.chain);
          s.activeChainId = chainId;
          s.nodes = nodes;
          s.connections = connections;
          s.selectedNodeId = null;
        });
      }
      const startTime = useStitchStore.getState().executionStartTime || Date.now();
      const findNode = (id: string): StitchNode | undefined => nodes.find((n) => n.id === id);

      if (isActiveChain) {
        useStitchStore.setState((s) => {
          s.executionState = 'running';
          s.executionNodeOutputs = {};
          s.executionError = null;
          // NOT reset here (unlike executionNodeOutputs) — this response
          // phase follows the request-firing phase for the same intercepted
          // request, which already logged its own nodes (see
          // useChainRequestExecutionListener and findRequestOnlyChildIds in
          // mappingExecutor.ts for why some of them, e.g. a Sleep node, don't
          // run again here). Wiping the log at this point would make those
          // entries vanish from the debug log instead of the two phases
          // reading as one continuous run. executionStartTime is reused for
          // the same reason — resetting it here would make this phase's
          // timestamps jump backwards relative to the ones already logged.
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
          // Fade out green highlights after 4 seconds — the CSS animation
          // (.stitch-connection-fading) settles on its own via its
          // `forwards` fill-mode, so this only needs to reset execution
          // state, NOT clear executionNodeOutputs (the Debug Log/Output tab
          // reads from it to show the last run's result, and it should
          // persist until the next run replaces it).
          setTimeout(() => {
            useStitchStore.setState((s) => {
              if (s.executionState === 'completed') s.executionState = 'idle';
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
      let parsedRequestBody: unknown = requestBody;
      try {
        parsedRequestBody = JSON.parse(requestBody);
      } catch {
        // Not JSON — keep as raw string
      }

      // Execute the mapping container with intercepted request data. The
      // request-firing pre-pass (executeMappingRequestSegment) already ran
      // for this same request, in real time, before it went out — pass
      // requestPhaseAlreadyRan so nodes that exclusively fed that pre-pass
      // (e.g. a Sleep node rewriting the URL) aren't run — and delayed — again.
      const result = await executeMappingNode(
        mappingNode,
        { status, headers, body: parsedBody, url, requestMethod, requestHeaders, requestBody: parsedRequestBody },
        nodes,
        connections,
        envVariables,
        callbacks,
        cancelledRef,
        true,
      );

      callbacks.onChainComplete();

      // Send the result back to the proxy
      await invoke('resume_chain', {
        requestId,
        success: true,
        status: typeof result.status === 'number' ? result.status : 200,
        headers: typeof result.headers === 'object' && result.headers !== null ? result.headers : {},
        setCookies: Array.isArray(result.setCookies) ? result.setCookies : [],
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
        setCookies: null,
        body: null,
        bodyContentType: null,
      });
    }
  }, []);

  useTauriListener<ChainExecutionRequestPayload>('mapping:chain-execute', handleChainExecute);
}

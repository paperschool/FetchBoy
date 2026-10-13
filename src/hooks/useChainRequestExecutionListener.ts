import { useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useTauriListener } from '@/hooks/useTauriListener';
import { loadChainWithNodes } from '@/lib/stitch';
import { ensureMappingChainUpToDate } from '@/lib/stitchMappingMigration';
import { executeMappingRequestSegment } from '@/lib/stitchEngine';
import { useEnvironmentStore } from '@/stores/environmentStore';
import { useStitchStore } from '@/stores/stitchStore';
import type { ExecutionCallbacks, StitchNode } from '@/types/stitch';

interface ChainRequestExecutionPayload {
    requestId: string;
    chainId: string;
    mappingId: string;
    method: string;
    host: string;
    path: string;
    headers: Record<string, string>;
    body: string;
}

/**
 * Global listener for `mapping:chain-execute-request` events from the proxy.
 * Fires when a mapping with `needs_request_chain` matches an inbound request —
 * *before* it's forwarded upstream — so this only runs the subset of the chain
 * Response depends on and sends its (possibly overridden) method/url/headers/body
 * back via `resume_chain_request` to become the actual outbound request.
 *
 * Must be mounted at the app root (always active), alongside
 * `useChainExecutionListener` (the response-side counterpart).
 */
export function useChainRequestExecutionListener(): void {
    const handleChainExecuteRequest = useCallback(async (payload: ChainRequestExecutionPayload) => {
        const { requestId, chainId, method, host, path, headers, body } = payload;
        const url = `https://${host}${path}`;

        try {
            const loaded = await loadChainWithNodes(chainId);
            const { nodes, connections } = await ensureMappingChainUpToDate(chainId, loaded.nodes, loaded.connections, payload.mappingId);

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
            const startTime = Date.now();
            const findNode = (id: string): StitchNode | undefined => nodes.find((n) => n.id === id);

            if (isActiveChain) {
                useStitchStore.setState((s) => {
                    s.executionState = 'running';
                    // Also clear the *previous* run's response-phase outputs — otherwise
                    // every node from that stale run still reads as `node.id in
                    // executionNodeOutputs` and the canvas instantly flashes the whole
                    // chain "done" before this request-firing segment has actually run
                    // anything, then the real per-node/sleep timing plays out on top of
                    // that stale green backdrop right after.
                    s.executionNodeOutputs = {};
                    s.executionRequestNodeOutputs = {};
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
                        // Kept separate from executionNodeOutputs (see field doc) so this
                        // request-firing shape isn't clobbered once the reply comes back.
                        s.executionRequestNodeOutputs[nodeId] = output;
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
                    setTimeout(() => {
                        useStitchStore.setState((s) => {
                            if (s.executionState === 'completed') s.executionState = 'idle';
                        });
                    }, 4000);
                },
            };

            const cancelledRef = { current: false };

            let parsedBody: unknown = body;
            try {
                parsedBody = JSON.parse(body);
            } catch {
                // Not JSON — keep as raw string
            }

            const result = await executeMappingRequestSegment(
                mappingNode,
                { method, url, headers, body: parsedBody },
                nodes,
                connections,
                envVariables,
                callbacks,
                cancelledRef,
            );

            callbacks.onChainComplete();

            await invoke('resume_chain_request', {
                requestId,
                success: true,
                method: result.method,
                url: result.url,
                headers: result.headers,
                body: typeof result.body === 'string' ? result.body : JSON.stringify(result.body ?? ''),
            });
        } catch (err) {
            console.error('[ChainRequestExecutionListener] Chain execution failed:', err);
            // Signal failure — proxy will fall through to forwarding the original request
            await invoke('resume_chain_request', {
                requestId,
                success: false,
                method: null,
                url: null,
                headers: null,
                body: null,
            });
        }
    }, []);

    useTauriListener<ChainRequestExecutionPayload>('mapping:chain-execute-request', handleChainExecuteRequest);
}

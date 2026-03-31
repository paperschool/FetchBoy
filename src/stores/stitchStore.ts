import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { StitchChain, StitchNode, StitchConnection, StitchExecutionState, ExecutionLogEntry } from '@/types/stitch';
import * as stitchDb from '@/lib/stitch';
import { executeChain } from '@/lib/stitchEngine';
import { useEnvironmentStore } from '@/stores/environmentStore';

// ─── State ──────────────────────────────────────────────────────────────────

interface StitchState {
  chains: StitchChain[];
  activeChainId: string | null;
  nodes: StitchNode[];
  connections: StitchConnection[];
  selectedNodeId: string | null;
  selectedConnectionId: string | null;
  executionState: StitchExecutionState;
  executionCurrentNodeId: string | null;
  executionNodeOutputs: Record<string, Record<string, unknown>>;
  executionError: { nodeId: string; message: string } | null;
  executionLogs: ExecutionLogEntry[];
  executionStartTime: number;
  sleepCountdown: { nodeId: string; durationMs: number } | null;
  cancelledRef: { current: boolean };

  // Chain actions
  loadChains: () => Promise<void>;
  loadChain: (chainId: string) => Promise<void>;
  createChain: (name: string) => Promise<StitchChain>;
  renameChain: (id: string, name: string) => Promise<void>;
  deleteChain: (id: string) => Promise<void>;

  // Node actions
  addNode: (node: Omit<StitchNode, 'id' | 'createdAt' | 'updatedAt'>) => Promise<StitchNode>;
  updateNode: (id: string, changes: { positionX?: number; positionY?: number; config?: Record<string, unknown>; label?: string | null }) => Promise<void>;
  removeNode: (id: string) => Promise<void>;
  selectNode: (id: string | null) => void;

  // Connection actions
  addConnection: (conn: Omit<StitchConnection, 'id' | 'createdAt'>) => Promise<StitchConnection>;
  removeConnection: (id: string) => Promise<void>;
  selectConnection: (id: string | null) => void;

  // Execution
  setExecutionState: (state: StitchExecutionState) => void;
  startExecution: () => Promise<void>;
  cancelExecution: () => void;
}

// ─── Store ──────────────────────────────────────────────────────────────────

export const useStitchStore = create<StitchState>()(
  immer((set) => ({
    chains: [],
    activeChainId: null,
    nodes: [],
    connections: [],
    selectedNodeId: null,
    selectedConnectionId: null,
    executionState: 'idle' as StitchExecutionState,
    executionCurrentNodeId: null,
    executionNodeOutputs: {},
    executionError: null,
    executionLogs: [],
    executionStartTime: 0,
    sleepCountdown: null,
    cancelledRef: { current: false },

    loadChains: async () => {
      const chains = await stitchDb.loadChains();
      set((state) => {
        state.chains = chains;
      });
    },

    loadChain: async (chainId: string) => {
      const { chain, nodes, connections } = await stitchDb.loadChainWithNodes(chainId);
      set((state) => {
        const idx = state.chains.findIndex((c) => c.id === chain.id);
        if (idx >= 0) state.chains[idx] = chain;
        state.activeChainId = chain.id;
        state.nodes = nodes;
        state.connections = connections;
        state.selectedNodeId = null;
        state.executionState = 'idle';
      });
    },

    createChain: async (name: string) => {
      const chain = await stitchDb.insertChain(name);
      set((state) => {
        state.chains.push(chain);
      });
      return chain;
    },

    renameChain: async (id: string, name: string) => {
      await stitchDb.updateChain(id, { name });
      set((state) => {
        const chain = state.chains.find((c) => c.id === id);
        if (chain) {
          chain.name = name;
          chain.updatedAt = new Date().toISOString();
        }
      });
    },

    deleteChain: async (id: string) => {
      await stitchDb.deleteChain(id);
      set((state) => {
        state.chains = state.chains.filter((c) => c.id !== id);
        if (state.activeChainId === id) {
          state.activeChainId = null;
          state.nodes = [];
          state.connections = [];
          state.selectedNodeId = null;
          state.selectedConnectionId = null;
          state.executionState = 'idle';
        }
      });
    },

    addNode: async (node) => {
      const created = await stitchDb.insertNode(node);
      set((state) => {
        state.nodes.push(created);
      });
      return created;
    },

    updateNode: async (id, changes) => {
      await stitchDb.updateNode(id, changes);
      set((state) => {
        const node = state.nodes.find((n) => n.id === id);
        if (node) {
          if (changes.positionX !== undefined) node.positionX = changes.positionX;
          if (changes.positionY !== undefined) node.positionY = changes.positionY;
          if (changes.config !== undefined) node.config = changes.config;
          if (changes.label !== undefined) node.label = changes.label;
          node.updatedAt = new Date().toISOString();
        }
      });
    },

    removeNode: async (id) => {
      // Explicitly delete orphaned connections before the node (CASCADE may be disabled)
      const connsToDelete = useStitchStore.getState().connections.filter(
        (c) => c.sourceNodeId === id || c.targetNodeId === id,
      );
      for (const c of connsToDelete) {
        await stitchDb.deleteConnection(c.id);
      }
      await stitchDb.deleteNode(id);
      set((state) => {
        state.nodes = state.nodes.filter((n) => n.id !== id);
        state.connections = state.connections.filter(
          (c) => c.sourceNodeId !== id && c.targetNodeId !== id,
        );
        if (state.selectedNodeId === id) {
          state.selectedNodeId = null;
        }
        if (state.selectedConnectionId && connsToDelete.some((c) => c.id === state.selectedConnectionId)) {
          state.selectedConnectionId = null;
        }
      });
    },

    selectNode: (id) =>
      set((state) => {
        state.selectedNodeId = id;
        if (id) state.selectedConnectionId = null;
      }),

    addConnection: async (conn) => {
      const created = await stitchDb.insertConnection(conn);
      set((state) => {
        state.connections.push(created);
      });
      return created;
    },

    removeConnection: async (id) => {
      await stitchDb.deleteConnection(id);
      set((state) => {
        state.connections = state.connections.filter((c) => c.id !== id);
      });
    },

    selectConnection: (id) =>
      set((state) => {
        state.selectedConnectionId = id;
        if (id) state.selectedNodeId = null;
      }),

    setExecutionState: (execState) =>
      set((state) => {
        state.executionState = execState;
      }),

    startExecution: async () => {
      const { nodes, connections, cancelledRef } = useStitchStore.getState();
      cancelledRef.current = false;
      const startTime = Date.now();

      set((state) => {
        state.executionState = 'running';
        state.executionCurrentNodeId = null;
        state.executionNodeOutputs = {};
        state.executionError = null;
        state.executionLogs = [];
        state.executionStartTime = startTime;
        state.sleepCountdown = null;
      });

      // Resolve environment variables
      const envState = useEnvironmentStore.getState();
      const activeEnv = envState.environments.find((e) => e.id === envState.activeEnvironmentId);
      const envVariables: Record<string, string> = {};
      if (activeEnv?.variables) {
        for (const v of activeEnv.variables) {
          if (v.enabled && v.key) envVariables[v.key] = v.value;
        }
      }

      const callbacks = {
        onNodeStart: (nodeId: string): void => {
          set((state) => {
            state.executionCurrentNodeId = nodeId;
            state.executionLogs.push({
              nodeId,
              nodeLabel: nodes.find((n) => n.id === nodeId)?.label ?? '',
              nodeType: nodes.find((n) => n.id === nodeId)?.type ?? 'json-object',
              status: 'started',
              timestamp: Date.now() - startTime,
            });
          });
        },
        onNodeComplete: (nodeId: string, output: Record<string, unknown>, durationMs: number): void => {
          set((state) => {
            state.executionNodeOutputs[nodeId] = output;
            state.sleepCountdown = null;
            state.executionLogs.push({
              nodeId,
              nodeLabel: nodes.find((n) => n.id === nodeId)?.label ?? '',
              nodeType: nodes.find((n) => n.id === nodeId)?.type ?? 'json-object',
              status: 'completed',
              timestamp: Date.now() - startTime,
              durationMs,
              output,
            });
          });
        },
        onError: (nodeId: string, error: string): void => {
          set((state) => {
            state.executionState = 'error';
            state.executionError = { nodeId, message: error };
            state.executionCurrentNodeId = null;
            state.executionLogs.push({
              nodeId,
              nodeLabel: nodes.find((n) => n.id === nodeId)?.label ?? nodeId,
              nodeType: nodes.find((n) => n.id === nodeId)?.type ?? 'json-object',
              status: 'error',
              timestamp: Date.now() - startTime,
              error,
            });
          });
        },
        onSleepStart: (nodeId: string, durationMs: number): void => {
          set((state) => {
            state.sleepCountdown = { nodeId, durationMs };
            state.executionLogs.push({
              nodeId,
              nodeLabel: nodes.find((n) => n.id === nodeId)?.label ?? '',
              nodeType: 'sleep',
              status: 'sleeping',
              timestamp: Date.now() - startTime,
            });
          });
        },
        onChainComplete: (): void => {
          set((state) => {
            state.executionState = 'completed';
            state.executionCurrentNodeId = null;
            state.sleepCountdown = null;
          });
        },
      };

      try {
        const ctx = await executeChain(nodes, connections, envVariables, callbacks, cancelledRef);
        if (ctx.status === 'cancelled') {
          set((state) => {
            state.executionState = 'idle';
          });
        }
      } catch (err) {
        console.error('Chain execution failed:', err);
        set((state) => {
          state.executionState = 'error';
        });
      }
    },

    cancelExecution: () => {
      const { cancelledRef } = useStitchStore.getState();
      cancelledRef.current = true;
      set((state) => {
        state.executionState = 'idle';
        state.sleepCountdown = null;
      });
    },
  })),
);

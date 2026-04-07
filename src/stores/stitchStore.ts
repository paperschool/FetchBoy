import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { StitchChain, StitchFolder, StitchNode, StitchConnection, StitchExecutionState, ExecutionLogEntry } from '@/types/stitch';
import * as stitchDb from '@/lib/stitch';
import * as stitchFolderDb from '@/lib/stitchFolders';
import { executeChain } from '@/lib/stitchEngine';
import { useEnvironmentStore } from '@/stores/environmentStore';

// Mutable ref lives outside immer — never frozen
const cancelledRef = { current: false };

// ─── State ──────────────────────────────────────────────────────────────────

interface StitchState {
  chains: StitchChain[];
  folders: StitchFolder[];
  activeChainId: string | null;
  nodes: StitchNode[];
  connections: StitchConnection[];
  selectedNodeId: string | null;
  selectedConnectionId: string | null;
  executionState: StitchExecutionState;
  executionCurrentNodeId: string | null;
  executionNodeOutputs: Record<string, unknown>;
  executionError: { nodeId: string; message: string } | null;
  executionLogs: ExecutionLogEntry[];
  executionStartTime: number;
  sleepCountdown: { nodeId: string; durationMs: number } | null;
  bottomPanel: 'none' | 'debug' | 'output' | 'preview';
  debugScrollToNodeId: string | null;
  previewNodeId: string | null;

  // Chain actions
  loadChains: () => Promise<void>;
  loadChain: (chainId: string) => Promise<void>;
  createChain: (name: string, mappingId?: string | null, folderId?: string | null, requestId?: string | null) => Promise<StitchChain>;
  renameChain: (id: string, name: string) => Promise<void>;
  deleteChain: (id: string) => Promise<void>;
  duplicateChain: (id: string) => Promise<StitchChain>;

  // Folder actions
  addFolder: (name: string, parentId?: string | null) => Promise<StitchFolder>;
  renameFolder: (id: string, name: string) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
  reorderFolders: (ids: string[]) => void;
  updateChainFolder: (chainId: string, folderId: string | null) => Promise<void>;
  reorderChains: (folderId: string | null, ids: string[]) => void;

  // Node actions
  addNode: (node: Omit<StitchNode, 'id' | 'createdAt' | 'updatedAt'>) => Promise<StitchNode>;
  updateNode: (id: string, changes: { positionX?: number; positionY?: number; config?: Record<string, unknown>; label?: string | null; parentNodeId?: string | null }) => Promise<void>;
  batchMoveContainerChildren: (containerId: string, x: number, y: number) => void;
  removeNode: (id: string) => Promise<void>;
  selectNode: (id: string | null) => void;

  // Connection actions
  addConnection: (conn: Omit<StitchConnection, 'id' | 'createdAt'>) => Promise<StitchConnection>;
  removeConnection: (id: string) => Promise<void>;
  selectConnection: (id: string | null) => void;

  // Preview
  setPreviewNode: (nodeId: string | null) => void;
  clearPreview: () => void;

  // Execution
  setExecutionState: (state: StitchExecutionState) => void;
  startExecution: () => Promise<void>;
  cancelExecution: () => void;

  // Replay
  replayNode: (nodeId: string) => Promise<void>;
  replayNodeWithInput: (nodeId: string, customInput: unknown) => Promise<void>;
}

// ─── Store ──────────────────────────────────────────────────────────────────

export const useStitchStore = create<StitchState>()(
  immer((set) => ({
    chains: [],
    folders: [],
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
    bottomPanel: 'none',
    debugScrollToNodeId: null,
    previewNodeId: null,

    loadChains: async () => {
      const [chains, folders] = await Promise.all([
        stitchDb.loadChains(),
        stitchFolderDb.loadStitchFolders(),
      ]);
      set((state) => {
        state.chains = chains;
        state.folders = folders;
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

    createChain: async (name: string, mappingId?: string | null, folderId?: string | null, requestId?: string | null) => {
      const chain = await stitchDb.insertChain(name, mappingId, folderId, requestId);
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
      const chain = useStitchStore.getState().chains.find((c) => c.id === id);
      // If chain is bound to a mapper, unhook it
      if (chain?.mappingId) {
        const { updateMapping } = await import('@/lib/mappings');
        await updateMapping(chain.mappingId, { use_chain: false, chain_id: null }).catch(() => {});
        const { useMappingsStore } = await import('@/stores/mappingsStore');
        useMappingsStore.setState((state) => {
          const m = state.mappings.find((x) => x.id === chain.mappingId);
          if (m) { m.use_chain = false; m.chain_id = null; }
        });
      }
      // If chain is bound to a request (pre-request chain), unset pre_request_chain_id
      if (chain?.requestId) {
        const { updateSavedRequest } = await import('@/lib/collections');
        await updateSavedRequest(chain.requestId, { pre_request_chain_id: null } as never).catch(() => {});
      }
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

    duplicateChain: async (id: string) => {
      const source = useStitchStore.getState().chains.find((c) => c.id === id);
      const newName = source ? `${source.name} (Copy)` : 'Chain (Copy)';
      const { chain, nodes, connections } = await stitchDb.duplicateChain(id, newName);
      set((state) => {
        state.chains.push(chain);
        state.activeChainId = chain.id;
        state.nodes = nodes;
        state.connections = connections;
        state.selectedNodeId = null;
        state.selectedConnectionId = null;
        state.executionState = 'idle';
        state.executionNodeOutputs = {};
        state.executionLogs = [];
        state.previewNodeId = null;
        state.bottomPanel = 'none';
      });
      return chain;
    },

    // ─── Folder Actions ──────────────────────────────────────────────────────

    addFolder: async (name: string, parentId?: string | null) => {
      const folder = await stitchFolderDb.createStitchFolder(name, parentId);
      set((state) => {
        state.folders.push(folder);
      });
      return folder;
    },

    renameFolder: async (id: string, name: string) => {
      await stitchFolderDb.renameStitchFolder(id, name);
      set((state) => {
        const folder = state.folders.find((f) => f.id === id);
        if (folder) {
          folder.name = name;
          folder.updatedAt = new Date().toISOString();
        }
      });
    },

    deleteFolder: async (id: string) => {
      // Move children chains to root before deleting folder
      const chainsInFolder = useStitchStore.getState().chains.filter((c) => c.folderId === id);
      for (const chain of chainsInFolder) {
        await stitchFolderDb.updateChainFolder(chain.id, null);
      }
      // Delete child subfolders
      const childFolders = useStitchStore.getState().folders.filter((f) => f.parentId === id);
      for (const child of childFolders) {
        await stitchFolderDb.deleteStitchFolder(child.id);
      }
      await stitchFolderDb.deleteStitchFolder(id);
      set((state) => {
        state.folders = state.folders.filter((f) => f.id !== id && f.parentId !== id);
        for (const chain of state.chains) {
          if (chain.folderId === id) chain.folderId = null;
        }
      });
    },

    reorderFolders: (ids: string[]) => {
      set((state) => {
        for (let i = 0; i < ids.length; i++) {
          const folder = state.folders.find((f) => f.id === ids[i]);
          if (folder) folder.sortOrder = i;
        }
      });
    },

    updateChainFolder: async (chainId: string, folderId: string | null) => {
      await stitchFolderDb.updateChainFolder(chainId, folderId);
      set((state) => {
        const chain = state.chains.find((c) => c.id === chainId);
        if (chain) {
          chain.folderId = folderId;
          chain.updatedAt = new Date().toISOString();
        }
      });
    },

    reorderChains: (_folderId: string | null, ids: string[]) => {
      set((state) => {
        for (let i = 0; i < ids.length; i++) {
          const chain = state.chains.find((c) => c.id === ids[i]);
          if (chain) chain.sortOrder = i;
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
          if (changes.parentNodeId !== undefined) node.parentNodeId = changes.parentNodeId;
          node.updatedAt = new Date().toISOString();
        }
      });
    },

    batchMoveContainerChildren: (containerId: string, x: number, y: number) => {
      set((state) => {
        const parent = state.nodes.find((n) => n.id === containerId);
        if (!parent) return;
        const dx = x - parent.positionX;
        const dy = y - parent.positionY;
        parent.positionX = x;
        parent.positionY = y;
        for (const child of state.nodes) {
          if (child.parentNodeId === containerId) {
            child.positionX += dx;
            child.positionY += dy;
          }
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
        if (id) {
          state.selectedConnectionId = null;
          state.previewNodeId = null;
          if (state.bottomPanel === 'preview') state.bottomPanel = 'none';
        }
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

    setPreviewNode: (nodeId) =>
      set((state) => {
        if (nodeId) {
          state.previewNodeId = nodeId;
          state.bottomPanel = 'preview';
          state.selectedNodeId = null;
        } else {
          state.previewNodeId = null;
          if (state.bottomPanel === 'preview') state.bottomPanel = 'none';
        }
      }),

    clearPreview: () =>
      set((state) => {
        state.previewNodeId = null;
        if (state.bottomPanel === 'preview') state.bottomPanel = 'none';
      }),

    setExecutionState: (execState) =>
      set((state) => {
        state.executionState = execState;
      }),

    startExecution: async () => {
      const { nodes, connections } = useStitchStore.getState();
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
        state.previewNodeId = null;
        state.bottomPanel = 'debug';
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
        onNodeStart: (nodeId: string, loopCtx?: { loopNodeId: string; iteration: number }): void => {
          const node = nodes.find((n) => n.id === nodeId);
          const url = node?.type === 'request' ? (node.config as { url?: string }).url ?? '' : undefined;
          set((state) => {
            state.executionCurrentNodeId = nodeId;
            state.executionLogs.push({
              nodeId,
              nodeLabel: node?.label ?? '',
              nodeType: node?.type ?? 'json-object',
              status: 'started',
              timestamp: Date.now() - startTime,
              url,
              loopIteration: loopCtx?.iteration,
              loopNodeId: loopCtx?.loopNodeId,
            });
          });
        },
        onNodeComplete: (nodeId: string, output: unknown, durationMs: number, loopCtx?: { loopNodeId: string; iteration: number }, consoleLogs?: Array<{ level: 'log' | 'warn' | 'error'; args: string }>): void => {
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
              loopIteration: loopCtx?.iteration,
              loopNodeId: loopCtx?.loopNodeId,
              consoleLogs,
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
          // Fade out green highlights after 4 seconds so subsequent runs are visible
          setTimeout(() => {
            set((state) => {
              if (state.executionState === 'completed') {
                state.executionNodeOutputs = {};
                state.executionState = 'idle';
              }
            });
          }, 4000);
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
      cancelledRef.current = true;
      set((state) => {
        state.executionState = 'idle';
        state.sleepCountdown = null;
      });
    },

    replayNode: async (nodeId: string) => {
      const { nodes, executionLogs } = useStitchStore.getState();
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return;
      const completedEntry = [...executionLogs].reverse().find(
        (e) => e.nodeId === nodeId && (e.status === 'completed' || e.status === 'replayed'),
      );
      const originalInput = completedEntry?.input ?? {};
      await useStitchStore.getState().replayNodeWithInput(nodeId, originalInput);
    },

    replayNodeWithInput: async (nodeId: string, customInput: unknown) => {
      const { nodes, connections, executionStartTime } = useStitchStore.getState();
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return;

      const envState = useEnvironmentStore.getState();
      const activeEnv = envState.environments.find((e) => e.id === envState.activeEnvironmentId);
      const envVars: Record<string, string> = {};
      if (activeEnv?.variables) {
        for (const v of activeEnv.variables) {
          if (v.enabled && v.key) envVars[v.key] = v.value;
        }
      }

      try {
        const { executeSingleNode } = await import('@/lib/stitchEngine/singleNodeExecutor');
        const result = await executeSingleNode(node, customInput, envVars, nodes, connections);
        set((state) => {
          state.executionNodeOutputs[nodeId] = result.output;
          state.executionLogs.push({
            nodeId,
            nodeLabel: node.label ?? node.type,
            nodeType: node.type,
            status: 'replayed',
            timestamp: Date.now() - (executionStartTime || Date.now()),
            durationMs: result.durationMs,
            input: customInput as Record<string, unknown>,
            output: result.output,
            consoleLogs: result.consoleLogs,
            conditionResult: result.conditionResult,
          });
          state.previewNodeId = nodeId;
          state.bottomPanel = 'preview';
        });
      } catch (err) {
        set((state) => {
          state.executionLogs.push({
            nodeId,
            nodeLabel: node.label ?? node.type,
            nodeType: node.type,
            status: 'error',
            timestamp: Date.now() - (executionStartTime || Date.now()),
            error: err instanceof Error ? err.message : String(err),
          });
        });
      }
    },
  })),
);

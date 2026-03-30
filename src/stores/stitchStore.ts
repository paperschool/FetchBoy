import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { StitchChain, StitchNode, StitchConnection, StitchExecutionState } from '@/types/stitch';
import * as stitchDb from '@/lib/stitch';

// ─── State ──────────────────────────────────────────────────────────────────

interface StitchState {
  chains: StitchChain[];
  activeChainId: string | null;
  nodes: StitchNode[];
  connections: StitchConnection[];
  selectedNodeId: string | null;
  executionState: StitchExecutionState;

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

  // Execution
  setExecutionState: (state: StitchExecutionState) => void;
}

// ─── Store ──────────────────────────────────────────────────────────────────

export const useStitchStore = create<StitchState>()(
  immer((set) => ({
    chains: [],
    activeChainId: null,
    nodes: [],
    connections: [],
    selectedNodeId: null,
    executionState: 'idle' as StitchExecutionState,

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
        if (chain) chain.name = name;
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
        }
      });
    },

    removeNode: async (id) => {
      await stitchDb.deleteNode(id);
      set((state) => {
        state.nodes = state.nodes.filter((n) => n.id !== id);
        state.connections = state.connections.filter(
          (c) => c.sourceNodeId !== id && c.targetNodeId !== id,
        );
        if (state.selectedNodeId === id) {
          state.selectedNodeId = null;
        }
      });
    },

    selectNode: (id) =>
      set((state) => {
        state.selectedNodeId = id;
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

    setExecutionState: (execState) =>
      set((state) => {
        state.executionState = execState;
      }),
  })),
);

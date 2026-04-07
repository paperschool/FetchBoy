import type { StitchNode, StitchConnection } from '@/types/stitch';

/**
 * Assign each node to a layer (depth) using longest-path method.
 * Detects and breaks back-edges (cycles) before layering.
 */
export function assignLayers(
  nodes: StitchNode[],
  connections: StitchConnection[],
): Map<string, number> {
  const nodeIds = new Set(nodes.map((n) => n.id));
  const conns = connections.filter((c) => nodeIds.has(c.sourceNodeId) && nodeIds.has(c.targetNodeId));

  // Detect back-edges via DFS
  const backEdges = new Set<string>();
  const visited = new Set<string>();
  const onStack = new Set<string>();
  const adj = new Map<string, string[]>();
  for (const n of nodes) adj.set(n.id, []);
  for (const c of conns) adj.get(c.sourceNodeId)?.push(c.targetNodeId);

  function dfs(id: string): void {
    visited.add(id);
    onStack.add(id);
    for (const next of adj.get(id) ?? []) {
      if (onStack.has(next)) backEdges.add(`${id}->${next}`);
      else if (!visited.has(next)) dfs(next);
    }
    onStack.delete(id);
  }
  for (const n of nodes) { if (!visited.has(n.id)) dfs(n.id); }

  const dagConns = conns.filter((c) => !backEdges.has(`${c.sourceNodeId}->${c.targetNodeId}`));

  // Longest-path layer assignment via Kahn's algorithm
  const depth = new Map<string, number>();
  const inDegree = new Map<string, number>();
  const dagAdj = new Map<string, string[]>();
  for (const n of nodes) { inDegree.set(n.id, 0); dagAdj.set(n.id, []); }
  for (const c of dagConns) {
    dagAdj.get(c.sourceNodeId)?.push(c.targetNodeId);
    inDegree.set(c.targetNodeId, (inDegree.get(c.targetNodeId) ?? 0) + 1);
  }

  const queue = nodes.filter((n) => (inDegree.get(n.id) ?? 0) === 0).map((n) => n.id);
  for (const id of queue) depth.set(id, 0);

  while (queue.length > 0) {
    const id = queue.shift()!;
    const d = depth.get(id) ?? 0;
    for (const next of dagAdj.get(id) ?? []) {
      depth.set(next, Math.max(depth.get(next) ?? 0, d + 1));
      const deg = (inDegree.get(next) ?? 1) - 1;
      inDegree.set(next, deg);
      if (deg === 0) queue.push(next);
    }
  }
  for (const n of nodes) { if (!depth.has(n.id)) depth.set(n.id, 0); }

  return depth;
}

/** Build ordered layer arrays from a layerMap. */
export function buildLayers(nodes: StitchNode[], layerMap: Map<string, number>): string[][] {
  const maxLayer = Math.max(...[...layerMap.values()], 0);
  const layers: string[][] = Array.from({ length: maxLayer + 1 }, () => []);
  for (const n of nodes) layers[layerMap.get(n.id) ?? 0].push(n.id);
  return layers;
}

/** Barycentric crossing minimisation: 2–4 top-down/bottom-up sweeps. */
export function minimiseCrossings(
  layers: string[][],
  connections: StitchConnection[],
  nodeIds: Set<string>,
): string[][] {
  const conns = connections.filter((c) => nodeIds.has(c.sourceNodeId) && nodeIds.has(c.targetNodeId));
  const result = layers.map((l) => [...l]);

  for (let sweep = 0; sweep < 4; sweep++) {
    for (let i = 1; i < result.length; i++) {
      const prevPos = new Map(result[i - 1].map((id, idx) => [id, idx]));
      const bc = new Map<string, number>();
      for (const id of result[i]) {
        const preds = conns.filter((c) => c.targetNodeId === id && prevPos.has(c.sourceNodeId));
        bc.set(id, preds.length > 0
          ? preds.reduce((s, c) => s + (prevPos.get(c.sourceNodeId) ?? 0), 0) / preds.length
          : result[i].indexOf(id));
      }
      result[i].sort((a, b) => (bc.get(a) ?? 0) - (bc.get(b) ?? 0));
    }
    for (let i = result.length - 2; i >= 0; i--) {
      const nextPos = new Map(result[i + 1].map((id, idx) => [id, idx]));
      const bc = new Map<string, number>();
      for (const id of result[i]) {
        const succs = conns.filter((c) => c.sourceNodeId === id && nextPos.has(c.targetNodeId));
        bc.set(id, succs.length > 0
          ? succs.reduce((s, c) => s + (nextPos.get(c.targetNodeId) ?? 0), 0) / succs.length
          : result[i].indexOf(id));
      }
      result[i].sort((a, b) => (bc.get(a) ?? 0) - (bc.get(b) ?? 0));
    }
  }
  return result;
}

/** Find disconnected components via BFS on undirected edges. */
export function findComponents(nodes: StitchNode[], connections: StitchConnection[]): StitchNode[][] {
  const nodeIds = new Set(nodes.map((n) => n.id));
  const adj = new Map<string, Set<string>>();
  for (const n of nodes) adj.set(n.id, new Set());
  for (const c of connections) {
    if (nodeIds.has(c.sourceNodeId) && nodeIds.has(c.targetNodeId)) {
      adj.get(c.sourceNodeId)?.add(c.targetNodeId);
      adj.get(c.targetNodeId)?.add(c.sourceNodeId);
    }
  }
  const visited = new Set<string>();
  const components: StitchNode[][] = [];
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  for (const n of nodes) {
    if (visited.has(n.id)) continue;
    const component: StitchNode[] = [];
    const queue = [n.id];
    while (queue.length > 0) {
      const id = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      component.push(nodeMap.get(id)!);
      for (const neighbor of adj.get(id) ?? []) {
        if (!visited.has(neighbor)) queue.push(neighbor);
      }
    }
    components.push(component);
  }
  return components;
}

import type { StitchNode, StitchConnection } from '@/types/stitch';
import { NODE_WIDTH, LAYER_GAP_Y, NODE_GAP_X, COMPONENT_GAP_Y, STAGGER_MAX_X, STAGGER_PERIOD } from './smartLayout.types';
import { assignLayers, buildLayers, minimiseCrossings, findComponents } from './smartLayoutLayers';
import { computeLoopChildPositions } from './loopLayout';

// ─── Node Height ───────────────────────────────────────────────────────────

const DEFAULT_NODE_HEIGHT = 82;

/** Measure actual DOM height, fall back to estimate. */
function measureNodeHeight(nodeId: string, node: StitchNode, allNodes: StitchNode[]): number {
  const el = document.querySelector(`[data-node-id="${nodeId}"]`);
  if (el) return (el as HTMLElement).offsetHeight;
  // Fallback estimate for loop containers
  if (node.type === 'loop') {
    const childCount = allNodes.filter((n) => n.parentNodeId === node.id).length;
    return 130 + (childCount > 0 ? 100 : 0);
  }
  return DEFAULT_NODE_HEIGHT;
}

// ─── Stagger for Narrow Layouts ───────────────────────────────────────────

/** Triangular wave oscillating 0→1→0 over `period` steps. */
function triangleWave(step: number, period: number): number {
  const half = period / 2;
  const pos = step % period;
  return pos < half ? pos / half : 2 - pos / half;
}

/** Apply horizontal stagger to single-node layers in narrow layouts. */
function applyStagger(
  orderedLayers: string[][],
  positions: Map<string, { x: number; y: number }>,
): void {
  const nonEmpty = orderedLayers.filter((l) => l.length > 0);
  if (nonEmpty.length < 3) return;
  const singleCount = nonEmpty.filter((l) => l.length === 1).length;
  if (singleCount / nonEmpty.length < 0.75) return;

  let step = 0;
  for (const layer of orderedLayers) {
    if (layer.length === 0) continue;
    if (layer.length === 1) {
      const pos = positions.get(layer[0]);
      if (pos) pos.x += triangleWave(step, STAGGER_PERIOD) * STAGGER_MAX_X;
    }
    step++;
  }
}

// ─── Position Computation ──────────────────────────────────────────────────

function computeComponentPositions(
  nodes: StitchNode[],
  connections: StitchConnection[],
  offsetX: number,
  offsetY: number,
  allNodes: StitchNode[],
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  if (nodes.length === 0) return positions;
  if (nodes.length === 1) {
    positions.set(nodes[0].id, { x: offsetX, y: offsetY });
    return positions;
  }

  const nodeIds = new Set(nodes.map((n) => n.id));
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const layerMap = assignLayers(nodes, connections);

  // Ensure entry nodes are at layer 0 and exit/terminal nodes at the deepest layer
  // (the topological sort should already produce this, but enforce it)
  const maxLayer = Math.max(...[...layerMap.values()], 0);
  for (const n of nodes) {
    if (n.type === 'mapping-entry') layerMap.set(n.id, 0);
    if (n.type === 'mapping-exit' || n.type === 'fetch-terminal') layerMap.set(n.id, maxLayer);
  }

  const rawLayers = buildLayers(nodes, layerMap);
  const orderedLayers = minimiseCrossings(rawLayers, connections, nodeIds);

  // Compute positions with consistent spacing, skip empty layers
  let currentY = offsetY;
  for (const layer of orderedLayers) {
    if (layer.length === 0) continue;
    const totalWidth = layer.length * NODE_WIDTH + (layer.length - 1) * NODE_GAP_X;
    const layerStartX = offsetX + (NODE_WIDTH - totalWidth) / 2;

    for (let i = 0; i < layer.length; i++) {
      positions.set(layer[i], { x: layerStartX + i * (NODE_WIDTH + NODE_GAP_X), y: currentY });
    }

    const tallest = Math.max(...layer.map((id) => {
      const n = nodeMap.get(id);
      return n ? measureNodeHeight(id, n, allNodes) : DEFAULT_NODE_HEIGHT;
    }));
    currentY += tallest + LAYER_GAP_Y;
  }

  applyStagger(orderedLayers, positions);
  return positions;
}

// ─── Main Entry Point ──────────────────────────────────────────────────────

export function computeSmartLayout(
  allNodes: StitchNode[],
  connections: StitchConnection[],
): Map<string, { x: number; y: number }> {
  const result = new Map<string, { x: number; y: number }>();
  const topLevel = allNodes.filter((n) => n.parentNodeId === null && n.type !== 'mapping');
  const containerNodes = topLevel.filter((n) => n.type === 'loop');

  // Layout loop children first
  for (const container of containerNodes) {
    const children = allNodes.filter((n) => n.parentNodeId === container.id);
    if (children.length === 0) continue;
    const childIds = new Set(children.map((n) => n.id));
    const childConns = connections.filter((c) => childIds.has(c.sourceNodeId) && childIds.has(c.targetNodeId));
    const virtualContainer = { ...container, positionX: 0, positionY: 0 };
    const loopPositions = computeLoopChildPositions(virtualContainer, children, childConns);
    for (const [childId, pos] of loopPositions) result.set(childId, pos);
  }

  // Layout top-level nodes
  const topIds = new Set(topLevel.map((n) => n.id));
  const topConns = connections.filter((c) => topIds.has(c.sourceNodeId) && topIds.has(c.targetNodeId));
  const components = findComponents(topLevel, topConns);
  let globalOffsetY = 0;

  for (const component of components) {
    const compIds = new Set(component.map((n) => n.id));
    const compConns = topConns.filter((c) => compIds.has(c.sourceNodeId) && compIds.has(c.targetNodeId));
    const positions = computeComponentPositions(component, compConns, 100, globalOffsetY + 50, allNodes);

    for (const [nodeId, pos] of positions) {
      result.set(nodeId, pos);
      if (containerNodes.some((n) => n.id === nodeId)) {
        for (const child of allNodes.filter((n) => n.parentNodeId === nodeId)) {
          const childPos = result.get(child.id);
          if (childPos) result.set(child.id, { x: pos.x + childPos.x, y: pos.y + childPos.y });
        }
      }
    }

    // Compute actual component bottom using measured heights
    let maxBottom = 0;
    for (const [nodeId, pos] of positions) {
      const n = component.find((x) => x.id === nodeId);
      const h = n ? measureNodeHeight(nodeId, n, allNodes) : DEFAULT_NODE_HEIGHT;
      maxBottom = Math.max(maxBottom, pos.y + h);
    }
    globalOffsetY = maxBottom + COMPONENT_GAP_Y;
  }

  return result;
}

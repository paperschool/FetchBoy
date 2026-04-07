import { describe, it, expect } from 'vitest';
import { computeSmartLayout } from './smartLayout';
import type { StitchNode, StitchConnection } from '@/types/stitch';

function makeNode(id: string, overrides: Partial<StitchNode> = {}): StitchNode {
  return {
    id, chainId: 'c1', type: 'js-snippet', positionX: 0, positionY: 0,
    config: {}, label: id, parentNodeId: null, createdAt: 'ts', updatedAt: 'ts',
    ...overrides,
  };
}

function makeConn(source: string, target: string, id = `${source}->${target}`): StitchConnection {
  return {
    id, chainId: 'c1', sourceNodeId: source, sourceKey: null,
    targetNodeId: target, targetSlot: null, createdAt: 'ts',
  };
}

describe('computeSmartLayout', () => {
  it('linear chain A→B→C assigns increasing Y positions', () => {
    const nodes = [makeNode('A'), makeNode('B'), makeNode('C')];
    const conns = [makeConn('A', 'B'), makeConn('B', 'C')];
    const positions = computeSmartLayout(nodes, conns);
    expect(positions.get('A')!.y).toBeLessThan(positions.get('B')!.y);
    expect(positions.get('B')!.y).toBeLessThan(positions.get('C')!.y);
  });

  it('diamond A→B, A→C, B→D, C→D places B and C on same layer', () => {
    const nodes = [makeNode('A'), makeNode('B'), makeNode('C'), makeNode('D')];
    const conns = [makeConn('A', 'B'), makeConn('A', 'C'), makeConn('B', 'D'), makeConn('C', 'D')];
    const positions = computeSmartLayout(nodes, conns);
    expect(positions.get('B')!.y).toBe(positions.get('C')!.y);
    expect(positions.get('A')!.y).toBeLessThan(positions.get('B')!.y);
    expect(positions.get('B')!.y).toBeLessThan(positions.get('D')!.y);
  });

  it('handles cycles without crashing', () => {
    const nodes = [makeNode('A'), makeNode('B')];
    const conns = [makeConn('A', 'B'), makeConn('B', 'A')];
    expect(() => computeSmartLayout(nodes, conns)).not.toThrow();
    const positions = computeSmartLayout(nodes, conns);
    expect(positions.size).toBe(2);
  });

  it('single node is centred', () => {
    const nodes = [makeNode('A')];
    const positions = computeSmartLayout(nodes, []);
    expect(positions.get('A')).toBeDefined();
  });

  it('disconnected components are stacked vertically', () => {
    const nodes = [makeNode('A'), makeNode('B'), makeNode('X'), makeNode('Y')];
    const conns = [makeConn('A', 'B'), makeConn('X', 'Y')];
    const positions = computeSmartLayout(nodes, conns);
    // Both components should have positions
    expect(positions.size).toBe(4);
    // Components should be at different Y ranges
    const abMaxY = Math.max(positions.get('A')!.y, positions.get('B')!.y);
    const xyMinY = Math.min(positions.get('X')!.y, positions.get('Y')!.y);
    expect(xyMinY).toBeGreaterThan(abMaxY);
  });

  it('nodes do not overlap horizontally within a layer', () => {
    const nodes = [makeNode('A'), makeNode('B'), makeNode('C'), makeNode('D')];
    const conns = [makeConn('A', 'C'), makeConn('A', 'D'), makeConn('B', 'C'), makeConn('B', 'D')];
    const positions = computeSmartLayout(nodes, conns);
    // A and B are on layer 0
    const ax = positions.get('A')!.x;
    const bx = positions.get('B')!.x;
    expect(Math.abs(ax - bx)).toBeGreaterThanOrEqual(180); // NODE_WIDTH
  });

  it('container children are offset by container position', () => {
    const container = makeNode('loop1', { type: 'loop' });
    const child = makeNode('child1', { parentNodeId: 'loop1' });
    const nodes = [container, child];
    const positions = computeSmartLayout(nodes, []);
    // Container and child should both have positions
    expect(positions.get('loop1')).toBeDefined();
    expect(positions.get('child1')).toBeDefined();
  });

  it('empty nodes array returns empty map', () => {
    const positions = computeSmartLayout([], []);
    expect(positions.size).toBe(0);
  });

  it('mapping entry/exit as top-level nodes get layered correctly', () => {
    // Mapping container is engine-only (excluded from layout)
    const mapping = makeNode('m1', { type: 'mapping' });
    const entry = makeNode('entry', { type: 'mapping-entry' });
    const exit = makeNode('exit', { type: 'mapping-exit' });
    const middle = makeNode('mid', { type: 'js-snippet' });
    const nodes = [mapping, entry, exit, middle];
    const conns = [makeConn('entry', 'mid'), makeConn('mid', 'exit')];
    const positions = computeSmartLayout(nodes, conns);
    // Mapping node excluded; entry, exit, middle should have positions
    expect(positions.has('m1')).toBe(false);
    expect(positions.get('entry')).toBeDefined();
    expect(positions.get('exit')).toBeDefined();
    expect(positions.get('mid')).toBeDefined();
    // Entry → mid → exit in increasing Y
    expect(positions.get('entry')!.y).toBeLessThan(positions.get('mid')!.y);
    expect(positions.get('mid')!.y).toBeLessThan(positions.get('exit')!.y);
  });

  it('mapping entry/exit only (no middle) layers exit below entry', () => {
    const mapping = makeNode('m1', { type: 'mapping' });
    const entry = makeNode('entry', { type: 'mapping-entry' });
    const exit = makeNode('exit', { type: 'mapping-exit' });
    const nodes = [mapping, entry, exit];
    const conns = [makeConn('entry', 'exit')];
    const positions = computeSmartLayout(nodes, conns);
    expect(positions.has('m1')).toBe(false);
    expect(positions.get('entry')).toBeDefined();
    expect(positions.get('exit')).toBeDefined();
    expect(positions.get('exit')!.y).toBeGreaterThan(positions.get('entry')!.y);
  });

  it('linear chain with skip edges applies horizontal stagger', () => {
    const nodes = [
      makeNode('Entry'), makeNode('A'), makeNode('Req'),
      makeNode('B'), makeNode('C'), makeNode('Exit'),
    ];
    const conns = [
      makeConn('Entry', 'A'), makeConn('A', 'Req'), makeConn('Req', 'B'),
      makeConn('B', 'C'), makeConn('C', 'Exit'),
      makeConn('Entry', 'C'), // skip edge
      makeConn('Entry', 'Exit'), // skip edge
    ];
    const positions = computeSmartLayout(nodes, conns);
    const xs = [...positions.values()].map((p) => p.x);
    const uniqueXs = new Set(xs);
    // Stagger should produce at least 2 distinct X positions
    expect(uniqueXs.size).toBeGreaterThanOrEqual(2);
  });

  it('wide diamond graph is not staggered', () => {
    const nodes = [makeNode('A'), makeNode('B'), makeNode('C'), makeNode('D')];
    const conns = [makeConn('A', 'B'), makeConn('A', 'C'), makeConn('B', 'D'), makeConn('C', 'D')];
    const positions = computeSmartLayout(nodes, conns);
    // B and C on same layer — stagger should NOT activate (narrowRatio < 0.75)
    expect(positions.get('B')!.y).toBe(positions.get('C')!.y);
  });

  it('stagger does not change Y positions', () => {
    const nodes = [
      makeNode('A'), makeNode('B'), makeNode('C'), makeNode('D'),
    ];
    const conns = [makeConn('A', 'B'), makeConn('B', 'C'), makeConn('C', 'D'), makeConn('A', 'D')];
    const positions = computeSmartLayout(nodes, conns);
    // Y should still be strictly increasing for a linear chain
    expect(positions.get('A')!.y).toBeLessThan(positions.get('B')!.y);
    expect(positions.get('B')!.y).toBeLessThan(positions.get('C')!.y);
    expect(positions.get('C')!.y).toBeLessThan(positions.get('D')!.y);
  });

  it('wide graph with crossing minimisation produces valid positions', () => {
    // 3 source nodes → 3 target nodes (potential crossings)
    const nodes = [
      makeNode('S1'), makeNode('S2'), makeNode('S3'),
      makeNode('T1'), makeNode('T2'), makeNode('T3'),
    ];
    const conns = [
      makeConn('S1', 'T3'), makeConn('S2', 'T1'), makeConn('S3', 'T2'),
    ];
    const positions = computeSmartLayout(nodes, conns);
    expect(positions.size).toBe(6);
    // All targets should be on a lower layer than sources
    for (const t of ['T1', 'T2', 'T3']) {
      expect(positions.get(t)!.y).toBeGreaterThan(positions.get('S1')!.y);
    }
  });
});

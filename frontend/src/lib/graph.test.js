import { findCyclicEdgeIds, isReachable, buildAdjacency } from './graph';

const edge = (id, source, target) => ({ id, source, target });

describe('findCyclicEdgeIds', () => {
  test('empty graph has no cyclic edges', () => {
    expect(findCyclicEdgeIds([]).size).toBe(0);
  });

  test('simple chain a->b->c is acyclic', () => {
    const edges = [edge('e1', 'a', 'b'), edge('e2', 'b', 'c')];
    expect(findCyclicEdgeIds(edges).size).toBe(0);
  });

  test('two-node cycle a<->b flags both edges', () => {
    const edges = [edge('e1', 'a', 'b'), edge('e2', 'b', 'a')];
    expect(findCyclicEdgeIds(edges)).toEqual(new Set(['e1', 'e2']));
  });

  test('three-node cycle a->b->c->a flags all three', () => {
    const edges = [edge('e1', 'a', 'b'), edge('e2', 'b', 'c'), edge('e3', 'c', 'a')];
    expect(findCyclicEdgeIds(edges)).toEqual(new Set(['e1', 'e2', 'e3']));
  });

  test('self-loop is a cycle', () => {
    expect(findCyclicEdgeIds([edge('e1', 'a', 'a')])).toEqual(new Set(['e1']));
  });

  test('diamond a->b, a->c, b->d, c->d is acyclic', () => {
    const edges = [
      edge('e1', 'a', 'b'),
      edge('e2', 'a', 'c'),
      edge('e3', 'b', 'd'),
      edge('e4', 'c', 'd'),
    ];
    expect(findCyclicEdgeIds(edges).size).toBe(0);
  });

  test('only the cyclic subgraph is flagged, not the acyclic tail', () => {
    // a->b->a is a cycle; c->d is a separate clean edge.
    const edges = [
      edge('e1', 'a', 'b'),
      edge('e2', 'b', 'a'),
      edge('e3', 'c', 'd'),
    ];
    expect(findCyclicEdgeIds(edges)).toEqual(new Set(['e1', 'e2']));
  });
});

describe('isReachable', () => {
  test('finds a multi-hop path', () => {
    const adj = buildAdjacency([edge('e1', 'a', 'b'), edge('e2', 'b', 'c')]);
    expect(isReachable(adj, 'a', 'c')).toBe(true);
    expect(isReachable(adj, 'c', 'a')).toBe(false);
  });

  test('terminates on a cyclic graph instead of looping forever', () => {
    const adj = buildAdjacency([edge('e1', 'a', 'b'), edge('e2', 'b', 'a')]);
    expect(isReachable(adj, 'a', 'z')).toBe(false);
  });
});

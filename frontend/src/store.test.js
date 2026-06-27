import { useStore } from './store';

describe('Zustand Store Mechanics', () => {
  // Reset the store to a clean state before each test
  beforeEach(() => {
    useStore.setState({
      nodes: [],
      edges: [],
      nodeIDs: {}
    });
  });

  it('adds nodes correctly', () => {
    const { addNode } = useStore.getState();
    addNode({ id: 'node-1', type: 'text', data: { text: 'Hello' } });

    expect(useStore.getState().nodes).toHaveLength(1);
    expect(useStore.getState().nodes[0].id).toBe('node-1');
  });

  it('updates node data immutably', () => {
    const store = useStore.getState();
    store.addNode({ id: 'node-1', type: 'text', data: { text: 'Initial' } });
    const originalNode = useStore.getState().nodes[0];

    // Update the field
    useStore.getState().updateNodeField('node-1', 'text', 'Updated');

    const nodes = useStore.getState().nodes;
    expect(nodes[0].data.text).toBe('Updated');
    // A new node object must be produced (no in-place mutation)
    expect(nodes[0]).not.toBe(originalNode);
    expect(originalNode.data.text).toBe('Initial');
  });

  it('prunes orphaned edges when a source node is removed', () => {
    const store = useStore.getState();
    store.addNode({ id: 'node-1', type: 'text', data: {} });
    store.addNode({ id: 'node-2', type: 'output', data: {} });

    // Add an edge connecting node-1 to node-2
    useStore.setState({
      edges: [{ id: 'edge-1', source: 'node-1', target: 'node-2' }]
    });

    expect(useStore.getState().edges).toHaveLength(1);

    // Remove the source node
    useStore.getState().removeNode('node-1');

    // The store should automatically prune the connected edge
    expect(useStore.getState().edges).toHaveLength(0);
    expect(useStore.getState().nodes).toHaveLength(1);
  });

  it('maintains valid edges when unrelated nodes are removed', () => {
    const store = useStore.getState();
    store.addNode({ id: 'node-a', type: 'input', data: {} });
    store.addNode({ id: 'node-b', type: 'output', data: {} });
    store.addNode({ id: 'node-c', type: 'text', data: {} }); // Unrelated node

    useStore.setState({
      edges: [{ id: 'edge-ab', source: 'node-a', target: 'node-b' }]
    });

    // Remove the unrelated node
    useStore.getState().removeNode('node-c');

    // The edge between A and B should survive
    expect(useStore.getState().edges).toHaveLength(1);
    expect(useStore.getState().edges[0].id).toBe('edge-ab');
  });

  it('importPipeline replaces canvas and rebuilds the id counter from imported ids', () => {
    const store = useStore.getState();
    store.importPipeline({
      nodes: [
        { id: 'customInput-3', type: 'customInput', data: {} },
        { id: 'customInput-1', type: 'customInput', data: {} },
        { id: 'llm-2', type: 'llm', data: {} },
      ],
      edges: [{ id: 'e1', source: 'customInput-3', target: 'llm-2' }],
    });

    expect(useStore.getState().nodes).toHaveLength(3);
    expect(useStore.getState().edges).toHaveLength(1);

    // Counter seeds to the MAX suffix per type, so the next id can't collide.
    expect(useStore.getState().getNodeID('customInput')).toBe('customInput-4');
    expect(useStore.getState().getNodeID('llm')).toBe('llm-3');
  });

  it('importPipeline ignores ids that do not match the type-n convention', () => {
    const store = useStore.getState();
    store.importPipeline({
      nodes: [{ id: 'weird_uuid_abc', type: 'customInput', data: {} }],
      edges: [],
    });

    // No numeric suffix found -> counter starts fresh at 1.
    expect(useStore.getState().getNodeID('customInput')).toBe('customInput-1');
  });

  it('prunes only edges whose variable handle was removed (syncNodeHandles)', () => {
    const store = useStore.getState();
    store.addNode({ id: 'text-1', type: 'text', data: {} });
    store.addNode({ id: 'src-1', type: 'customInput', data: {} });

    useStore.setState({
      edges: [
        { id: 'e-keep', source: 'src-1', target: 'text-1', targetHandle: 'text-1-output' },
        { id: 'e-drop', source: 'src-1', target: 'text-1', targetHandle: 'text-1-var-removed' },
      ],
    });

    // The {{removed}} variable is gone; only the output handle remains valid.
    useStore.getState().syncNodeHandles('text-1', ['text-1-output']);

    const edges = useStore.getState().edges;
    expect(edges).toHaveLength(1);
    expect(edges[0].id).toBe('e-keep');
  });
});

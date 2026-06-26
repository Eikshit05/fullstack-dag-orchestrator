import { parsePipeline } from './api';

describe('parsePipeline (api.js)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    delete global.fetch;
  });

  it('posts mapped nodes/edges to the parse endpoint and returns the JSON', async () => {
    const responseBody = { num_nodes: 2, num_edges: 1, is_dag: true };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => responseBody,
    });

    // Deliberately pass noisy node/edge objects to prove the client trims them.
    const nodes = [
      { id: 'a', type: 'customInput', position: { x: 0, y: 0 }, data: { inputName: 'x' } },
      { id: 'b', type: 'customOutput', position: { x: 9, y: 9 }, data: {} },
    ];
    const edges = [
      { id: 'e1', source: 'a', target: 'b', sourceHandle: 'a-value', animated: true },
    ];

    const result = await parsePipeline(nodes, edges);

    expect(result).toEqual(responseBody);
    expect(global.fetch).toHaveBeenCalledTimes(1);

    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toContain('/pipelines/parse');
    expect(opts.method).toBe('POST');
    expect(opts.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(opts.body)).toEqual({
      nodes: [{ id: 'a' }, { id: 'b' }],
      edges: [{ source: 'a', target: 'b' }],
    });
  });

  it('throws on a 503 Service Unavailable response', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({}) });
    await expect(parsePipeline([], [])).rejects.toThrow('503');
  });

  it('throws on a 422 Unprocessable Entity response', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 422, json: async () => ({}) });
    await expect(parsePipeline([], [])).rejects.toThrow('422');
  });
});

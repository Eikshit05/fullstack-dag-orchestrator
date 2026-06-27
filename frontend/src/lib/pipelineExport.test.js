import { sanitizeNodesForExport } from './pipelineExport';

describe('sanitizeNodesForExport', () => {
  test('strips the LLM apiKey so it never reaches an exported file', () => {
    const nodes = [
      { id: 'llm-1', type: 'llm', data: { model: 'gpt-4o-mini', apiKey: 'sk-secret' } },
    ];
    const out = sanitizeNodesForExport(nodes);
    expect(out[0].data).toEqual({ model: 'gpt-4o-mini' });
    expect('apiKey' in out[0].data).toBe(false);
  });

  test('does not mutate the original node data', () => {
    const nodes = [{ id: 'llm-1', type: 'llm', data: { apiKey: 'sk-secret' } }];
    sanitizeNodesForExport(nodes);
    expect(nodes[0].data.apiKey).toBe('sk-secret'); // session state intact
  });

  test('leaves non-secret nodes untouched (same reference)', () => {
    const nodes = [{ id: 'text-1', type: 'text', data: { text: 'hello' } }];
    const out = sanitizeNodesForExport(nodes);
    expect(out[0]).toBe(nodes[0]);
  });
});

export const llmConfig = {
  type: 'llm',
  title: 'LLM',
  category: 'ai',
  fields: [
    { name: 'model', label: 'Model', kind: 'select', options: ['gpt-4o', 'claude-opus-4'], default: 'gpt-4o' },
  ],
  handles: [
    { id: 'system', type: 'target', position: 'left' },
    { id: 'prompt', type: 'target', position: 'left' },
    { id: 'response', type: 'source', position: 'right' },
  ],
};

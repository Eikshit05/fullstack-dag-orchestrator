export const llmConfig = {
  type: 'llm',
  title: 'LLM',
  category: 'ai',
  fields: [
    { name: 'model', label: 'Model', kind: 'select', options: ['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo'], default: 'gpt-4o-mini' },
    { name: 'apiKey', label: 'OpenAI API Key', kind: 'password', placeholder: 'sk-...', default: '' },
  ],
  handles: [
    { id: 'system', type: 'target', position: 'left' },
    { id: 'prompt', type: 'target', position: 'left' },
    { id: 'response', type: 'source', position: 'right' },
  ],
};

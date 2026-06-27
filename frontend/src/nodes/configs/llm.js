export const llmConfig = {
  type: 'llm',
  title: 'LLM',
  category: 'ai',
  fields: [
    { name: 'provider', kind: 'providerModel' },
  ],
  handles: [
    { id: 'system', type: 'target', position: 'left', dataType: 'Text' },
    { id: 'prompt', type: 'target', position: 'left', dataType: 'Text' },
    { id: 'response', type: 'source', position: 'right', dataType: 'Text' },
  ],
};

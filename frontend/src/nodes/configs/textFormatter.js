// Text Formatter — a linear, deterministic utility: takes Text, applies a
// standard string transform, emits Text. No branching; a tiny backend executor.
export const textFormatterConfig = {
  type: 'textFormatter',
  title: 'Text Formatter',
  category: 'text',
  fields: [
    { name: 'action', label: 'Format', kind: 'select', options: ['Uppercase', 'Lowercase', 'Title Case'], default: 'Uppercase' },
  ],
  handles: [
    { id: 'input', type: 'target', position: 'left', dataType: 'Text' },
    { id: 'output', type: 'source', position: 'right', dataType: 'Text' },
  ],
};

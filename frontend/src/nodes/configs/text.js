export const textConfig = {
  type: 'text',
  title: 'Text',
  category: 'text',
  fields: [
    { name: 'text', label: 'Text', kind: 'textarea', default: '{{input}}' },
  ],
  handles: [{ id: 'output', type: 'source', position: 'right' }],
};

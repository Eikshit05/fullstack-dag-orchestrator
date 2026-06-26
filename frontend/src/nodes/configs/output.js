export const outputConfig = {
  type: 'customOutput',
  title: 'Output',
  category: 'io',
  fields: [
    { name: 'outputName', label: 'Name', kind: 'text', default: '' },
    { name: 'outputType', label: 'Type', kind: 'select', options: ['Text', 'Image'], default: 'Text' },
  ],
  handles: [{ id: 'value', type: 'target', position: 'left' }],
};

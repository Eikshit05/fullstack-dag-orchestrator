export const inputConfig = {
  type: 'customInput',
  title: 'Input',
  category: 'io',
  fields: [
    { name: 'inputName', label: 'Name', kind: 'text', default: '' },
    { name: 'inputType', label: 'Type', kind: 'select', options: ['Text', 'File'], default: 'Text' },
  ],
  handles: [{ id: 'value', type: 'source', position: 'right' }],
};

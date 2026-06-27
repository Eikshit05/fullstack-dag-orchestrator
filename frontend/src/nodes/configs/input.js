export const inputConfig = {
  type: 'customInput',
  title: 'Input',
  category: 'io',
  fields: [
    { name: 'inputName', label: 'Name', kind: 'text', default: (id) => id.replace('customInput-', 'input_') },
    { name: 'inputType', label: 'Type', kind: 'select', options: ['Text'], default: 'Text' },
    // Runtime value fed into the pipeline when it is executed (Run).
    { name: 'value', label: 'Value', kind: 'text', default: '' },
  ],
  handles: [{ id: 'value', type: 'source', position: 'right' }],
};

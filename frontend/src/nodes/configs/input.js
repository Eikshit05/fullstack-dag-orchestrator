export const inputConfig = {
  type: 'customInput',
  title: 'Input',
  category: 'io',
  fields: [
    { name: 'inputName', label: 'Name', kind: 'text', default: (id) => id.replace('customInput-', 'input_') },
    { name: 'inputType', label: 'Type', kind: 'select', options: ['Text', 'Number', 'Boolean', 'JSON'], default: 'Text' },
    // Runtime value fed into the pipeline when it is executed (Run).
    { name: 'value', label: 'Value', kind: 'text', default: '' },
  ],
  // The output handle's data type follows the user-selected Type, so the canvas
  // enforces typing live as the dropdown changes.
  handles: (data) => [
    { id: 'value', type: 'source', position: 'right', dataType: data?.inputType || 'Text' },
  ],
};

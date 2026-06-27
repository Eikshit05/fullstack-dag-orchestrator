export const conditionalConfig = {
  type: 'conditional',
  title: 'Conditional',
  category: 'logic',
  fields: [
    { name: 'expression', label: 'If', kind: 'text', default: '' },
  ],
  handles: [
    { id: 'input', type: 'target', position: 'left', dataType: 'Any' },
    { id: 'true', type: 'source', position: 'right', dataType: 'Any' },
    { id: 'false', type: 'source', position: 'right', dataType: 'Any' },
  ],
};

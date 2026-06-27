export const filterConfig = {
  type: 'filter',
  title: 'Filter',
  category: 'logic',
  fields: [
    { name: 'condition', label: 'Keep where', kind: 'text', default: '' },
    { name: 'mode', label: 'Mode', kind: 'select', options: ['Include', 'Exclude'], default: 'Include' },
  ],
  handles: [
    { id: 'in', type: 'target', position: 'left', dataType: 'JSON' },
    { id: 'out', type: 'source', position: 'right', dataType: 'JSON' },
  ],
};

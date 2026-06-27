export const mathConfig = {
  type: 'math',
  title: 'Math',
  category: 'logic',
  fields: [
    { name: 'operator', label: 'Operator', kind: 'select', options: ['+', '-', '×', '÷'], default: '+' },
  ],
  handles: [
    { id: 'a', type: 'target', position: 'left', dataType: 'Number' },
    { id: 'b', type: 'target', position: 'left', dataType: 'Number' },
    { id: 'result', type: 'source', position: 'right', dataType: 'Number' },
  ],
};

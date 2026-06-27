// Split Text — tokenizes a Text block into a List on a delimiter. Linear utility;
// its output handle is JSON (a List), great for preprocessing before an LLM.
export const splitTextConfig = {
  type: 'splitText',
  title: 'Split Text',
  category: 'logic',
  fields: [
    { name: 'delimiter', label: 'Delimiter', kind: 'text', default: ',' },
  ],
  handles: [
    { id: 'input', type: 'target', position: 'left', dataType: 'Text' },
    { id: 'list', type: 'source', position: 'right', dataType: 'JSON' },
  ],
};

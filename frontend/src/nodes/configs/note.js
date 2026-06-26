export const noteConfig = {
  type: 'note',
  title: 'Note',
  category: 'neutral',
  // Escape hatch: a free-form node with no handles and a custom body.
  render: ({ id, data, updateNodeField }) => (
    <textarea
      className="vs-note"
      placeholder="Write a note…"
      value={data.note ?? ''}
      onChange={(e) => updateNodeField(id, 'note', e.target.value)}
    />
  ),
  handles: [],
};

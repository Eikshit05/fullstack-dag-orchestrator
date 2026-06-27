export const noteConfig = {
  type: 'note',
  title: 'Note',
  category: 'neutral',
  // Escape hatch: a free-form documentation block — a custom body, no handles.
  render: ({ id, data, updateNodeField }) => (
    <textarea
      className="vs-note"
      placeholder="Document your pipeline here…"
      value={data.note ?? ''}
      onChange={(e) => updateNodeField(id, 'note', e.target.value)}
    />
  ),
  handles: [],
};

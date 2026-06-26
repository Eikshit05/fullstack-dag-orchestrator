// draggableNode.js

// Static map so Tailwind's content scanner sees the literal class names.
const CHIP_BG = {
  io: 'bg-accent-io',
  ai: 'bg-accent-ai',
  logic: 'bg-accent-logic',
  text: 'bg-accent-text',
  neutral: 'bg-accent-neutral',
};

export const DraggableNode = ({ type, label, category }) => {
  const onDragStart = (event, nodeType) => {
    event.dataTransfer.setData('application/reactflow', JSON.stringify({ nodeType }));
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div
      className={`vs-chip ${CHIP_BG[category] || CHIP_BG.neutral}`}
      onDragStart={(event) => onDragStart(event, type)}
      draggable
    >
      {label}
    </div>
  );
};

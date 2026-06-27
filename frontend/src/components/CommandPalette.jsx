// CommandPalette.jsx
// Cmd/Ctrl+K palette for adding nodes without dragging. Built on cmdk (headless:
// filtering, focus-trap and a11y handled). The interesting bit is coordinate
// resolution — there's no mouse event, so we drop the node at the center of the
// current viewport via screenToFlowPosition.

import { useEffect, useState, useCallback } from 'react';
import { Command } from 'cmdk';
import { useReactFlow } from 'reactflow';
import { useStore } from '../store';
import { NODE_CONFIGS } from '../nodes/configs';

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  // reactflow 11.8.x exposes `project` (pane-relative -> flow coords); the newer
  // `screenToFlowPosition` isn't on the hook in this version. ui.js uses project too.
  const { project } = useReactFlow();
  const getNodeID = useStore((s) => s.getNodeID);
  const addNode = useStore((s) => s.addNode);

  // Cmd+K (mac) / Ctrl+K (win/linux) toggles the palette.
  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleSelect = useCallback(
    (type) => {
      // No pointer event here — place the node at the center of the visible canvas
      // pane. project() expects coordinates relative to the pane's own origin.
      const pane = document.querySelector('.react-flow');
      const rect = pane?.getBoundingClientRect();
      const position = project(
        rect
          ? { x: rect.width / 2, y: rect.height / 2 }
          : { x: window.innerWidth / 2, y: window.innerHeight / 2 }
      );
      // getNodeID keeps the ${type}-${n} convention (Correction 1) so derived
      // default names (input_1, …) and the import counter stay consistent.
      const nodeID = getNodeID(type);
      addNode({
        id: nodeID,
        type,
        position,
        data: { id: nodeID, nodeType: type },
      });
      setOpen(false);
    },
    [project, getNodeID, addNode]
  );

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Add a node"
      className="vs-cmdk"
      overlayClassName="vs-cmdk__overlay"
      contentClassName="vs-cmdk__content"
    >
      <Command.Input placeholder="Add a node…" className="vs-cmdk__input" />
      <Command.List className="vs-cmdk__list">
        <Command.Empty className="vs-cmdk__empty">No nodes found.</Command.Empty>
        {Object.values(NODE_CONFIGS).map((cfg) => (
          <Command.Item
            key={cfg.type}
            value={cfg.title}
            onSelect={() => handleSelect(cfg.type)}
            className="vs-cmdk__item"
          >
            {cfg.title}
          </Command.Item>
        ))}
      </Command.List>
    </Command.Dialog>
  );
}

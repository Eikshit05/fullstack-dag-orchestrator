// toolbar.js

import { DraggableNode } from './draggableNode';
import { NODE_CONFIGS } from './nodes/configs';

export const PipelineToolbar = () => (
  <div className="vs-toolbar">
    <div className="vs-toolbar__chips">
      {Object.values(NODE_CONFIGS).map((cfg) => (
        <DraggableNode key={cfg.type} type={cfg.type} label={cfg.title} category={cfg.category} />
      ))}
    </div>
  </div>
);

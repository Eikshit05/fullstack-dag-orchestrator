import { ReactFlowProvider } from 'reactflow';
import { PipelineToolbar } from './toolbar';
import { PipelineUI } from './ui';
import { SubmitButton } from './submit';
import { CommandPalette } from './components/CommandPalette';
import { KeyboardShortcuts } from './components/KeyboardShortcuts';
import { Toast } from './components/Toast';

function App() {
  // One provider for the whole app so the command palette and the canvas share a
  // single ReactFlow instance (the palette needs screenToFlowPosition from it).
  return (
    <ReactFlowProvider>
      <PipelineToolbar />
      <PipelineUI />
      <SubmitButton />
      <CommandPalette />
      <KeyboardShortcuts />
      <Toast />
    </ReactFlowProvider>
  );
}

export default App;

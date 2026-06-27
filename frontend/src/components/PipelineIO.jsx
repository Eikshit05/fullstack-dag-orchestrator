// PipelineIO.jsx
// Export the current canvas to a JSON file and import one back. Pure browser
// File I/O — no backend involved. Hydration goes through the store's
// importPipeline action so the per-type id counter is rebuilt atomically.

import { useRef } from 'react';
import { useStore } from '../store';

export function PipelineIO() {
  const fileInputRef = useRef(null);

  const handleExport = () => {
    // Read non-reactively: we only need the snapshot at click time.
    const { nodes, edges } = useStore.getState();
    const blob = new Blob([JSON.stringify({ nodes, edges }, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pipeline.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
          throw new Error('JSON must contain "nodes" and "edges" arrays.');
        }
        useStore.getState().importPipeline(parsed);
      } catch (err) {
        window.alert(`Import failed: ${err.message}`);
      } finally {
        // Reset so importing the same file twice still fires onChange.
        event.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="vs-toolbar__io">
      <button type="button" className="vs-io-btn" onClick={handleExport}>
        Export JSON
      </button>
      <button type="button" className="vs-io-btn" onClick={handleImportClick}>
        Import JSON
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        onChange={handleFile}
        className="hidden"
      />
    </div>
  );
}

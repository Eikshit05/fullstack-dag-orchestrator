// submit.js

import { useState } from 'react';
import { useStore } from './store';
import { shallow } from 'zustand/shallow';
import { parsePipeline, runPipeline } from './lib/api';
import { ResultCard } from './components/ResultCard';
import { RunResultCard } from './components/RunResultCard';

const selector = (state) => ({ nodes: state.nodes, edges: state.edges });

export const SubmitButton = () => {
  const { nodes, edges } = useStore(selector, shallow);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [run, setRun] = useState(null);
  const [runError, setRunError] = useState(null);
  const [running, setRunning] = useState(false);

  const onSubmit = async () => {
    setError(null);
    setResult(null);
    try {
      const data = await parsePipeline(nodes, edges);
      setResult(data); // render the styled card first…
      const msg = `Nodes: ${data.num_nodes} · Edges: ${data.num_edges} · Valid DAG: ${data.is_dag ? 'Yes' : 'No'}`;
      setTimeout(() => window.alert(msg), 0); // …then the spec-required alert, after paint
    } catch (e) {
      setError('Could not reach the backend. Is it running on the configured URL?');
    }
  };

  const onRun = async () => {
    setRun(null);
    setRunError(null);
    setRunning(true);
    try {
      const data = await runPipeline(nodes, edges);
      setRun(data); // execution output (Input -> Text -> LLM/Math -> Output)
    } catch (e) {
      setRunError(e.message); // missing key / cycle / network — surfaced cleanly
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="vs-submit-bar">
      <button type="button" className="vs-submit-btn" onClick={onSubmit}>Submit</button>
      <button type="button" className="vs-run-btn" onClick={onRun} disabled={running}>
        {running ? 'Running…' : 'Run Pipeline'}
      </button>
      <ResultCard
        result={result}
        error={error}
        onClose={() => { setResult(null); setError(null); }}
      />
      <RunResultCard
        run={run}
        error={runError}
        onClose={() => { setRun(null); setRunError(null); }}
      />
    </div>
  );
};

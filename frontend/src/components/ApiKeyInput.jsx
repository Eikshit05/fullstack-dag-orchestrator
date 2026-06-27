// ApiKeyInput — one place to set the OpenAI key shared by every AI node (LLM,
// Extract Data). Persisted to localStorage via the store; never written into the
// pipeline, so it stays out of exports.
import { useStore } from '../store';

export function ApiKeyInput() {
  const apiKey = useStore((s) => s.apiKey);
  const setApiKey = useStore((s) => s.setApiKey);
  return (
    <label className="vs-apikey" title="Used by all AI nodes; stored locally, never exported.">
      <span className="vs-apikey__label">OpenAI Key</span>
      <input
        type="password"
        className="vs-apikey__input"
        placeholder="sk-..."
        autoComplete="off"
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
      />
    </label>
  );
}

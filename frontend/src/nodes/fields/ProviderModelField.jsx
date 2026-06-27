// ProviderModelField — a compound field (kind: 'providerModel') that renders a
// Provider dropdown and a Model dropdown whose options follow the provider. It
// manages two data keys (provider, model) together, snapping the model to a valid
// option whenever the provider changes. This is pipeline logic (it exports with
// the graph) — the API keys live globally in the store, never on the node.
import { useEffect } from 'react';

// Short, frontier-only lists — trivial to update here when a model drops.
export const MODEL_OPTIONS = {
  OpenAI: ['gpt-4o-mini', 'gpt-4o'],
  Anthropic: ['claude-sonnet-4-6', 'claude-fable-5', 'claude-opus-4-8'],
  Google: ['gemini-3.5-flash', 'gemini-3.1-pro'],
};
const PROVIDERS = Object.keys(MODEL_OPTIONS);
const DEFAULT_PROVIDER = 'OpenAI';

export function ProviderModelField({ data, nodeId, updateNodeField }) {
  const provider = MODEL_OPTIONS[data.provider] ? data.provider : DEFAULT_PROVIDER;
  const models = MODEL_OPTIONS[provider];
  const model = models.includes(data.model) ? data.model : models[0];

  // Persist resolved defaults into the node once, so provider/model always travel
  // with the exported graph and reach the backend even if the user never touches them.
  useEffect(() => {
    if (!data.provider) updateNodeField(nodeId, 'provider', provider);
    if (!models.includes(data.model)) updateNodeField(nodeId, 'model', model);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onProvider = (next) => {
    updateNodeField(nodeId, 'provider', next);
    updateNodeField(nodeId, 'model', MODEL_OPTIONS[next][0]); // reset to a valid model
  };

  return (
    <>
      <label className="vs-field">
        <span className="vs-field__label">Provider</span>
        <select className="vs-field__control" value={provider} onChange={(e) => onProvider(e.target.value)}>
          {PROVIDERS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </label>
      <label className="vs-field">
        <span className="vs-field__label">Model</span>
        <select className="vs-field__control" value={model} onChange={(e) => updateNodeField(nodeId, 'model', e.target.value)}>
          {models.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </label>
    </>
  );
}

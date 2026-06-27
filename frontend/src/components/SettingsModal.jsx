// SettingsModal — the credential vault. One password field per provider; keys are
// held in the store + localStorage and injected into the run payload at execution
// time only. They never touch node data, so they can't leak through Export.
import { useState } from 'react';
import { useStore } from '../store';

const PROVIDERS = [
  ['openai', 'OpenAI', 'sk-...'],
  ['anthropic', 'Anthropic', 'sk-ant-...'],
  ['google', 'Google', 'AIza...'],
];

export function SettingsModal() {
  const [open, setOpen] = useState(false);
  const apiKeys = useStore((s) => s.apiKeys);
  const setApiKey = useStore((s) => s.setApiKey);

  return (
    <>
      <button type="button" className="vs-io-btn" onClick={() => setOpen(true)} title="API keys">
        ⚙️ Keys
      </button>
      {open && (
        <div className="vs-modal__overlay" onClick={() => setOpen(false)}>
          <div className="vs-modal" onClick={(e) => e.stopPropagation()}>
            <div className="vs-modal__head">
              <h2 className="vs-modal__title">API Keys</h2>
              <button type="button" className="vs-modal__close" onClick={() => setOpen(false)}>✕</button>
            </div>
            <p className="vs-modal__note">
              Stored only in your browser (localStorage) and used at run time. Never saved into a pipeline or its export.
            </p>
            {PROVIDERS.map(([id, label, placeholder]) => (
              <label className="vs-field" key={id}>
                <span className="vs-field__label">{label}</span>
                <input
                  type="password"
                  className="vs-field__control"
                  placeholder={placeholder}
                  autoComplete="off"
                  value={apiKeys[id] || ''}
                  onChange={(e) => setApiKey(id, e.target.value)}
                />
              </label>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

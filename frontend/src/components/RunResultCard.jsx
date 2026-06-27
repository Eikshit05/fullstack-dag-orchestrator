// RunResultCard — shows the result of executing the pipeline (the output node
// values), or a clean error. After a successful run, an on-demand "Explain this
// run" agent narrates what happened (summary + expandable per-node steps).
import { useState } from 'react';

export function RunResultCard({ run, error, onClose, onExplain, explanation, explaining, explainError }) {
  const [showSteps, setShowSteps] = useState(false);
  if (!run && !error) return null;
  const outputs = run?.outputs || {};
  const entries = Object.entries(outputs);
  const steps = explanation?.steps || [];

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/30 z-50">
      <div className="bg-white rounded-xl shadow-xl w-[28rem] max-h-[85vh] overflow-y-auto p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-slate-800">
            {error ? 'Run Failed' : 'Pipeline Output'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>

        {error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : (
          <>
            {entries.length === 0 ? (
              <p className="text-sm text-slate-500">Pipeline ran, but it has no Output node.</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {entries.map(([name, value]) => (
                  <li key={name} className="flex flex-col gap-1">
                    <span className="text-xs uppercase tracking-wide text-slate-400">{name}</span>
                    <span className="font-medium text-slate-800 whitespace-pre-wrap break-words">
                      {String(value)}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {/* On-demand "explain this run" agent */}
            <div className="mt-4 pt-4 border-t border-slate-100">
              {!explanation && (
                <button
                  type="button"
                  className="vs-explain-btn"
                  onClick={onExplain}
                  disabled={explaining}
                >
                  {explaining ? 'Explaining…' : '✨ Explain this run'}
                </button>
              )}
              {explainError && <p className="mt-2 text-sm text-red-600">{explainError}</p>}

              {explanation && (
                <div className="space-y-3">
                  <div>
                    <span className="text-xs uppercase tracking-wide text-slate-400">What happened</span>
                    <p className="mt-1 text-sm text-slate-700 whitespace-pre-wrap">{explanation.summary}</p>
                  </div>
                  {steps.length > 0 && (
                    <div>
                      <button
                        type="button"
                        className="text-xs font-medium text-accent-ai hover:brightness-110"
                        onClick={() => setShowSteps((s) => !s)}
                      >
                        {showSteps ? '▾' : '▸'} Step-by-step ({steps.length})
                      </button>
                      {showSteps && (
                        <ol className="mt-2 space-y-2 text-sm">
                          {steps.map((step, i) => (
                            <li key={i} className="flex gap-2">
                              <span className="text-slate-400">{i + 1}.</span>
                              <span className="text-slate-700">
                                <span className="text-xs text-slate-400">{step.node_id}</span>
                                <br />
                                {step.action}
                              </span>
                            </li>
                          ))}
                        </ol>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

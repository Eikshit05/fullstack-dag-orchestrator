// RunResultCard — shows the result of executing the pipeline (the output node
// values), or a clean error (missing API key, cycle, network).
export function RunResultCard({ run, error, onClose }) {
  if (!run && !error) return null;
  const outputs = run?.outputs || {};
  const entries = Object.entries(outputs);
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/30 z-50">
      <div className="bg-white rounded-xl shadow-xl w-96 p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-slate-800">
            {error ? 'Run Failed' : 'Pipeline Output'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>
        {error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : entries.length === 0 ? (
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
      </div>
    </div>
  );
}

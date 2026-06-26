export function ResultCard({ result, error, onClose }) {
  if (!result && !error) return null;
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/30 z-50">
      <div className="bg-white rounded-xl shadow-xl w-80 p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-slate-800">
            {error ? 'Submission Failed' : 'Pipeline Submitted'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>
        {error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : (
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between"><span>Nodes</span><span className="font-medium">{result.num_nodes}</span></li>
            <li className="flex justify-between"><span>Edges</span><span className="font-medium">{result.num_edges}</span></li>
            <li className="flex justify-between">
              <span>Valid DAG</span>
              <span className={`font-medium ${result.is_dag ? 'text-emerald-600' : 'text-red-600'}`}>
                {result.is_dag ? 'Yes' : 'No'}
              </span>
            </li>
          </ul>
        )}
      </div>
    </div>
  );
}

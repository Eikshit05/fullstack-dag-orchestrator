// PasswordField — a masked text input for secrets (e.g. an LLM API key).
// Registered under kind: 'password'. The value lives in node.data like any other
// field, but is stripped from JSON exports (see lib/pipelineExport.js).
export function PasswordField({ field, value, onChange }) {
  return (
    <label className="vs-field">
      <span className="vs-field__label">{field.label}</span>
      <input
        className="vs-field__control"
        type="password"
        autoComplete="off"
        placeholder={field.placeholder || ''}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

export function TextAreaField({ field, value, onChange }) {
  return (
    <label className="vs-field">
      <span className="vs-field__label">{field.label}</span>
      <textarea
        className="vs-field__control"
        rows={field.rows || 2}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

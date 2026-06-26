export function TextField({ field, value, onChange }) {
  return (
    <label className="vs-field">
      <span className="vs-field__label">{field.label}</span>
      <input
        className="vs-field__control"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

export function SelectField({ field, value, onChange }) {
  return (
    <label className="vs-field">
      <span className="vs-field__label">{field.label}</span>
      <select
        className="vs-field__control"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {(field.options || []).map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </label>
  );
}

export function CheckboxField({ field, value, onChange }) {
  return (
    <label className="vs-field vs-field--inline">
      <input
        type="checkbox"
        checked={!!value}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="vs-field__label">{field.label}</span>
    </label>
  );
}

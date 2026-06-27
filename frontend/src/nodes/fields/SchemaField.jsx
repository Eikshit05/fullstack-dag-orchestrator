// SchemaField — an embedded schema builder, registered under kind: 'schema'.
// Each row defines an extraction field (name + type); the Extract node turns each
// row into a dynamically-typed output handle. Value is an array of { name, type }.
const SCHEMA_TYPES = ['Text', 'Decimal', 'Boolean', 'List'];

export function SchemaField({ field, value, onChange }) {
  const rows = Array.isArray(value) ? value : [];
  const update = (i, key, val) =>
    onChange(rows.map((r, idx) => (idx === i ? { ...r, [key]: val } : r)));
  const add = () => onChange([...rows, { name: `field_${rows.length + 1}`, type: 'Text' }]);
  const remove = (i) => onChange(rows.filter((_, idx) => idx !== i));

  return (
    <div className="vs-field">
      <span className="vs-field__label">{field.label}</span>
      {rows.map((row, i) => (
        <div key={i} className="vs-schema-row">
          <input
            className="vs-field__control nodrag"
            placeholder="field name"
            value={row.name}
            onChange={(e) => update(i, 'name', e.target.value)}
          />
          <select
            className="vs-field__control nodrag"
            value={row.type}
            onChange={(e) => update(i, 'type', e.target.value)}
          >
            {SCHEMA_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <button type="button" className="vs-schema-remove nodrag" title="Remove field" onClick={() => remove(i)}>
            ✕
          </button>
        </div>
      ))}
      <button type="button" className="vs-schema-add nodrag" onClick={add}>
        + Add field
      </button>
    </div>
  );
}

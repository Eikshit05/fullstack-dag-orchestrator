// Extract Data node: forces unstructured text into a typed schema via the LLM's
// structured-output mode. The user-defined schema rows each become a dynamically
// typed output handle on the right edge.
const SCHEMA_TYPE_TO_DATATYPE = {
  Text: 'Text',
  Decimal: 'Number',
  Boolean: 'Boolean',
  List: 'JSON',
};

export const extractConfig = {
  type: 'extract',
  title: 'Extract Data',
  category: 'ai',
  fields: [
    { name: 'model', label: 'Model', kind: 'select', options: ['gpt-4o-mini', 'gpt-4o'], default: 'gpt-4o-mini' },
    { name: 'apiKey', label: 'OpenAI API Key', kind: 'password', placeholder: 'sk-...', default: '' },
    { name: 'fields', label: 'Schema', kind: 'schema', default: [] },
  ],
  // One target for the source text + one typed source handle per schema field.
  handles: (data) => [
    { id: 'context', type: 'target', position: 'left', dataType: 'Text' },
    ...(data.fields || [])
      .filter((f) => f.name)
      .map((f) => ({
        id: `field-${f.name}`,
        type: 'source',
        position: 'right',
        dataType: SCHEMA_TYPE_TO_DATATYPE[f.type] || 'Text',
      })),
  ],
};

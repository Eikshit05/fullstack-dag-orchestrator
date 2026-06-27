import { extractConfig } from './extract';

describe('extractConfig dynamic handles', () => {
  test('context input plus one typed output handle per schema field', () => {
    const handles = extractConfig.handles({
      fields: [
        { name: 'company', type: 'Text' },
        { name: 'revenue', type: 'Decimal' },
        { name: 'is_public', type: 'Boolean' },
        { name: 'risks', type: 'List' },
      ],
    });
    // 1 context target + 4 field sources
    expect(handles).toHaveLength(5);
    expect(handles[0]).toMatchObject({ id: 'context', type: 'target', dataType: 'Text' });

    const byId = Object.fromEntries(handles.map((h) => [h.id, h]));
    expect(byId['field-company'].dataType).toBe('Text');
    expect(byId['field-revenue'].dataType).toBe('Number'); // Decimal -> Number
    expect(byId['field-is_public'].dataType).toBe('Boolean');
    expect(byId['field-risks'].dataType).toBe('JSON'); // List -> JSON
    expect(byId['field-revenue'].type).toBe('source');
  });

  test('rows without a name are skipped (no half-built handles)', () => {
    const handles = extractConfig.handles({ fields: [{ name: '', type: 'Text' }] });
    expect(handles).toHaveLength(1); // just the context input
  });

  test('no fields -> only the context input handle', () => {
    expect(extractConfig.handles({})).toHaveLength(1);
  });
});

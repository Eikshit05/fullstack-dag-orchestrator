import { parseVariables } from './parseVariables';

describe('parseVariables', () => {
  it('extracts valid variables', () => {
    expect(parseVariables('{{ input }}')).toEqual(['input']);
    expect(parseVariables('{{ $custom_var }} and {{ _hidden2 }}')).toEqual(['$custom_var', '_hidden2']);
  });

  it('deduplicates aggressive repetition', () => {
    // Should only generate one handle for 'user_id'
    expect(parseVariables('{{ user_id }} is the same as {{user_id}}')).toEqual(['user_id']);
  });

  it('preserves first-seen order across multiple variables', () => {
    expect(parseVariables('{{ b }} {{ a }} {{ b }} {{ c }}')).toEqual(['b', 'a', 'c']);
  });

  it('rejects malformed syntax', () => {
    // 123invalid starts with a number; valid-name contains a hyphen.
    // Only valid_name should survive.
    const result = parseVariables('{{ 123invalid }} {{ valid_name }} {{ valid-name }}');
    expect(result).toEqual(['valid_name']);
  });

  it('silently discards JavaScript reserved keywords', () => {
    // 'normal' is the only valid identifier here that isn't reserved.
    const result = parseVariables('{{ function }} {{ return }} {{ const }} {{ class }} {{ normal }}');
    expect(result).toEqual(['normal']);
  });

  it('tolerates erratic whitespace and newlines inside braces', () => {
    const result = parseVariables('{{\n  data\t}} and {{   \n  value  }}');
    expect(result).toEqual(['data', 'value']);
  });

  it('returns an empty array for strings with no variables', () => {
    expect(parseVariables('Just some regular text without variables.')).toEqual([]);
    expect(parseVariables('')).toEqual([]);
    expect(parseVariables(null)).toEqual([]);
  });

  it('ignores incomplete or broken braces', () => {
    expect(parseVariables('{ input }')).toEqual([]);
    expect(parseVariables('{{input}')).toEqual([]);
    expect(parseVariables('{input}}')).toEqual([]);
  });
});

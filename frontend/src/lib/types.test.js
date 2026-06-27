import { getHandleDataType, isTypeCompatible, checkConnection } from './types';

// Fake registry so the rules are tested in isolation from the real configs.
const CONFIGS = {
  customInput: { handles: (data) => [{ id: 'value', type: 'source', position: 'right', dataType: data?.inputType || 'Text' }] },
  math: { handles: [{ id: 'a', type: 'target', dataType: 'Number' }, { id: 'result', type: 'source', dataType: 'Number' }] },
  llm: { handles: [{ id: 'prompt', type: 'target', dataType: 'Text' }] },
  mystery: { handles: [{ id: 'x', type: 'source' }] }, // no dataType -> Any
};

describe('getHandleDataType', () => {
  test('reads a static handle dataType by full handle id', () => {
    const node = { id: 'math-1', type: 'math', data: {} };
    expect(getHandleDataType(node, 'math-1-a', CONFIGS)).toBe('Number');
  });

  test('resolves a dynamic (function) handle from node.data', () => {
    const node = { id: 'customInput-1', type: 'customInput', data: { inputType: 'Number' } };
    expect(getHandleDataType(node, 'customInput-1-value', CONFIGS)).toBe('Number');
  });

  test('handles without a declared dataType default to Any', () => {
    const node = { id: 'mystery-1', type: 'mystery', data: {} };
    expect(getHandleDataType(node, 'mystery-1-x', CONFIGS)).toBe('Any');
  });
});

describe('isTypeCompatible', () => {
  test('same type connects', () => expect(isTypeCompatible('Number', 'Number')).toBe(true));
  test('Any on either side connects', () => {
    expect(isTypeCompatible('Any', 'Number')).toBe(true);
    expect(isTypeCompatible('Number', 'Any')).toBe(true);
  });
  test('everything widens into a Text target', () => {
    expect(isTypeCompatible('Number', 'Text')).toBe(true);
    expect(isTypeCompatible('JSON', 'Text')).toBe(true);
  });
  test('Text into Number is blocked (the bug we fixed)', () => {
    expect(isTypeCompatible('Text', 'Number')).toBe(false);
  });
  test('mismatched concretes into JSON/Boolean are blocked', () => {
    expect(isTypeCompatible('Text', 'JSON')).toBe(false);
    expect(isTypeCompatible('Number', 'Boolean')).toBe(false);
  });
});

describe('checkConnection', () => {
  const nodes = [
    { id: 'customInput-1', type: 'customInput', data: { inputType: 'Text' } },
    { id: 'customInput-2', type: 'customInput', data: { inputType: 'Number' } },
    { id: 'math-1', type: 'math', data: {} },
  ];

  test('blocks a Text Input -> Math number input', () => {
    const res = checkConnection(
      { source: 'customInput-1', sourceHandle: 'customInput-1-value', target: 'math-1', targetHandle: 'math-1-a' },
      nodes, CONFIGS,
    );
    expect(res).toMatchObject({ ok: false, sourceType: 'Text', targetType: 'Number' });
  });

  test('allows a Number Input -> Math number input', () => {
    const res = checkConnection(
      { source: 'customInput-2', sourceHandle: 'customInput-2-value', target: 'math-1', targetHandle: 'math-1-a' },
      nodes, CONFIGS,
    );
    expect(res).toMatchObject({ ok: true, sourceType: 'Number', targetType: 'Number' });
  });
});

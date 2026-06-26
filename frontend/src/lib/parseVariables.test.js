import { parseVariables } from './parseVariables';

test('extracts a single variable', () => {
  expect(parseVariables('{{input}}')).toEqual(['input']);
});
test('trims whitespace inside braces', () => {
  expect(parseVariables('{{  name  }}')).toEqual(['name']);
});
test('dedupes repeated variables, keeping first-seen order', () => {
  expect(parseVariables('{{b}} {{a}} {{b}}')).toEqual(['b', 'a']);
});
test('ignores reserved words', () => {
  expect(parseVariables('{{function}} {{return}} {{ok}}')).toEqual(['ok']);
});
test('ignores tokens that are not valid identifiers', () => {
  expect(parseVariables('{{1bad}} {{good}}')).toEqual(['good']);
});
test('supports $ and _ identifiers', () => {
  expect(parseVariables('{{_x}} {{$y}}')).toEqual(['_x', '$y']);
});
test('returns empty for empty or no-match input', () => {
  expect(parseVariables('')).toEqual([]);
  expect(parseVariables('no vars here')).toEqual([]);
});

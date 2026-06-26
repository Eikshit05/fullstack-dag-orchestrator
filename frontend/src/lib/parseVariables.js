const RESERVED = new Set([
  'abstract', 'arguments', 'await', 'boolean', 'break', 'byte', 'case', 'catch', 'char',
  'class', 'const', 'continue', 'debugger', 'default', 'delete', 'do', 'double', 'else',
  'enum', 'eval', 'export', 'extends', 'false', 'final', 'finally', 'float', 'for',
  'function', 'goto', 'if', 'implements', 'import', 'in', 'instanceof', 'int', 'interface',
  'let', 'long', 'native', 'new', 'null', 'package', 'private', 'protected', 'public',
  'return', 'short', 'static', 'super', 'switch', 'synchronized', 'this', 'throw', 'throws',
  'transient', 'true', 'try', 'typeof', 'var', 'void', 'volatile', 'while', 'with', 'yield',
]);

/**
 * Extract valid, unique, non-reserved variable names from `{{ name }}` tokens.
 * Returns names in first-seen order.
 */
export function parseVariables(text) {
  if (!text) return [];
  const re = /\{\{\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*\}\}/g;
  const seen = new Set();
  const result = [];
  for (const match of text.matchAll(re)) {
    const name = match[1];
    if (RESERVED.has(name) || seen.has(name)) continue;
    seen.add(name);
    result.push(name);
  }
  return result;
}

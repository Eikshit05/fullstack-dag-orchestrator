// types.js
// The handle data-type system. Each handle declares a `dataType`; an edge is
// only allowed when the source output type is compatible with the target input
// type. Pure functions (configs are injectable) so the rules are unit-testable.

import { NODE_CONFIGS } from '../nodes/configs';

export const DATA_TYPES = ['Text', 'Number', 'Boolean', 'JSON', 'Any'];

// Resolve a handle's declared dataType. `handleId` may be the full
// `${nodeId}-${id}` form (as edges store it) or the bare handle id. Handles that
// don't declare a dataType are treated as 'Any'.
export function getHandleDataType(node, handleId, configs = NODE_CONFIGS) {
  if (!node) return 'Any';
  const config = configs[node.type];
  if (!config) return 'Any';
  const handles =
    typeof config.handles === 'function'
      ? config.handles(node.data || {})
      : config.handles || [];
  const bareId =
    handleId && handleId.startsWith(`${node.id}-`)
      ? handleId.slice(node.id.length + 1)
      : handleId;
  const handle = handles.find((h) => h.id === bareId);
  return handle?.dataType || 'Any';
}

// Compatibility rule: A -> B is allowed when the types match, either side is
// `Any`, or the target is `Text` (everything safely widens to text). Feeding a
// concrete non-Text type into a different concrete type (e.g. Text -> Number) is
// blocked — that's the bug we're closing.
export function isTypeCompatible(sourceType, targetType) {
  return (
    sourceType === targetType ||
    sourceType === 'Any' ||
    targetType === 'Any' ||
    targetType === 'Text'
  );
}

// Convenience for onConnect: resolves both endpoints and returns the verdict.
export function checkConnection(connection, nodes, configs = NODE_CONFIGS) {
  const sourceNode = nodes.find((n) => n.id === connection.source);
  const targetNode = nodes.find((n) => n.id === connection.target);
  const sourceType = getHandleDataType(sourceNode, connection.sourceHandle, configs);
  const targetType = getHandleDataType(targetNode, connection.targetHandle, configs);
  return { ok: isTypeCompatible(sourceType, targetType), sourceType, targetType };
}

import { BaseNode } from './BaseNode';

export const createNodeComponent = (config) => {
  const NodeComponent = (props) => <BaseNode {...props} config={config} />;
  NodeComponent.displayName = `Node(${config.type})`;
  return NodeComponent;
};

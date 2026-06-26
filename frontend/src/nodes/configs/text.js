import { TextNodeBody } from '../TextNodeBody';
import { parseVariables } from '../../lib/parseVariables';

export const textConfig = {
  type: 'text',
  title: 'Text',
  category: 'text',
  render: (props) => <TextNodeBody {...props} />,
  handles: (data) => [
    { id: 'output', type: 'source', position: 'right' },
    ...parseVariables(data.text ?? '{{input}}').map((name) => ({
      id: `var-${name}`,
      type: 'target',
      position: 'left',
    })),
  ],
};

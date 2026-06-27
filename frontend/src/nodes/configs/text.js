import { TextNodeBody } from '../TextNodeBody';
import { parseVariables } from '../../lib/parseVariables';

export const textConfig = {
  type: 'text',
  title: 'Text',
  category: 'text',
  render: (props) => <TextNodeBody {...props} />,
  handles: (data) => [
    { id: 'output', type: 'source', position: 'right', dataType: 'Text' },
    ...parseVariables(data.text ?? '{{input}}').map((name) => ({
      id: `var-${name}`,
      type: 'target',
      position: 'left',
      dataType: 'Any', // a template slot accepts any value (it gets stringified)
    })),
  ],
};

import { inputConfig } from './input';
import { outputConfig } from './output';
import { llmConfig } from './llm';
import { textConfig } from './text';
import { filterConfig } from './filter';
import { mathConfig } from './math';
import { httpConfig } from './http';
import { conditionalConfig } from './conditional';
import { noteConfig } from './note';

export const NODE_CONFIGS = {
  [inputConfig.type]: inputConfig,
  [llmConfig.type]: llmConfig,
  [outputConfig.type]: outputConfig,
  [textConfig.type]: textConfig,
  [filterConfig.type]: filterConfig,
  [mathConfig.type]: mathConfig,
  [httpConfig.type]: httpConfig,
  [conditionalConfig.type]: conditionalConfig,
  [noteConfig.type]: noteConfig,
};

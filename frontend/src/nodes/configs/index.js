import { inputConfig } from './input';
import { outputConfig } from './output';
import { llmConfig } from './llm';
import { textConfig } from './text';

export const NODE_CONFIGS = {
  [inputConfig.type]: inputConfig,
  [llmConfig.type]: llmConfig,
  [outputConfig.type]: outputConfig,
  [textConfig.type]: textConfig,
};

import { inputConfig } from './input';
import { outputConfig } from './output';
import { llmConfig } from './llm';
import { textConfig } from './text';
import { scrapeConfig } from './scrape';

export const NODE_CONFIGS = {
  [inputConfig.type]: inputConfig,
  [textConfig.type]: textConfig,
  [llmConfig.type]: llmConfig,
  [scrapeConfig.type]: scrapeConfig,
  [outputConfig.type]: outputConfig,
};

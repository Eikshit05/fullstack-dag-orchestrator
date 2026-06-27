import { inputConfig } from './input';
import { outputConfig } from './output';
import { llmConfig } from './llm';
import { textConfig } from './text';
import { scrapeConfig } from './scrape';
import { extractConfig } from './extract';
import { textFormatterConfig } from './textFormatter';
import { splitTextConfig } from './splitText';
import { noteConfig } from './note';

export const NODE_CONFIGS = {
  [inputConfig.type]: inputConfig,
  [textConfig.type]: textConfig,
  [textFormatterConfig.type]: textFormatterConfig,
  [splitTextConfig.type]: splitTextConfig,
  [llmConfig.type]: llmConfig,
  [scrapeConfig.type]: scrapeConfig,
  [extractConfig.type]: extractConfig,
  [noteConfig.type]: noteConfig,
  [outputConfig.type]: outputConfig,
};

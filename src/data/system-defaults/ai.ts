import type {AiSelection} from '../../utils/aiModelSelection.ts';
import {claudeModels,geminiModels} from '../../utils/aiModelSelection.ts';

// Model options served by the AI settings API and accepted when saving.
export const aiModels = ['gpt-6.2-sol', 'gpt-6.1-sol', 'gpt-6.1-terra', 'gpt-6-luna', 'gpt-4o', 'MiniMax-M3.1-Flash', 'deepseek-v4-pro', 'deepseek-flash', 'deepseek-chat', ...claudeModels, ...geminiModels];

const initialSelection: AiSelection = {
  primary: 'gpt-6-luna',
  primaryEffort: 'medium',
  fallback: 'deepseek-v4-pro',
};

// Saved settings take precedence. An explicit primary override uses that model's own default effort.
export function initialAiSelection(primaryOverride?: string): AiSelection {
  return primaryOverride && primaryOverride !== initialSelection.primary
    ? {primary: primaryOverride, fallback: initialSelection.fallback}
    : {...initialSelection};
}

export default initialSelection;

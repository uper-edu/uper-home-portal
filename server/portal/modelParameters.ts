import {defaultReasoningEffort,supportsReasoningEffort,type ReasoningEffort} from '../../src/utils/aiModelSelection.ts';

/** GPT-6 reasoning models include reasoning in the completion budget; deepseek-flash disables default thinking for predictable latency and budget. */
export function modelParameters(model: string, tokens: number, temperature?: number, effort:ReasoningEffort=defaultReasoningEffort) {
  if (supportsReasoningEffort(model)) return {max_completion_tokens: tokens * 4, reasoning_effort: effort};
  if (model === 'deepseek-flash') return {max_tokens: tokens, thinking: {type: 'disabled'}, ...(temperature === undefined ? {} : {temperature})};
  return {max_tokens: tokens, ...(temperature === undefined ? {} : {temperature})};
}

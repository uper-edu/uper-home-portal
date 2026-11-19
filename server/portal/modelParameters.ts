/** GPT-6.1 Sol counts reasoning in its completion budget; deepseek-flash disables default thinking for predictable latency and budget. */
export function modelParameters(model: string, tokens: number, temperature?: number) {
  if (['gpt-6.1-sol','gpt-6.1-terra','gpt-6-luna'].includes(model)) return {max_completion_tokens: tokens * 4, reasoning_effort: 'low'};
  if (model === 'deepseek-flash') return {max_tokens: tokens, thinking: {type: 'disabled'}, ...(temperature === undefined ? {} : {temperature})};
  return {max_tokens: tokens, ...(temperature === undefined ? {} : {temperature})};
}

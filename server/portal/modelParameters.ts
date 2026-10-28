/** GPT-6.1 Sol counts reasoning in its completion budget and uses default sampling. */
export function modelParameters(model: string, tokens: number, temperature?: number) {
  if (['gpt-6.1-sol','gpt-6.1-terra','gpt-6-luna'].includes(model)) return {max_completion_tokens: tokens * 4, reasoning_effort: 'low'};
  return {max_tokens: tokens, ...(temperature === undefined ? {} : {temperature})};
}

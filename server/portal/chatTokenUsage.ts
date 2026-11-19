type CounterFields = Record<string, unknown>;

const fields = (value: unknown): CounterFields =>
  value !== null && typeof value === 'object' ? value as CounterFields : {};

const count = (value: unknown) =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;

/** Missing provider counters are unknown. An explicitly reported zero stays zero. */
export function chatTokenUsage(value: unknown) {
  const usage = fields(value);
  const prompt = fields(usage.prompt_tokens_details);
  const completion = fields(usage.completion_tokens_details);
  const writes = fields(prompt.cache_write_tokens_details);
  const input = count(usage.prompt_tokens);
  const output = count(usage.completion_tokens);
  const cached = count(usage.prompt_cache_hit_tokens) ?? count(prompt.cached_tokens);
  const cacheWrite = count(prompt.cache_write_tokens);
  return {
    input,
    cached,
    cacheMiss: count(usage.prompt_cache_miss_tokens),
    cacheWrite,
    cacheWrite30m: count(writes.ttl_30m_tokens),
    cacheWrite12h: count(writes.ttl_12h_tokens),
    output,
    reasoning: count(completion.reasoning_tokens),
  };
}

export type ChatTokenUsage = ReturnType<typeof chatTokenUsage>;

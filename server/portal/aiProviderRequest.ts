import {defaultReasoningEffort, isClaudeModel, isGeminiModel, type ReasoningEffort} from '../../src/utils/aiModelSelection.ts';
import {modelParameters} from './modelParameters.ts';

export type AiProvider = {model: string; url: string; key?: string; provider?:string; reasoningEffort?: ReasoningEffort};
type AiMessage = {role: string; content: string};
type RequestOptions = {
  tokens: number;
  signal: AbortSignal;
  temperature?: number;
  stream?: boolean;
  includeUsage?: boolean;
  json?: boolean;
  redirect?: RequestRedirect;
  quick?: boolean;
};

export function acceptedModel(requested: string, actual: string) {
  return actual === requested || actual.startsWith(requested + '-') ||
    (requested === 'deepseek-chat' && actual === 'deepseek-flash');
}

export function requestAiReply(request: typeof fetch, provider: AiProvider, messages: AiMessage[], options: RequestOptions) {
  const {model, key, url, reasoningEffort} = provider;
  const {stream, signal, tokens, temperature, redirect} = options;
  if (isClaudeModel(model)) {
    const system = messages.filter(message => message.role === 'system').map(message => message.content);
    // The JSON contracts vary by caller. Keep the established schemas in the prompts and validate the replies in each caller.
    system.push('Return exactly one JSON object. Do not add Markdown fences or any text outside the JSON.');
    const turns = messages.filter(message => message.role !== 'system');
    // Automated assessment follow-ups can end with a historical assistant turn. Claude requires a fresh user turn here.
    if (turns.at(-1)?.role !== 'user') turns.push({role: 'user', content: 'Respond to the current event as directed.'});
    const thinking = options.quick
      ? {type: model === 'claude-haiku-5-5' ? 'disabled' : 'between_tools'}
      : {type: 'adaptive'};
    return request(url, {
      method: 'POST', redirect: 'error', signal,
      headers: {'x-api-key': key!, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json'},
      body: JSON.stringify({
        model, system: system.join('\n\n'), messages: turns, max_tokens: options.quick ? tokens : tokens * 4, stream, thinking,
        output_config: {effort: reasoningEffort ?? defaultReasoningEffort},
      }),
    });
  }

  const miniMaxDirect=provider.provider==='minimax';
  const prompt=miniMaxDirect?[
    {role:'system',content:'Return exactly one JSON object without Markdown fences or any text outside the JSON.'}, ...messages,
  ]:messages;
  return request(url, {
    method: 'POST', signal, redirect:miniMaxDirect||isGeminiModel(model)?'error':redirect,
    headers: {Authorization: 'Bearer ' + key, 'Content-Type': 'application/json'},
    body: JSON.stringify({
      model, messages:prompt,
      ...(miniMaxDirect ? {reasoning_split:true} : options.json !== false ? {response_format: {type: 'json_object'}} : {}),
      ...modelParameters(model, tokens, temperature, reasoningEffort),
      stream,
      ...(stream && options.includeUsage ? {stream_options: {include_usage: true}} : {}),
    }),
  });
}

export function claudeFinishReason(reason: unknown) {
  if (reason === 'end_turn') return 'stop';
  if (reason === 'max_tokens') return 'length';
  if (reason === 'refusal') return 'refusal';
  return 'unexpected_stop';
}

export function claudeTextBlock(block: any): string {
  return block?.type === 'text' && typeof block.text === 'string' ? block.text : '';
}

export function decodeAiMessage(body: any, requestedModel: string) {
  if (isClaudeModel(requestedModel)) {
    if (typeof body.model !== 'string' || !acceptedModel(requestedModel, body.model)) throw Error('model_mismatch');
    return {
      model: body.model as string,
      content: Array.isArray(body.content) ? body.content.map(claudeTextBlock).join('') : '',
      finish: claudeFinishReason(body.stop_reason),
    };
  }
  if (isGeminiModel(requestedModel) && (typeof body.model !== 'string' || !acceptedModel(requestedModel, body.model))) {
    throw Error('model_mismatch');
  }
  return {model: body.model || requestedModel, content: body.choices?.[0]?.message?.content || '', finish: body.choices?.[0]?.finish_reason};
}

import {chatTokenUsage,type ChatTokenUsage} from './chatTokenUsage.ts';
import {isClaudeModel} from '../../src/utils/aiModelSelection.ts';
import {acceptedModel, claudeFinishReason, claudeTextBlock, decodeAiMessage, requestAiReply, type AiProvider} from './aiProviderRequest.ts';

type ReplyProgress = { content: string; model?: string };
type ProviderCall = {
  stream: boolean; retry: boolean; status: 'received'|'blank'|'error';
  model?: string; usage: ChatTokenUsage; elapsedMs: number;
};

export async function readAiReply(response: Response, onProgress: (progress: ReplyProgress) => void,
  onUsage: (value: unknown)=>void, requestedModel?: string) {
  if (!response.ok) throw Error(`Provider HTTP ${response.status}`);
  const streamed = response.headers.get("content-type")?.includes("text/event-stream") === true;
  let content = "", model: string | undefined, finish: string | undefined, done = false;
  const claude = requestedModel !== undefined && isClaudeModel(requestedModel);
  let claudeUsage: {input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number} = {};
  function recordClaudeUsage(update: typeof claudeUsage | undefined) {
    claudeUsage = {...claudeUsage, ...update};
    const {input_tokens, output_tokens, cache_read_input_tokens, cache_creation_input_tokens} = claudeUsage;
    onUsage({
      prompt_tokens: input_tokens === undefined ? undefined : input_tokens + (cache_read_input_tokens ?? 0) + (cache_creation_input_tokens ?? 0),
      completion_tokens: output_tokens,
      prompt_cache_miss_tokens: input_tokens === undefined ? undefined : input_tokens + (cache_creation_input_tokens ?? 0),
      prompt_tokens_details: {cached_tokens: cache_read_input_tokens, cache_write_tokens: cache_creation_input_tokens},
    });
  }
  const acceptClaudeEvent = (payload: any) => {
    switch (payload.type) {
      case 'message_start':
        model = payload.message?.model;
        if (typeof model !== 'string' || !acceptedModel(requestedModel!, model)) throw Error('model_mismatch');
        recordClaudeUsage(payload.message.usage);
        break;
      case 'content_block_start':
        content += claudeTextBlock(payload.content_block);
        break;
      case 'content_block_delta':
        if (payload.delta?.type === 'text_delta' && typeof payload.delta.text === 'string') content += payload.delta.text;
        break;
      case 'message_delta':
        if (payload.delta?.stop_reason) finish = claudeFinishReason(payload.delta.stop_reason);
        recordClaudeUsage(payload.usage);
        break;
      case 'message_stop': done = true; break;
      case 'error': throw Error('Claude stream error');
    }
    onProgress({content, model});
  };
  const accept = (payload: any) => {
    if (payload.usage) onUsage(payload.usage);
    if (payload.error) throw Error("Provider response error");
    model = payload.model || model;
    const choice = payload.choices?.[0];
    finish = choice?.finish_reason || finish;
    content += (streamed ? choice?.delta?.content : choice?.message?.content) || "";
    onProgress({ content, model });
  };

  if (streamed) {
    if (!response.body) throw Error("Missing provider stream end marker");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      for (;;) {
        const next = await reader.read();
        buffer += next.done ? decoder.decode() + "\n" : decoder.decode(next.value, { stream: true });
        let index: number;
        while ((index = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, index).trim();
          buffer = buffer.slice(index + 1);
          if (!line.startsWith("data:")) continue;
          const data = line.slice(5).trim();
          if (!claude && data === "[DONE]") { done = true; continue; }
          if (claude) acceptClaudeEvent(JSON.parse(data));
          else accept(JSON.parse(data));
        }
        if (next.done) break;
      }
    } finally {
      reader.releaseLock();
    }
  } else {
    const payload = await response.json();
    if (claude) {
      ({content, finish, model} = decodeAiMessage(payload, requestedModel));
      recordClaudeUsage(payload.usage);
      onProgress({content, model});
    } else accept(payload);
  }

  if (finish === "length") throw Error("Answer truncated");
  if (streamed && (!done || claude && (!model || !finish))) throw Error("Missing provider stream end marker");
  if (finish && finish !== "stop") throw Error(`Provider stopped with finish_reason: ${finish}`);
  return { streamed, content, model };
}

export async function readChatProviderReply(
  send: (stream: boolean) => Promise<Response>,
  retryBlankStream: boolean,
  onProgress: (progress: ReplyProgress) => void,
  onBlankStreamRetry: () => Promise<void>,
  onCall?: (call: ProviderCall)=>void,
  requestedModel?: string,
) {
  const readCall = async (stream: boolean, retry: boolean) => {
    const start = Date.now();
    let model: string|undefined;
    let usage = chatTokenUsage(null);
    let status: ProviderCall['status'] = 'error';
    try {
      const response = await readAiReply(await send(stream), progress => {
        model = progress.model;
        onProgress(progress);
      }, raw => { usage = chatTokenUsage(raw); }, requestedModel);
      status = response.content.trim() ? 'received' : 'blank';
      return response;
    } finally {
      onCall?.({stream,retry,status,model,usage,elapsedMs:Date.now()-start});
    }
  };
  let first: { streamed: boolean; content: string };
  try {
    first = await readCall(true,false);
  } catch (error) {
    if ((error as Error)?.message !== "Provider response error") throw error;
    const recovered = await readCall(false,true);
    if (!recovered.content.trim()) throw Error("Provider response error");
    return;
  }
  if (first.content.trim()) return;
  if (!retryBlankStream || !first.streamed) throw Error("Blank provider reply");
  await onBlankStreamRetry();
  const retry = await readCall(false,true);
  if (!retry.content.trim()) throw Error("Blank provider reply after non-stream retry");
}

type ChatProvider = AiProvider & {provider: string};
type ChatMessage = {role: string; content: string};
type ChatCallPurpose = 'consultation'|'reference'|'language_correction'|'turn_language'|'local_schedule';
type ChatAttempt = {
  provider: ChatProvider;
  role: 'primary'|'fallback';
  content: string;
  actualModel: string;
  request: (purpose: ChatCallPurpose, messages: ChatMessage[], tokens?: number) => Promise<void>;
};

export async function runChatProviderAttempts(
  providers: readonly ChatProvider[],
  complete: (attempt: ChatAttempt) => Promise<void>,
  handlers: {
    blankStreamRetry: (attempt: ChatAttempt) => Promise<void>;
    call: (attempt: ChatAttempt, purpose: ChatCallPurpose, call: ProviderCall) => void;
    failed: (attempt: ChatAttempt, error: unknown) => Promise<void>;
  },
  fetchReply: typeof fetch = fetch,
) {
  for (const [index, provider] of providers.entries()) {
    if (!provider.key) continue;
    const attempt: ChatAttempt = {
      provider,
      role: index === 0 ? 'primary' : 'fallback',
      content: '',
      actualModel: provider.model,
      async request(purpose, messages, tokens = 1200) {
        const signal = AbortSignal.timeout(90000);
        const send = (stream: boolean) => requestAiReply(fetchReply, provider, messages, {
          tokens, stream, includeUsage: true, signal, quick: purpose === 'turn_language' || purpose === 'local_schedule',
        });
        await readChatProviderReply(send, provider.provider === 'deepseek',
          ({content, model}) => {
            attempt.content = content;
            attempt.actualModel = model || provider.model;
          },
          async () => {
            await handlers.blankStreamRetry(attempt);
            attempt.content = '';
            attempt.actualModel = provider.model;
          },
          call => handlers.call(attempt, purpose, call),
          provider.model,
        );
      },
    };
    try {
      await complete(attempt);
      return;
    } catch (error) {
      await handlers.failed(attempt, error);
    }
  }
}

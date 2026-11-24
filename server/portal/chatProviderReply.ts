import {chatTokenUsage,type ChatTokenUsage} from './chatTokenUsage.ts';
import type {ReasoningEffort} from '../../src/utils/aiModelSelection.ts';
import {modelParameters} from './modelParameters.ts';

type ReplyProgress = { content: string; model?: string };
type ProviderCall = {
  stream: boolean; retry: boolean; status: 'received'|'blank'|'error';
  model?: string; usage: ChatTokenUsage; elapsedMs: number;
};

async function readReply(response: Response, onProgress: (progress: ReplyProgress) => void, onUsage: (value: unknown)=>void) {
  if (!response.ok) throw Error(`Provider HTTP ${response.status}`);
  const streamed = response.headers.get("content-type")?.includes("text/event-stream") === true;
  let content = "", model: string | undefined, finish: string | undefined, done = false;
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
          if (data === "[DONE]") { done = true; continue; }
          accept(JSON.parse(data));
        }
        if (next.done) break;
      }
    } finally {
      reader.releaseLock();
    }
  } else {
    accept(await response.json());
  }

  if (finish === "length") throw Error("Answer truncated");
  if (streamed && !done) throw Error("Missing provider stream end marker");
  if (finish && finish !== "stop") throw Error(`Provider stopped with finish_reason: ${finish}`);
  return { streamed, content };
}

export async function readChatProviderReply(
  send: (stream: boolean) => Promise<Response>,
  retryBlankStream: boolean,
  onProgress: (progress: ReplyProgress) => void,
  onBlankStreamRetry: () => Promise<void>,
  onCall?: (call: ProviderCall)=>void,
) {
  const readCall = async (stream: boolean, retry: boolean) => {
    const start = Date.now();
    let model: string|undefined;
    let usage = chatTokenUsage(null);
    let status: ProviderCall['status'] = 'error';
    try {
      const response = await readReply(await send(stream), progress => {
        model = progress.model;
        onProgress(progress);
      }, raw => { usage = chatTokenUsage(raw); });
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

type ChatProvider = {
  model: string;
  provider: string;
  key?: string;
  url: string;
  reasoningEffort?: ReasoningEffort;
};
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
        const send = (stream: boolean) => fetchReply(provider.url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${provider.key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: provider.model,
            messages,
            response_format: {type: 'json_object'},
            ...modelParameters(provider.model, tokens, undefined, provider.reasoningEffort),
            stream,
            ...(stream ? {stream_options: {include_usage: true}} : {}),
          }),
          signal,
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

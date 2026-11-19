import {chatTokenUsage,type ChatTokenUsage} from './chatTokenUsage.ts';

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
    if (payload.error) throw Error("Provider stream error");
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
  if (streamed && !done) throw Error("Incomplete answer");
  return content;
}

export async function readChatProviderReply(
  send: () => Promise<Response>,
  onProgress: (progress: ReplyProgress) => void,
  onCall: (call: ProviderCall) => void,
  meta: { stream?: boolean; retry?: boolean } = {},
) {
  const start = Date.now();
  let model: string|undefined;
  let usage = chatTokenUsage(null);
  let status: ProviderCall['status'] = 'error';
  try {
    const content = await readReply(await send(), progress => {
      model = progress.model;
      onProgress(progress);
    }, raw => { usage = chatTokenUsage(raw); });
    status = content.trim() ? 'received' : 'blank';
    if (status === 'blank') throw Error("Empty provider response");
  } finally {
    onCall({stream:meta.stream??true,retry:meta.retry??false,status,model,usage,elapsedMs:Date.now()-start});
  }
}

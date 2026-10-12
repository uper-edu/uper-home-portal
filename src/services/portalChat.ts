export type ChatSource = "homepage_widget" | "standalone_chat";
async function checked(res: Response) {
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw Error(e.error || `Request failed ${res.status}`);
  }
  return res;
}
let sessionReady: Promise<Response> | undefined;
function session() {
  return (sessionReady ||= fetch("/api/portal/session")
    .then(checked)
    .catch((e) => {
      sessionReady = undefined;
      throw e;
    }));
}
export async function conversation(source: ChatSource) {
  await session();
  const res = await checked(
    await fetch("/api/portal/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source, page: location.pathname }),
    }),
  );
  return (await res.json()).conversationId as string;
}
export async function registerContact(profile: object) {
  await session();
  return (
    await checked(
      await fetch("/api/portal/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      }),
    )
  ).json();
}
export async function chatFetch(
  _url: string,
  init: RequestInit,
  source: ChatSource,
) {
  const old = JSON.parse(String(init.body));
  const user = [...old.messages].reverse().find((m) => m.role === "user");
  const conversationId = await conversation(source);
  if (old.isHumanMode) {
    const action = await checked(
      await fetch("/api/portal/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, action: "handoff" }),
      }),
    );
    await action.json();
    return Response.json({
      reply: "人工跟进请求已登记，等待顾问联系。AI 仍可继续回答常见问题。",
      suggestedPrompts: [],
    });
  }
  return checked(
    await fetch("/api/chat", {
      ...init,
      body: JSON.stringify({
        conversationId,
        messageId: user.id || crypto.randomUUID(),
        content: user.content,
        stream: old.stream,
      }),
    }),
  );
}

export async function restoreChat(source: ChatSource) {
  const conversationId = await conversation(source);
  const data = await (
    await checked(await fetch("/api/portal/conversations/" + conversationId))
  ).json();
  return data.messages.map((m: any) => ({
    ...m,
    timestamp: new Date(m.created_at),
    content: m.status === "interrupted" ? "[回复中断，可重新提问]" : m.content,
  }));
}

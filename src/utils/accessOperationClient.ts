type Pending = {
  actor: string;
  url: string;
  operationId: string;
  payload?: string;
  unknown?: boolean;
};
const memory = new Map<string, Pending>();
const storageKey = "uper-access-operations";
function entries(): Pending[] {
  try {
    return JSON.parse(sessionStorage.getItem(storageKey) || "[]");
  } catch {
    return [];
  }
}
function remember(p: Pending) {
  const stored = entries().filter((x) => x.operationId !== p.operationId);
  try {
    sessionStorage.setItem(
      storageKey,
      JSON.stringify([
        ...stored,
        { actor: p.actor, url: p.url, operationId: p.operationId },
      ]),
    );
  } catch {}
  window.dispatchEvent(new Event("uper-access-operation"));
}
export function pendingAccessOperations(actor: string) {
  return entries().filter((x) => x.actor === actor);
}
export function forgetAccessOperation(id: string) {
  for (const [key, p] of memory) if (p.operationId === id) memory.delete(key);
  try {
    sessionStorage.setItem(
      storageKey,
      JSON.stringify(entries().filter((x) => x.operationId !== id)),
    );
  } catch {}
  window.dispatchEvent(new Event("uper-access-operation"));
}
export function clearAccessPasswords(actor: string) {
  for (const [key, p] of memory)
    if (p.actor === actor) {
      delete p.payload;
      memory.delete(key);
    }
}
export async function managementRequest(actor: string, url: string, body: any) {
  const key = actor + ":" + url,
    payload = JSON.stringify(body),
    saved = entries().find((x) => x.actor === actor && x.url === url);
  let p = memory.get(key);
  if (saved && !p) throw Error("access_operation_pending");
  if (p && p.payload !== payload) throw Error("access_operation_pending");
  if (!p) {
    p = { actor, url, operationId: crypto.randomUUID(), payload };
    memory.set(key, p);
    remember(p);
  }
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, operationId: p.operationId }),
      cache: "no-store",
    });
    const data = await r.json();
    if (!r.ok) {
      if (
        r.status < 500 &&
        ![401, 403].includes(r.status) &&
        ((!p.unknown && data.error !== "access_operation_conflict") ||
          data.error === "access_operation_cancelled")
      )
        forgetAccessOperation(p.operationId);
      else p.unknown = true;
      throw Error(data.error || "access_outcome_unknown");
    }
    forgetAccessOperation(p.operationId);
    return data;
  } catch (e) {
    if (memory.has(key)) p.unknown = true;
    throw e;
  }
}

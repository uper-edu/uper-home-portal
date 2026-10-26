/** An opaque cache namespace, never an authentication credential. Only /session selects it. */
let scope = '';
let revision = 0;
let pending: Promise<VisitorSession> | undefined;
const listeners = new Set<() => void>();
export const VISITOR_MARKER = 'uper_active_visitor_scope';
export interface VisitorSession { registered: boolean; cacheScope: string; profile?: Record<string, any> | null }
export function visitorScope() { return scope; }
export function visitorKey(key: string) {
  if (!scope) throw Error('Visitor identity has not been verified');
  return `${key}:${scope}`;
}
export function assertVisitorScope(expected: string) {
  if (!expected || expected !== scope) throw Error('Visitor changed; reload before continuing');
}
export function selectVisitorScope(next: string) {
  if (scope === next) return;
  scope = next; revision++;
  for (const listener of listeners) listener();
}
export function subscribeVisitorScope(listener: () => void) {
  listeners.add(listener); return () => { listeners.delete(listener); };
}
export function invalidateVisitorScope() { pending = undefined; selectVisitorScope(''); }
export function verifyVisitorSession(_refresh = false): Promise<VisitorSession> {
  if (pending) return pending;
  // Session is deliberately rechecked before mutations and when returning to a tab.
  const started = revision;
  const request = fetch('/api/portal/session', {cache: 'no-store', signal: AbortSignal.timeout(15000)})
    .then(async r => {
      if (!r.ok) throw Error('Visitor identity is unavailable');
      const s: VisitorSession = await r.json();
      if (!/^[a-f0-9]{64}$/.test(s.cacheScope)) throw Error('Invalid visitor identity');
      if (started !== revision) throw Error('Visitor changed while loading');
      selectVisitorScope(s.cacheScope);
      try {
        if (localStorage.getItem(VISITOR_MARKER) !== s.cacheScope) localStorage.setItem(VISITOR_MARKER, s.cacheScope);
      } catch { /* Storage may be unavailable. The live session is still authoritative. */ }
      return s;
    });
  pending = request;
  void request.finally(() => { if (pending === request) pending = undefined; }).catch(() => {});
  return request;
}
if (typeof window !== 'undefined') window.addEventListener('storage', event => {
  if (event.key === VISITOR_MARKER && event.newValue !== scope) invalidateVisitorScope();
});

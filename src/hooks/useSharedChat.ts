import {useEffect, useRef, useState} from 'react';
import {restoreCurrentChat, type ChatSource} from '../services/portalChat';
import {visitorScope} from '../services/visitorScope';
import {promotionParameters} from '../utils/promotionNavigation';

const key = (owner: string) => 'uper_chat_changed:' + owner;

export function announceChatChange(owner: string) {
  if (!owner || visitorScope() !== owner) return;
  try { localStorage.setItem(key(owner), crypto.randomUUID()); } catch {}
}

function chatLanding(owner: string) {
  const url = new URL(location.href);
  const previous = history.state?.uperChatVisitor;
  if (previous && previous !== owner) {
    for (const name of promotionParameters) url.searchParams.delete(name);
    url.searchParams.delete('entry_point');
  }
  history.replaceState({...history.state, uperChatVisitor: owner}, '', url);
  return url.pathname + url.search;
}

export function useSharedChat(source: ChatSource, paused: boolean, legacyThreadId?: string) {
  const [thread, setThread] = useState<Awaited<ReturnType<typeof restoreCurrentChat>>>();
  const [failed, setFailed] = useState(false);
  const [starting, setStarting] = useState(false);
  const [revision, refresh] = useState(0);
  const generation = useRef(0);
  const restoreQueue = useRef(Promise.resolve());
  const requestRefresh = () => refresh(value => value + 1);

  useEffect(() => {
    const owner = visitorScope();
    const onStorage = (event: StorageEvent) => { if (event.key === key(owner)) requestRefresh(); };
    const onVisible = () => { if (!document.hidden) requestRefresh(); };
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', requestRefresh);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', requestRefresh);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  useEffect(() => {
    if (paused || starting) return;
    const owner = visitorScope();
    const ticket = ++generation.current;
    const isCurrent = () => ticket === generation.current && owner === visitorScope();
    // Repeated focus/storage events keep only the latest pending refresh.
    restoreQueue.current = restoreQueue.current.then(async () => {
      if (!isCurrent()) return;
      try {
        const snapshot = await restoreCurrentChat(source, {legacyThreadId, page:chatLanding(owner)});
        if (!isCurrent()) return;
        setThread(previous => JSON.stringify(previous) === JSON.stringify(snapshot) ? previous : snapshot);
        setFailed(false);
      } catch {
        if (isCurrent()) setFailed(true);
      }
    });
    return () => { generation.current++; };
  }, [source, paused, starting, revision, legacyThreadId]);

  async function startNew() {
    if (!thread || starting) return false;
    const owner = visitorScope();
    generation.current++;
    setStarting(true);
    try {
      const snapshot = await restoreCurrentChat(source, {previous:thread.conversationId, page:chatLanding(owner)});
      if (owner !== visitorScope()) return false;
      setThread(snapshot);
      setFailed(false);
      announceChatChange(owner);
      return true;
    } catch {
      if (owner === visitorScope()) setFailed(true);
      return false;
    } finally {
      if (owner === visitorScope()) setStarting(false);
    }
  }

  return {thread, failed, starting, startNew, refresh: requestRefresh};
}

import {useCallback, useSyncExternalStore} from 'react';
import {visitorKey, visitorScope} from '../services/visitorScope';

const changed = 'uper:chat-input-changed';
const memoryDrafts = new Map<string,string>();

export function useChatInputDraft(conversationId?: string) {
  const owner = visitorScope();
  const key = owner && conversationId ? visitorKey('uper_chat_input:' + conversationId) : undefined;

  const subscribe = useCallback((notify: () => void) => {
    if (!key) return () => {};
    const onStorage = (event: StorageEvent) => {
      if (event.key === key || event.key === null) notify();
    };
    const onInput = (event: Event) => {
      if ((event as CustomEvent<string>).detail === key) notify();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener(changed, onInput);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(changed, onInput);
    };
  }, [key]);

  const value = useSyncExternalStore(subscribe, () => {
    if (!key || owner !== visitorScope()) return '';
    try { return localStorage.getItem(key) ?? ''; } catch { return memoryDrafts.get(key) ?? ''; }
  }, () => '');

  function setValue(next: string) {
    if (!key || owner !== visitorScope()) return;
    try {
      if (next) localStorage.setItem(key, next);
      else localStorage.removeItem(key);
    } catch {
      if (next) memoryDrafts.set(key,next);
      else memoryDrafts.delete(key);
    }
    window.dispatchEvent(new CustomEvent(changed, {detail:key}));
  }

  return {value,setValue};
}

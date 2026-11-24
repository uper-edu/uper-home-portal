import {useCallback, useSyncExternalStore} from 'react';
import {visitorKey, visitorScope} from '../services/visitorScope';

const changed = 'uper:chat-input-changed';
const memoryDrafts = new Map<string,string>();

function draftKey(owner:string, conversationId?:string) {
  return owner && conversationId && owner===visitorScope() ? visitorKey('uper_chat_input:' + conversationId) : undefined;
}

export function readChatInputDraft(owner:string, conversationId?:string) {
  const key=draftKey(owner,conversationId);
  if (!key) return '';
  const unsyncedDraft=memoryDrafts.get(key);
  if (unsyncedDraft !== undefined) return unsyncedDraft;
  try { return localStorage.getItem(key) ?? ''; } catch { return ''; }
}

export function writeChatInputDraft(owner:string, conversationId:string|undefined, next:string, expected?:string) {
  const key=draftKey(owner,conversationId);
  if (!key || (expected !== undefined && readChatInputDraft(owner,conversationId) !== expected)) return;
  try {
    if (next) localStorage.setItem(key,next);
    else localStorage.removeItem(key);
    memoryDrafts.delete(key);
  } catch {
    // Even when writes fail, storage reads can still return the old value.
    memoryDrafts.set(key,next);
  }
  window.dispatchEvent(new CustomEvent(changed,{detail:key}));
}

export function useChatInputDraft(conversationId?: string) {
  const owner = visitorScope();
  const key = draftKey(owner,conversationId);

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

  const value = useSyncExternalStore(subscribe, () => readChatInputDraft(owner,conversationId), () => '');
  return {value,setValue:(next:string)=>writeChatInputDraft(owner,conversationId,next)};
}

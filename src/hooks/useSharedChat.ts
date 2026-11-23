import {createBrowserUuid} from '../utils/browserUuid';
import {useCallback, useEffect, useRef, useState} from 'react';
import {restoreCurrentChat, sameChatSnapshot, type ChatSource} from '../services/portalChat';
import {visitorScope} from '../services/visitorScope';
import {promotionParameters} from '../utils/promotionNavigation';

const key = (owner: string) => 'uper_chat_changed:' + owner;
const isOffline = () => navigator.onLine === false;
const pendingReplyDelays = [2000, 4000, 8000, 15000, 30000, 60000, 60000];
type RestoredChat = Awaited<ReturnType<typeof restoreCurrentChat>>;
type RefreshMode = 'interactive' | 'manual' | 'background' | 'background-retry' | 'reply';

function transientRestoreFailure(error:unknown) {
  const status = (error as {status?:number} | null)?.status;
  // A truncated JSON response can surface as a parse error even with HTTP 200.
  return error instanceof SyntaxError || error instanceof TypeError || (error instanceof DOMException && error.name === 'TimeoutError') ||
    status === 408 || (status !== undefined && status >= 500);
}

function pendingReplyId(thread: RestoredChat | undefined) {
  if (!thread) return;
  for (let index=thread.messages.length-1; index>=0; index--) {
    const row=thread.messages[index];
    if (row.role==='assistant' && row.status==='generating') return row.id;
  }
}

export function announceChatChange(owner: string) {
  if (!owner || visitorScope() !== owner) return;
  try { localStorage.setItem(key(owner), createBrowserUuid()); } catch {}
}

function chatLanding(owner: string) {
  const state = history.state;
  const previous = state?.uperChatVisitor;
  if (previous === owner) return location.pathname + location.search;
  const url = new URL(location.href);
  if (previous) {
    for (const name of promotionParameters) url.searchParams.delete(name);
    url.searchParams.delete('entry_point');
  }
  history.replaceState({...state, uperChatVisitor: owner}, '', url);
  return url.pathname + url.search;
}

export function useSharedChat(source: ChatSource, paused: boolean, legacyThreadId?: string) {
  const [thread, setThread] = useState<RestoredChat>();
  const [failure,setFailure] = useState<'blocking'|'readback'>();
  const [starting, setStarting] = useState(false);
  const [checkingReply,setCheckingReply] = useState(false);
  const [{revision, mode}, refresh] = useState<{revision:number;mode:RefreshMode}>({revision:0, mode:'interactive'});
  const generation = useRef(0);
  const restoreQueue = useRef(Promise.resolve());
  const activeRestore = useRef<AbortController | undefined>(undefined);
  const manualRestore = useRef<AbortController | undefined>(undefined);
  const startInFlight = useRef(false);
  const completedStart = useRef<{owner:string; source:ChatSource; revision:number; legacyThreadId?:string} | undefined>(undefined);
  const priorRestore = useRef<RestoredChat | undefined>(undefined);
  const replyPoll = useRef<{id:string;attempts:number} | undefined>(undefined);
  const [exhaustedReply,setExhaustedReply] = useState<string>();
  const networkRevision = useRef(0);
  const deferredRefresh = useRef(false);
  const requestRefresh = useCallback(() => {
    if(manualRestore.current?.signal.aborted===false)return;
    activeRestore.current?.abort();
    refresh(value => ({revision:value.revision+1, mode:'manual'}));
  },[]);
  const refreshInBackground = useCallback(()=>{
    if(document.hidden || isOffline()){
      deferredRefresh.current=true;
      return;
    }
    deferredRefresh.current=false;
    refresh(value=>({revision:value.revision+1,mode:'background'}));
  },[]);

  useEffect(() => {
    const owner = visitorScope();
    const onStorage = (event: StorageEvent) => {
      if(event.key!==key(owner))return;
      // A cross-tab write makes the in-flight snapshot stale. Release the
      // reader before queueing a replacement on a slow connection.
      if(!document.hidden)activeRestore.current?.abort();
      refreshInBackground();
    };
    const onFocus = () => {
      if (!deferredRefresh.current && (startInFlight.current || activeRestore.current?.signal.aborted === false)) return;
      refreshInBackground();
    };
    const onVisible = () => { if (!document.hidden) onFocus(); };
    const onOnline = () => {
      networkRevision.current++;
      if (startInFlight.current) refreshInBackground();
      else onFocus();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refreshInBackground]);

  useEffect(() => () => activeRestore.current?.abort(), [source, paused, legacyThreadId]);

  useEffect(() => {
    if (starting) return;
    const owner = visitorScope();
    const completed = completedStart.current;
    completedStart.current = undefined;
    if (paused) return;
    const manual=mode==='manual';
    const interactive=manual||mode==='interactive';
    // A confirmed restart already read the new history. An intervening update still refreshes it.
    if (completed && completed.owner === owner && completed.source === source && completed.revision === revision &&
      completed.legacyThreadId === legacyThreadId) return;
    const ticket = ++generation.current;
    const isCurrent = () => ticket === generation.current && owner === visitorScope();
    let nextReadTimer: ReturnType<typeof setTimeout> | undefined;
    // Repeated focus/storage events keep only the latest pending refresh.
    restoreQueue.current = restoreQueue.current.then(async () => {
      if (!isCurrent()) return;
      if(isOffline()){
        deferredRefresh.current=true;
        if(!priorRestore.current)setFailure('blocking');
        else if(manual)setFailure(current=>current??'readback');
        return;
      }
      if(!interactive&&document.hidden){
        deferredRefresh.current=true;
        return;
      }
      const controller=new AbortController();
      activeRestore.current=controller;
      if(manual){
        manualRestore.current=controller;
        setCheckingReply(true);
      }
      const networkAtStart=networkRevision.current;
      try {
        const snapshot = await restoreCurrentChat(source, {legacyThreadId, page:chatLanding(owner),signal:controller.signal,priorRestore:priorRestore.current});
        if (!isCurrent()||controller.signal.aborted) return;
        priorRestore.current=snapshot;
        setThread(previous => sameChatSnapshot(previous,snapshot) ? previous : snapshot);
        setFailure(undefined);
      } catch (error) {
        if (!isCurrent()||controller.signal.aborted) return;
        // Reuse a successful in-flight read, but recover if it began before reconnection.
        if (networkAtStart!==networkRevision.current) {
          refresh(value=>({revision:value.revision+1,mode}));
          return;
        }
        const temporary=transientRestoreFailure(error);
        const keepRestoredChat=priorRestore.current && temporary;
        const firstRead=!priorRestore.current && interactive;
        if (temporary && (firstRead || mode==='background') && !document.hidden && !isOffline()) {
          nextReadTimer=setTimeout(()=>{
            if(isCurrent()&&!document.hidden&&!isOffline())
              refresh(value=>({revision:value.revision+1,mode:'background-retry'}));
            else if(isCurrent()&&firstRead)setFailure('blocking');
          },700);
          return;
        }
        if(mode!=='reply'){
          if(!keepRestoredChat)setFailure('blocking');
          else if(interactive)setFailure(current=>current??'readback');
        }else{
          // A failed lookup provides no new evidence about the original reply.
          // Keep the conversation visible and wait for a reconnect or explicit check.
          setFailure(current=>current??'readback');
          return;
        }
      } finally {
        if(activeRestore.current===controller)activeRestore.current=undefined;
        if(manualRestore.current===controller){
          manualRestore.current=undefined;
          setCheckingReply(false);
        }
      }
      if (!isCurrent() || controller.signal.aborted) return;
      const replyId=pendingReplyId(priorRestore.current);
      if (replyId === undefined) { replyPoll.current=undefined; setExhaustedReply(undefined); return; }
      const replyKey=`${priorRestore.current?.conversationId}:${replyId}`;
      if (replyPoll.current?.id!==replyKey) replyPoll.current={id:replyKey, attempts:0};
      else if(mode==='reply')replyPoll.current.attempts++;
      const poll=replyPoll.current;
      const delay=pendingReplyDelays[poll.attempts];
      if (delay===undefined) { setExhaustedReply(replyKey); return; }
      if (document.hidden) return;
      nextReadTimer=setTimeout(()=>{
        if (!isCurrent() || document.hidden) return;
        if(isOffline()){
          deferredRefresh.current=true;
          return;
        }
        refresh(value=>({revision:value.revision+1, mode:'reply'}));
      },delay);
    });
    return () => { generation.current++; clearTimeout(nextReadTimer); };
  }, [source, paused, starting, revision, mode, legacyThreadId]);

  async function startNew(previousConversationId: string) {
    if (!thread || startInFlight.current) return false;
    if (thread.conversationId !== previousConversationId) return true;
    const owner = visitorScope();
    startInFlight.current = true;
    generation.current++;
    activeRestore.current?.abort();
    setStarting(true);
    try {
      const snapshot = await restoreCurrentChat(source, {previous:previousConversationId, page:chatLanding(owner)});
      if (owner !== visitorScope()) return false;
      completedStart.current = {owner, source, revision, legacyThreadId};
      priorRestore.current=snapshot;
      setThread(snapshot);
      setFailure(undefined);
      announceChatChange(owner);
      return true;
    } catch {
      if (owner === visitorScope()) setFailure('blocking');
      return false;
    } finally {
      startInFlight.current = false;
      if (owner === visitorScope()) setStarting(false);
    }
  }

  const pendingReply=pendingReplyId(thread);
  const replyStalled=!!pendingReply&&exhaustedReply===`${thread?.conversationId}:${pendingReply}`;
  const stalledQuestion=replyStalled ? thread?.messages.find(row=>row.role==='user'&&`reply-${row.id}`===pendingReply) : undefined;
  return {thread, failed:failure==='blocking', readbackFailed:failure==='readback', starting, checkingReply,
    replyPending:!!pendingReply, replyStalled, stalledQuestion, startNew, refresh:requestRefresh, refreshInBackground};
}

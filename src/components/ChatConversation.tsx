import {lazy, memo, Suspense, useMemo, type ComponentProps, type ReactNode, type Ref} from 'react';
import {Send, UserRound} from 'lucide-react';
import {deliveryText, type Delivery} from '../services/chatDelivery';
import {reportClientFailure} from '../services/clientDiagnostics';
import {sharedEnrollmentComparison, type EnrollmentGuideAction} from '../utils/enrollmentGuidance';
import type {ChatOrigin,ChatSource} from '../services/portalChat';
import type {ChatMessageAnchor} from '../utils/chatJourneyNavigation';
import {useChatInputDraft} from '../hooks/useChatInputDraft';
import {plainChatParagraphs} from '../utils/chatPlainReply';

const copy=(lang:string,zh:string,en:string,id:string)=>lang.startsWith('zh')?zh:lang.startsWith('en')?en:id;

function PlainReply({content}:{content:string}) {
  return <div className="whitespace-pre-wrap">{content}</div>;
}

// Updates to the active turn should not reparse unchanged consultation history.
const ChatReplyMarkdown=memo(lazy(()=>import('./ChatReplyMarkdown').catch(error=>{
  reportClientFailure(error,'preload');
  return {default:PlainReply};
})));

const EnrollmentGuide=lazy(()=>import('./ChatEnrollmentGuide').then(module=>({default:module.ChatEnrollmentGuide})).catch(error=>{
  reportClientFailure(error,'preload');
  return {default:({language,action}:EnrollmentGuideProps)=>{
    const lang=action.replyLanguage??language;
    return <div className="text-sm">
      <p role="alert">{copy(lang,'暂时无法加载报名操作。','Enrollment actions could not load.','Aksi pendaftaran belum dapat dimuat.')}</p>
      <button type="button" className="chat-enrollment-next" onClick={()=>window.location.reload()}>
        {copy(lang,'刷新页面','Refresh page','Muat ulang halaman')}
      </button>
    </div>;
  }};
}));

type EnrollmentGuideProps=ComponentProps<typeof import('./ChatEnrollmentGuide').ChatEnrollmentGuide>;
function ChatEnrollmentGuide(props:EnrollmentGuideProps) {
  const lang=props.action.replyLanguage??props.language;
  const fallback=props.cards
    ? <div className="chat-class-loading" role="status">
        <span className="sr-only">{copy(lang,'正在加载班次…','Loading classes…','Memuat kelas…')}</span>
        {props.action.rows?.filter(row=>!props.action.linkOnlyClassIds?.includes(row.id)).map(row=>
          <div key={row.id} className="chat-class-placeholder" aria-hidden="true"/>)}
      </div>
    : <span role="status" className="text-sm">
        {copy(lang,'正在加载报名操作…','Loading enrollment actions…','Memuat aksi pendaftaran…')}
      </span>;
  return <Suspense fallback={fallback}><EnrollmentGuide {...props}/></Suspense>;
}

export function ChatFollowups({prompts, onSelect}: {prompts?: string[]; onSelect: (prompt: string) => void}) {
  if (!prompts?.length) return null;
  return <div data-chat-followups className="chat-followups">
    {prompts.map(prompt => <button key={prompt} type="button" onClick={() => onSelect(prompt)}
      className="chat-followup">
      {prompt}
    </button>)}
  </div>;
}

export function ChatMessage({role,content,language,entry,origin,anchor,enrollment,delivery,compact=false,active=true,busy,onRetry,onCheckReply,checkingReply,entryAction,children}:{
  role:'user'|'assistant';content:string;language:string;entry:ChatSource;enrollment?:EnrollmentGuideAction;
  origin?:ChatOrigin;anchor?:ChatMessageAnchor;delivery?:Delivery;compact?:boolean;active?:boolean;busy?:boolean;onRetry?:()=>void;onCheckReply?:()=>void;checkingReply?:boolean;entryAction?:ReactNode;children?:ReactNode;
}){
  const user=role==='user';
  const paragraphs=useMemo(()=>user?undefined:plainChatParagraphs(content),[user,content]);
  const originSource=origin?.source, originPage=origin?.page;
  const {owner,conversationId,messageId,widget}=anchor??{};
  // The workspace rebuilds these wrappers on every streamed update. Reuse the
  // historical links and cards unless their content or navigation inputs change.
  const attachments=useMemo(()=>{
    if(!enrollment)return;
    const rows=enrollment.rows;
    const comparison=enrollment.sharedComparison?sharedEnrollmentComparison(enrollment):undefined;
    const origin=originSource?{source:originSource,page:originPage}:undefined;
    const anchor=owner!==undefined&&conversationId!==undefined&&messageId!==undefined&&widget!==undefined
      ? {owner,conversationId,messageId,widget} : undefined;
    const shared={action:enrollment,language,entry,origin,anchor};
    const embeddedGuide=(!rows?.length||comparison||rows.some(row=>enrollment.linkOnlyClassIds?.includes(row.id)))&&
      <ChatEnrollmentGuide {...shared} comparison={comparison}/>;
    const cards=!comparison&&rows?.some(row=>!enrollment.linkOnlyClassIds?.includes(row.id))&&
      <ChatEnrollmentGuide {...shared} cards active={active}/>;
    return {embeddedGuide,cards,wide:comparison?'comparison':cards?'cards':undefined};
  },[enrollment,language,entry,originSource,originPage,owner,conversationId,messageId,widget,active]);
  const {embeddedGuide,cards}=attachments??{};
  if(!content&&!children&&!enrollment&&!entryAction)return null;
  return <div data-chat-message={role} data-chat-attachment-layout={attachments?.wide} className={`flex flex-col ${user?'items-end':'items-start'}`}>
    {user&&delivery&&delivery!=='saved'&&<div role="status" className="mb-1 flex flex-wrap items-center justify-end gap-2 text-xs text-slate-600">
      <span>{deliveryText(delivery,language)}</span>
      {delivery==='unknown'&&onCheckReply&&<button type="button" className="min-h-8 rounded px-1 font-semibold text-primary-800 underline underline-offset-2 disabled:opacity-50" disabled={busy||checkingReply} onClick={onCheckReply}>
        {checkingReply?copy(language,'正在查询…','Checking…','Memeriksa…'):copy(language,'查询回复','Check for reply','Periksa balasan')}
      </button>}
      {delivery!=='pending'&&onRetry&&<button type="button" className="min-h-8 rounded px-1 font-semibold text-primary-800 underline underline-offset-2 disabled:opacity-50" disabled={busy} onClick={onRetry}>
        {copy(language,'重试','Retry','Coba lagi')}
      </button>}
    </div>}
    <div className={`flex max-w-[96%] items-start gap-2 ${compact?'':'sm:max-w-[80%]'} ${user?'flex-row-reverse':''}`}>
      <div data-chat-avatar aria-hidden="true" className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border ${compact?'':'sm:size-8'} ${user?'border-primary-200 bg-primary-50 text-primary-700':'border-slate-200 bg-white'}`}>
        {user?<UserRound className="size-4"/>:<img src="/uper-logo-mark.svg" alt="" width="16" height="18" className="h-[18px] w-4 object-contain"/>}
      </div>
      <div data-chat-message-body className="grid min-w-0 justify-items-start">
        {(content||children||entryAction||embeddedGuide)&&<div data-chat-bubble className={`min-w-0 max-w-full rounded-2xl px-3 py-2 text-sm leading-relaxed [overflow-wrap:anywhere] ${compact?'':'sm:px-4'} ${user?'rounded-tr-sm bg-primary-600 text-white shadow-sm':'chat-reply-bubble'}`}>
          {children??(user?<span className="whitespace-pre-wrap">{content}</span>:
            content&&<div className="chat-reply-text prose prose-sm max-w-none text-inherit prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-a:text-primary-800 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
              {paragraphs ? paragraphs.map((paragraph,index)=><p key={index}>{paragraph}</p>) : <Suspense fallback={<div className="chat-text-loading" role="status">
                <span className="sr-only">{copy(language,'正在加载回复…','Loading reply…','Memuat balasan…')}</span>
              </div>}>
                <ChatReplyMarkdown content={content}/>
              </Suspense>}
            </div>)}
          {(entryAction||embeddedGuide)&&<div className="chat-reply-actions">
            {entryAction}
            {embeddedGuide&&<div data-chat-enrollment>{embeddedGuide}</div>}
          </div>}
        </div>}
        {cards&&<div data-chat-enrollment className="w-full min-w-0">{cards}</div>}
      </div>
    </div>
  </div>;
}

export function ChatTyping({language,label}:{language:string;label?:string}){
  return <div data-chat-typing role="status" className="flex items-center gap-2 pl-9 text-xs text-slate-600">
    <span aria-hidden="true" className="flex gap-1">
      {[0,1,2].map(dot=><span key={dot} style={{animationDelay:`${dot*150}ms`}} className="size-1.5 rounded-full bg-primary-600 motion-safe:animate-bounce"/>)}
    </span>
    {label??copy(language,'正在输入…','Typing…','Sedang mengetik…')}
  </div>;
}

export function ChatComposer({language,conversationId,onSend,busy,inputRef,compact=false,children,placeholder}:{
  language:string;conversationId:string;onSend:()=>void;busy:boolean;
  inputRef?:Ref<HTMLTextAreaElement>;compact?:boolean;children?:ReactNode;placeholder?:string;
}){
  const {value,setValue}=useChatInputDraft(conversationId);
  const canSend=!!value.trim()&&!busy;
  const label=placeholder??copy(language,'请输入课程、HSK或学习规划问题…','Ask about courses, HSK or study planning…','Tanyakan tentang kursus, HSK atau rencana belajar…');
  return <div data-chat-composer className={`shrink-0 border-t border-slate-200 bg-white ${compact?'p-3':'p-3 sm:p-4'}`}>
    <div className="mx-auto max-w-4xl">
      {children}
      <form className="flex items-end gap-2" onSubmit={event=>{event.preventDefault();if(canSend)onSend();}}>
        <textarea ref={inputRef} rows={1} value={value} placeholder={label} aria-label={label}
          onChange={event=>setValue(event.target.value)}
          onKeyDown={event=>{
            if(event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing&&event.nativeEvent.keyCode!==229){
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          className="max-h-24 min-h-11 min-w-0 flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm leading-5 text-slate-900 focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600 [field-sizing:content]"/>
        <button type="submit" disabled={!canSend} aria-label={copy(language,'发送消息','Send message','Kirim pesan')}
          className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary-600 text-white hover:bg-primary-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-700 disabled:cursor-not-allowed disabled:opacity-50">
          <Send aria-hidden="true" className="size-4"/>
        </button>
      </form>
    </div>
  </div>;
}

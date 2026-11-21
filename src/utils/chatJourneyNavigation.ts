import type {NavigateFunction} from 'react-router-dom';
import {normalizeEnrollmentChatSelection, type EnrollmentChatSelection} from './enrollmentChatJourney';
import type {MouseEvent} from 'react';

export type ChatMessageAnchor = {conversationId:string; messageId:string; owner:string; widget:boolean};
export type EnrollmentPosition = {scrollY:number; focus:'catalog'|'class'; expanded:string[]};
type ReturnEntry = {url:string; index:number};
export type EnrollmentConsultation = ReturnEntry & {selection:EnrollmentChatSelection; title?:string; position:EnrollmentPosition};
type ChatRecommendation = ReturnEntry & {anchor:ChatMessageAnchor};
export type ChatJourneyState = {
  enrollmentConsultation?:EnrollmentConsultation;
  enrollmentPosition?:EnrollmentPosition;
  chatRecommendation?:ChatRecommendation;
  chatMessageAnchor?:ChatMessageAnchor;
};

export function isPlainLinkClick(event: MouseEvent<HTMLAnchorElement>) {
  return !event.defaultPrevented && event.button===0 && !event.metaKey && !event.altKey && !event.ctrlKey && !event.shiftKey;
}

function historyPayload(): ChatJourneyState & Record<string, unknown> {
  return window.history.state?.usr ?? {};
}

function remember(extra: ChatJourneyState): ReturnEntry {
  const current = window.history.state;
  window.history.replaceState({...current,usr:{...historyPayload(),...extra}},'');
  return {url:location.pathname+location.search+location.hash,index:current?.idx??0};
}

export function rememberEnrollment(position: EnrollmentPosition, selection:EnrollmentChatSelection,title?:string): EnrollmentConsultation {
  return {...remember({enrollmentPosition:position}),position,selection,title};
}

export function rememberChat(anchor: ChatMessageAnchor): ChatRecommendation {
  return {...remember({chatMessageAnchor:anchor}),anchor};
}

// Only application-created history entries supply a return index; do not navigate to an arbitrary URL.
function validReturn(entry: ReturnEntry | undefined, enrollment:boolean) {
  return entry && typeof entry.url==='string' && /^\/(?![/\\])[^\\]*$/.test(entry.url) &&
    Number.isSafeInteger(entry.index) && entry.index>=0 &&
    (enrollment ? /^\/enrollment(?:\/[a-zA-Z0-9_-]+)?(?:[?#]|$)/.test(entry.url)
      : !/^\/(?:enrollment|system|cms|crm)(?:[/?#]|$)/i.test(entry.url));
}

function validPosition(position:EnrollmentPosition|undefined) {
  return position && Number.isFinite(position.scrollY) && position.scrollY>=0 &&
    (position.focus==='catalog'||position.focus==='class') && Array.isArray(position.expanded);
}

export function readEnrollmentPosition(state:ChatJourneyState|undefined) {
  return validPosition(state?.enrollmentPosition)?state?.enrollmentPosition:undefined;
}

export function readEnrollmentConsultation(state: ChatJourneyState | undefined) {
  const item=state?.enrollmentConsultation;
  if (!validReturn(item,true) || !validPosition(item?.position)) return;
  const selection=normalizeEnrollmentChatSelection(item?.selection);
  if (item && selection) return {...item,selection,title:typeof item.title==='string'?item.title:undefined};
}

export function readChatRecommendation(state: ChatJourneyState | undefined) {
  const item=state?.chatRecommendation;
  return validReturn(item,false)?item:undefined;
}

export function readChatMessageAnchor() {
  return historyPayload().chatMessageAnchor;
}

export function clearChatMessageAnchor() {
  const {chatMessageAnchor,...current}=historyPayload();
  if (chatMessageAnchor) window.history.replaceState({...window.history.state,usr:current},'');
}

export function returnAlongJourney(navigate:NavigateFunction, entry:ReturnEntry, fallbackState:ChatJourneyState) {
  const current=window.history.state?.idx;
  if (Number.isSafeInteger(current) && current>entry.index) {
    navigate(entry.index-current);
  } else {
    navigate(entry.url,{replace:true,state:fallbackState});
  }
}

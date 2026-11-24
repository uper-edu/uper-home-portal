import type {ComponentProps} from 'react';
import {useLayoutEffect} from 'react';
import {Link,useLocation,useNavigate} from 'react-router-dom';
import {isPlainLinkClick,readChatRecommendation} from '../utils/chatJourneyNavigation';

export const enrollmentOrderReturnParam='returnToOrder';

function readStepReturn(state:unknown) {
  const step=(state as {enrollmentStepReturn?:{focus?:unknown;scrollY?:unknown;orderId?:unknown}} | null)?.enrollmentStepReturn;
  if(typeof step?.focus==='string'&&typeof step.scrollY==='number'&&Number.isFinite(step.scrollY)&&step.scrollY>=0&&
    (step.orderId===null||typeof step.orderId==='string'))return {focus:step.focus,scrollY:step.scrollY,orderId:step.orderId};
}

export function useEnrollmentRecordReturn() {
  const record = useLocation().state?.enrollmentRecordReturn;
  if (typeof record?.focus === 'string' && Number.isFinite(record.scrollY) && record.scrollY >= 0) {
    return {focus:record.focus as string,scrollY:record.scrollY as number};
  }
}

export function useEnrollmentChatReturnState() {
  const chatRecommendation=readChatRecommendation(useLocation().state);
  return chatRecommendation?{chatRecommendation}:undefined;
}

export function useEnrollmentJourneyState() {
  const returnState=useEnrollmentChatReturnState();
  const enrollmentRecordReturn=useEnrollmentRecordReturn();
  const enrollmentStepReturn=readStepReturn(useLocation().state);
  return enrollmentRecordReturn||enrollmentStepReturn?{...returnState,enrollmentRecordReturn,enrollmentStepReturn}:returnState;
}

export function EnrollmentJourneyLink({state,recordEntry,stepEntry,onClick,to,...props}:ComponentProps<typeof Link>&{
  recordEntry?:string;stepEntry?:string;
}) {
  const location=useLocation();
  const returnState=useEnrollmentJourneyState();
  const navigate=useNavigate();
  const pathname=location.pathname.replace(/\/$/,'');
  const fromMine=pathname==='/enrollment/mine';
  const sourceQuery=new URLSearchParams(location.search);
  const orderId=sourceQuery.get('order');
  const restore=fromMine&&stepEntry?readStepReturn(location.state):undefined;
  useLayoutEffect(()=>{
    if(!restore||restore.focus!==stepEntry||restore.orderId!==orderId)return;
    const frame=requestAnimationFrame(()=>{
      const target=document.getElementById(restore.focus);
      if(!target)return;
      window.scrollTo({top:restore.scrollY,behavior:'instant'});
      target.focus({preventScroll:true});
    });
    return ()=>cancelAnimationFrame(frame);
  },[location.key,stepEntry,orderId,restore?.focus,restore?.orderId,restore?.scrollY]);
  let destination=to;
  const toHelp=typeof to==='string'&&to.startsWith('/enrollment/help/');
  const toPayment=typeof to==='string'&&to.startsWith('/enrollment/payment?');
  const fromPayment=pathname==='/enrollment/payment'&&toHelp;
  if(stepEntry&&typeof to==='string'&&(fromMine&&(toHelp||toPayment)||fromPayment)){
    const target=new URL(to,'https://enrollment.invalid');
    const query=new URLSearchParams(location.search);
    for(const key of ['apply','proof','view','target',enrollmentOrderReturnParam])query.delete(key);
    target.searchParams.forEach((value,key)=>query.set(key,value));
    if(orderId&&(fromMine||sourceQuery.get(enrollmentOrderReturnParam)==='1'||sourceQuery.get('proof')==='upload')){
      query.set(enrollmentOrderReturnParam,'1');
    }
    destination=target.pathname+'?'+query.toString();
  }
  return <Link {...props} to={destination} id={recordEntry??stepEntry??props.id} state={state??returnState} onClick={event=>{
    onClick?.(event);
    if((!recordEntry&&(!stepEntry||!fromMine))||event.defaultPrevented||!isPlainLinkClick(event))return;
    event.preventDefault();
    const position={scrollY:window.scrollY};
    navigate(destination,{state:recordEntry
      ? {...returnState,enrollmentRecordReturn:{focus:recordEntry,...position},enrollmentStepReturn:undefined}
      : {...returnState,enrollmentStepReturn:{focus:stepEntry,orderId,...position}}});
  }}/>;
}

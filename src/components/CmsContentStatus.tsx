import {useLayoutEffect,useSyncExternalStore} from 'react';
import {useTranslation} from 'react-i18next';
import {useLocation} from 'react-router-dom';

type ContentReads={path:string;failed:Set<string>;latest:Map<string,object>};
let current:ContentReads|undefined;
const eventName='cms-content-status';
const subscribe=(listener:()=>void)=>{
  window.addEventListener(eventName,listener);
  return ()=>window.removeEventListener(eventName,listener);
};

export function beginContentRead(key:string) {
  const path=window.location.pathname;
  if(current?.path!==path)current={path,failed:new Set(),latest:new Map()};
  const reads=current;
  const request={};
  reads.latest.set(key,request);
  return (failed:boolean)=>{
    if(current!==reads||window.location.pathname!==path||reads.latest.get(key)!==request)return;
    reads.latest.delete(key);
    const wasUnavailable=reads.failed.size>0;
    if(failed)reads.failed.add(key);
    else reads.failed.delete(key);
    if(wasUnavailable!==(reads.failed.size>0))window.dispatchEvent(new Event(eventName));
  };
}
export default function CmsContentStatus(){
 const {pathname}=useLocation();const {i18n}=useTranslation();
 const unavailable=useSyncExternalStore(subscribe,()=>current?.path===pathname&&current.failed.size>0,()=>false);
 useLayoutEffect(()=>{if(current?.path!==pathname)current=undefined;},[pathname]);
 if(!unavailable)return null;
 const language=i18n.language.startsWith('zh')?'zh':i18n.language.startsWith('id')?'id':'en';
 const message={en:'Some website content is temporarily unavailable. Please reload to retry.',id:'Sebagian konten situs sementara tidak tersedia. Muat ulang untuk mencoba lagi.',zh:'部分网站内容暂不可用，请重新加载后重试。'}[language];
 return <div role="alert" className="fixed bottom-4 left-4 right-4 md:right-auto z-[70] max-w-lg rounded-xl border border-red-200 bg-red-50 text-red-900 p-4 shadow-lg"><p>{message}</p><button type="button" className="mt-2 font-semibold underline" onClick={()=>window.location.reload()}>{language==='zh'?'重新加载':language==='id'?'Muat ulang':'Reload'}</button></div>;
}

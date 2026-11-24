import {createBoundaryCheck} from '../services/visitorBoundaryCheck';
import React, {useEffect, useState, useRef} from 'react';
import {useTranslation} from 'react-i18next';
import {verifyVisitorSession, subscribeVisitorScope, visitorScope} from '../services/visitorScope';
import {getStudentContext, saveStudentContext} from '../services/studentProfileStorage';

/** Mount personal UI only after the cookie's identity is known. Rekey on person changes. */
export default function VisitorBoundary({children}: {children: React.ReactNode}) {
  const {i18n} = useTranslation();
  const lang = new URLSearchParams(location.search).get('lang') || i18n.language;
  const t = (zh:string,en:string,id:string) => lang.startsWith('zh')?zh:lang.startsWith('id')?id:en;
  const retry=useRef<()=>void>(()=>{});
  const privateContent=useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState('');
  const [failed, setFailed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [restoration,setRestoration]=useState(0);
  useEffect(() => {
    const controller=createBoundaryCheck(()=>verifyVisitorSession(true),visitorScope,s=>{
      setReady(s.ready);setFailed(s.failed);setChecking(s.checking);
    },s=>{if(s.profile&&!getStudentContext()?.leadProfile)saveStudentContext({leadProfile:s.profile as any});});
    let inPageCache=false;
    const check=()=>{if(!inPageCache)controller.check();};
    const reconnect=()=>{if(!inPageCache)controller.reconnect();};
    retry.current=check;
    const unsubscribe=subscribeVisitorScope(()=>{if(!inPageCache)controller.invalidate();});
    const visible = () => { if (!document.hidden) check(); };
    const capture = (event:PageTransitionEvent) => {
      if(!event.persisted)return;
      inPageCache=true;
      // Hide private content synchronously before the browser snapshots the page.
      if(privateContent.current)privateContent.current.hidden=true;
      controller.suspend();
    };
    const restore = (event:PageTransitionEvent) => {
      if(!event.persisted)return;
      inPageCache=false;
      setRestoration(value=>value+1);
      controller.invalidate();
    };
    window.addEventListener('focus', check);
    window.addEventListener('online', reconnect);
    window.addEventListener('pagehide',capture);
    window.addEventListener('pageshow',restore);
    document.addEventListener('visibilitychange', visible);
    check();
    return () => {
      controller.dispose(); unsubscribe();
      window.removeEventListener('focus', check);
      window.removeEventListener('online', reconnect);
      window.removeEventListener('pagehide',capture);
      window.removeEventListener('pageshow',restore);
      document.removeEventListener('visibilitychange', visible);
    };
  }, []);
  const notice = <div role="status" className="p-4 text-sm">
    {failed?t('访客资料暂不可用。未显示其他访客的信息。','Visitor information is unavailable. Other visitors’ information is hidden.','Informasi pengunjung tidak tersedia. Informasi pengunjung lain disembunyikan.'):t('正在确认访客身份…','Checking visitor identity…','Memeriksa identitas pengunjung…')}
    {failed && <button className="ml-3 underline" onClick={()=>retry.current()}>{t('重试','Retry','Coba lagi')}</button>}
  </div>;
  if (!ready || ready !== visitorScope()) return notice;
  return <React.Fragment key={ready+':'+restoration}>{(checking || failed) && notice}<div ref={privateContent} hidden={checking || failed}>{children}</div></React.Fragment>;
}

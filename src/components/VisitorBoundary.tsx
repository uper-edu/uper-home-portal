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
  const [ready, setReady] = useState('');
  const [failed, setFailed] = useState(false);
  const [checking, setChecking] = useState(true);
  useEffect(() => {
    const controller=createBoundaryCheck(()=>verifyVisitorSession(true),visitorScope,s=>{
      setReady(s.ready);setFailed(s.failed);setChecking(s.checking);
    },s=>{if(s.profile&&!getStudentContext()?.leadProfile)saveStudentContext({leadProfile:s.profile as any});});
    const check=()=>controller.check();
    retry.current=check;
    const unsubscribe=subscribeVisitorScope(()=>controller.invalidate());
    const visible = () => { if (!document.hidden) check(); };
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', visible);
    check();
    return () => { controller.dispose(); unsubscribe(); window.removeEventListener('focus',check); document.removeEventListener('visibilitychange',visible); };
  }, []);
  const notice = <div role="status" className="p-4 text-sm">
    {failed?t('访客资料暂不可用。未显示其他访客的信息。','Visitor information is unavailable. Other visitors’ information is hidden.','Informasi pengunjung tidak tersedia. Informasi pengunjung lain disembunyikan.'):t('正在确认访客身份…','Checking visitor identity…','Memeriksa identitas pengunjung…')}
    {failed && <button className="ml-3 underline" onClick={()=>retry.current()}>{t('重试','Retry','Coba lagi')}</button>}
  </div>;
  if (!ready || ready !== visitorScope()) return notice;
  return <React.Fragment key={ready}>{(checking || failed) && notice}<div hidden={checking || failed}>{children}</div></React.Fragment>;
}

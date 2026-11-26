import {useEffect,useRef,useState} from 'react';
import {enrollmentCopy,publicEnrollmentClass,type EnrollmentClassAdmin} from '../../utils/enrollmentCatalog';

export function EnrollmentLearnerPreview({row,language}:{
  row:EnrollmentClassAdmin;language:'zh'|'en'|'id';
}){
  const t=(zh:string,en:string,id:string)=>enrollmentCopy(language,[zh,en,id]);
  const frame=useRef<HTMLIFrameElement>(null);
  const [token]=useState(()=>crypto.randomUUID());
  const [view,setView]=useState<'detail'|'catalog'>('detail');
  const send=()=>frame.current?.contentWindow?.postMessage({
    type:'enrollment-preview-data',token,view,row:publicEnrollmentClass(row),
  },window.location.origin);
  useEffect(()=>{
    const ready=(event:MessageEvent)=>{
      if(event.origin===window.location.origin&&event.source===frame.current?.contentWindow&&
        event.data?.type==='enrollment-preview-ready'&&event.data.token===token) send();
    };
    window.addEventListener('message',ready);
    send();
    return ()=>window.removeEventListener('message',ready);
  },[row,view,token]);
  const title=t('390px 学员端预览','390px learner preview','Pratinjau siswa 390px');
  return <div className="crm-learner-preview">
    <div className="crm-class-config-filters" role="group" aria-label={title}>
      <button type="button" className="crm-work-button" aria-pressed={view==='detail'} onClick={()=>setView('detail')}>
        {t('班次详情','Class details','Detail kelas')}
      </button>
      <button type="button" className="crm-work-button" aria-pressed={view==='catalog'} onClick={()=>setView('catalog')}>
        {t('报名首页','Enrollment catalog','Katalog pendaftaran')}
      </button>
    </div>
    <iframe ref={frame} title={title} sandbox="allow-scripts allow-same-origin"
      src={'/enrollment?'+new URLSearchParams({lang:language,level:row.level.charAt(4),learnerPreview:token})} onLoad={send}/>
  </div>;
}

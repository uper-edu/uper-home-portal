import {Children,useEffect,useId,useRef,useState,type ReactNode} from 'react';
import {Copy,Ellipsis} from 'lucide-react';
import type {CrmLanguage} from '../../utils/crmLanguage';

export function AdminSecondaryActions({label,children,alwaysMenu=false}:{label:string;children:ReactNode;alwaysMenu?:boolean}){
  const actions=Children.toArray(children);
  const id=useId();
  const trigger=useRef<HTMLButtonElement>(null);
  if(!alwaysMenu&&actions.length<2)return <>{actions}</>;
  const showPosition=(panel:HTMLElement)=>{
    const button=trigger.current?.getBoundingClientRect();
    if(!button)return;
    const {width,height}=panel.getBoundingClientRect();
    const left=Math.max(8,Math.min(button.right-width,window.innerWidth-width-8));
    const top=button.bottom+6+height<=window.innerHeight-8?button.bottom+6:Math.max(8,button.top-height-6);
    Object.assign(panel.style,{left:left+'px',top:top+'px',bottom:'auto'});
  };
  return <>
    <button ref={trigger} type="button" className="admin-compact-action" aria-label={label} title={label} popoverTarget={id}>
      <Ellipsis size={18} aria-hidden="true"/>
    </button>
    <div id={id} popover="auto" role="group" aria-label={label} className="admin-secondary-actions"
      onToggle={event=>{if(event.currentTarget.matches(':popover-open'))showPosition(event.currentTarget);}}
      onClickCapture={event=>{
        const item=(event.target as Element).closest('button,a[href]');
        if(!item||item.matches(':disabled'))return;
        event.currentTarget.hidePopover();
        trigger.current?.focus({preventScroll:true});
      }}>
      {actions}
    </div>
  </>;
}

export function AdminCopyAction({label,value,lang}:{label:string;value:string;lang:CrmLanguage}){
  const [feedback,setFeedback]=useState<{value:string;success:boolean}|null>(null);
  const pending=useRef(false);
  const notice=feedback?.value===value?feedback:null;
  useEffect(()=>{
    if(!feedback)return;
    const timer=window.setTimeout(()=>setFeedback(null),4800);
    return ()=>window.clearTimeout(timer);
  },[feedback]);
  const copy=async()=>{
    if(pending.current)return;
    pending.current=true;
    setFeedback(null);
    try{
      await navigator.clipboard.writeText(value);
      setFeedback({value,success:true});
    }catch{
      setFeedback({value,success:false});
    }finally{
      pending.current=false;
    }
  };
  const message=notice?.success
    ?lang==='zh'?'已复制。':lang==='id'?'Disalin.':'Copied.'
    :lang==='zh'?'未能复制，请选中文字手动复制。':lang==='id'?'Gagal menyalin. Pilih teks dan salin secara manual.':'Could not copy. Select the text and copy it manually.';
  return <span className="admin-copy-control">
    <button type="button" className="admin-compact-action" aria-label={label} title={label} disabled={!value} onClick={()=>void copy()}>
      <Copy size={16} aria-hidden="true"/>
    </button>
    <span role="status" className="admin-copy-status" data-state={notice?(notice.success?'copied':'failed'):undefined}>
      {notice?message:''}
    </span>
  </span>;
}

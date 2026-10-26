import {useCrmUiText} from './CrmUiLanguage';
import {AdminField} from '../AdminForm';
import {useState} from 'react';
export function CrmNameNote({lead,canEdit,onDirty,onSaved}:any){
 const ui=useCrmUiText();

 const[editing,setEditing]=useState(false),[text,setText]=useState(lead.nameNote||''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function save(){setBusy(true);setError('');try{const r=await fetch(`/api/crm/leads/${lead.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({nameNote:text,expectedNameNote:lead.nameNote||''})});const d=await r.json();if(!r.ok)throw Error(d.error||'保存失败');onSaved(d.lead);onDirty(false);setEditing(false);}catch(e){setError((e as Error).message+'；输入保留，结果不确定时先刷新资料核对。');}finally{setBusy(false);}}
 return <div>{editing?<div><AdminField>{ui("名字备注（内部使用，最多200字）")}<input maxLength={200} value={text} onChange={e=>{setText(e.target.value);onDirty(e.target.value!==(lead.nameNote||''));}}/></AdminField><p className="crm-simple-help">{ui("用于标注测试目的，不改变客户姓名；清空保存后隐藏。")}</p><button disabled={busy} onClick={()=>void save()}>{busy ? ui("正在保存…") : ui("保存名字备注")}</button><button disabled={busy} onClick={()=>{setText(lead.nameNote||'');setEditing(false);onDirty(false);}}>{ui("取消")}</button>{error&&<p role="alert">{error}</p>}</div>:<>{lead.nameNote?.trim()&&<p><strong>{ui("名字备注：")}</strong>{lead.nameNote}</p>}{canEdit&&<button className="crm-work-link" onClick={()=>setEditing(true)}>{lead.nameNote?.trim() ? ui("编辑名字备注") : ui("添加名字备注")}</button>}</>}</div>;
}

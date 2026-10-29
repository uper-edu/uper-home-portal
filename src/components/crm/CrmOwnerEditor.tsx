import {CrmFormSection,CrmFormSummary} from './CrmFormLayout';
import {AdminFormActions} from '../AdminFormLayout';
import {useRef,useState} from 'react';
import {CrmSingleSelect} from './CrmSingleSelect';
import {AdminField,AdminRequiredNote} from '../AdminForm';
import {useCrmUiText} from './CrmUiLanguage';
import {CrmSaveFeedback} from './CrmDetailWorkspace';
export function CrmOwnerEditor({lead,directory,lang,isLight,onDirty,onBusy,onSaved}:any){
 const ui=useCrmUiText(lang);
 const t=(zh:string,en:string,id:string)=>lang==='zh'?zh:lang==='id'?id:en;
 const [owner,setOwner]=useState(''),[reason,setReason]=useState(''),[state,setState]=useState(''),[error,setError]=useState('');
 const command=useRef<any>(null),busy=state==='saving',unknown=state==='unknown';
 const name=(id:string)=>directory.find((e:any)=>e.id===id)?.displayName||id||t('未分配','Unassigned','Belum ditugaskan');
 const input=(next:string,why:string)=>{setOwner(next);setReason(why);setError('');command.current=null;onDirty(Boolean(next||why));};
 const saved=(receipt:any,profile?:any)=>{setState('saved');onDirty(false);onSaved(profile||{...lead,owner:receipt.after,ownerChangedAt:receipt.changedAt});};
 const save=async()=>{
  if(!owner||owner===lead.owner){setError(t('请选择不同的接收销售','Choose a different salesperson','Pilih staf penjualan lain'));return;}
  if(lead.owner&&!reason.trim()){setError(t('请填写交接说明','Enter a handover note','Isi catatan serah terima'));return;}
  const body=command.current||{owner,expectedOwner:lead.owner||null,expectedOwnerChangedAt:lead.ownerChangedAt||null,ownerChangeReason:reason,ownerChangeRequestId:crypto.randomUUID()};command.current=body;setState('saving');setError('');onBusy(true);
  try{const r=await fetch(`/api/crm/leads/${lead.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json();if(!r.ok){setState('failed');setError(d.error||String(r.status));command.current=null;return;}saved(d.receipt,d.lead);}catch{setState('unknown');setError(t('保存结果待核对，请先查询结果，勿重复提交。','Check the save result before submitting again.','Periksa hasil sebelum mengirim ulang.'));}finally{onBusy(false);}
 };
 const query=async()=>{if(!command.current)return;onBusy(true);try{const r=await fetch(`/api/crm/leads/${lead.id}/owner-result/${command.current.ownerChangeRequestId}`);const d=await r.json();if(r.ok)saved(d.receipt,d.lead);else{setError(d.error||String(r.status));if(r.status===404)setState('not_found');}}catch{setError(t('暂时无法核对，请稍后再查询。','Unable to check; try querying later.','Belum dapat diperiksa; coba lagi nanti.'));}finally{onBusy(false);}};
 return <div data-admin-form="" className="crm-editor-compose"><div className="crm-editor-scroll crm-owner-editor" data-admin-stack=""><AdminRequiredNote lang={lang}/>
 <CrmFormSummary><p>{t('当前负责人','Current owner','Penanggung jawab saat ini')}：{name(lead.owner)}</p></CrmFormSummary>
 <CrmFormSection name="owner" lang={lang}>
 <AdminField required>{t('接收销售','Receiving salesperson','Penerima')}<CrmSingleSelect required displayValue={owner?undefined:t('请选择接收销售','Choose a receiving salesperson','Pilih penerima')} label={t('接收销售','Receiving salesperson','Penerima')} value={owner} onChange={(v:string)=>input(v,reason)} options={directory.filter((e:any)=>e.id!==lead.owner).map((e:any)=>({value:e.id,label:name(e.id)}))} searchable lang={lang} isLight={isLight} disabled={busy||unknown}/></AdminField>
 <AdminField required={Boolean(lead.owner)}>{t(lead.owner?'交接说明':'分配说明',lead.owner?'Handover note':'Assignment note',lead.owner?'Catatan serah terima':'Catatan penugasan')}<textarea aria-label={t(lead.owner?'交接说明':'分配说明',lead.owner?'Handover note':'Assignment note',lead.owner?'Catatan serah terima':'Catatan penugasan')} aria-required={Boolean(lead.owner)} maxLength={2000} value={reason} disabled={busy||unknown} onChange={e=>input(owner,e.target.value)}/></AdminField>
 {owner&&<p>{name(lead.owner)} → {name(owner)}</p>}
 </CrmFormSection>
 {error&&<CrmSaveFeedback lang={lang} state={unknown?'unknown':'error'}>{ui(error)}</CrmSaveFeedback>}{state==='saved'&&<CrmSaveFeedback lang={lang} state="saved"/>}
 </div><AdminFormActions className="crm-editor-actions">{unknown?<button type="button" className="crm-work-button" onClick={query}>{t('查询保存结果','Check save result','Periksa hasil simpan')}</button>:<button type="button" className="crm-work-button" data-primary disabled={busy||!owner||Boolean(lead.owner&&!reason.trim())} onClick={save}>{t(lead.owner?'确认转交':'确认分配',lead.owner?'Confirm transfer':'Confirm assignment',lead.owner?'Konfirmasi transfer':'Konfirmasi penugasan')}</button>}</AdminFormActions></div>;
}

import {trackEvent,trackReceipt} from '../../utils/analytics';
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
 const command=useRef<any>(null),checking=state==='checking',busy=state==='saving'||checking,unknown=state==='unknown'||checking;
 const name=(id:string)=>directory.find((e:any)=>e.id===id)?.displayName||id||t('未分配','Unassigned','Belum ditugaskan');
 const input=(next:string,why:string)=>{setOwner(next);setReason(why);setState('');setError('');command.current=null;onDirty(Boolean(next||why));};
 const saved=(receipt:any,profile?:any)=>{if(receipt?.requestId===command.current?.ownerChangeRequestId&&profile?.id===lead.id&&receipt.after===profile.owner)trackReceipt('crm_owner_changed',receipt.requestId,{operation:'owner'});setState('saved');onDirty(false);onSaved(profile||{...lead,owner:receipt.after,ownerChangedAt:receipt.changedAt});};
 const save=async()=>{
  if(busy||unknown)return;
  if(!owner||owner===lead.owner){setError(t('请选择不同的接收销售','Choose a different salesperson','Pilih staf penjualan lain'));return;}
  if(lead.owner&&!reason.trim()){setError(t('请填写交接说明','Enter a handover note','Isi catatan serah terima'));return;}
  const originalRetry=state==='not_found'?command.current:null;
  const body=command.current||{owner,expectedOwner:lead.owner||null,expectedOwnerChangedAt:lead.ownerChangedAt||null,ownerChangeReason:reason,ownerChangeRequestId:crypto.randomUUID()};command.current=body;trackEvent('crm_save_result',{operation:'owner',status:'attempt'});setState('saving');setError('');onBusy(true);
  const unconfirmed=()=>{
    trackEvent('crm_save_result',{operation:'owner',status:'unknown'});setState('unknown');
    setError(t('保存结果待核对，请先查询结果，勿重复提交。','Check the save result before submitting again.','Periksa hasil sebelum mengirim ulang.'));
  };
  try{
    const r=await fetch(`/api/crm/leads/${lead.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    if(r.status>=500){unconfirmed();return;}
    const d=await r.json();
    if(!r.ok){
      trackEvent('crm_save_result',{operation:'owner',status:r.status===409?'conflict':'failed'});
      if(body===originalRetry){unconfirmed();return;}
      setState('failed');setError(d.error||String(r.status));command.current=null;return;
    }
    if(d.receipt?.requestId!==body.ownerChangeRequestId||d.lead?.id!==lead.id){unconfirmed();return;}
    saved(d.receipt,d.lead);
  }catch{unconfirmed();}finally{onBusy(false);}
 };
 const query=async()=>{
  if(!command.current||busy)return;
  setState('checking');onBusy(true);
  try{
    const requestId=command.current.ownerChangeRequestId;
    const r=await fetch(`/api/crm/leads/${lead.id}/owner-result/${requestId}`,{cache:'no-store'});
    if(r.status===404){
      setState('not_found');
      setError(t('暂未查到原操作，输入已保留。可继续查询或重试原请求。','No result yet. Your input is retained. Check again or retry the original request.','Hasil belum ditemukan. Isian tersimpan. Periksa lagi atau ulangi permintaan awal.'));
      return;
    }
    if(!r.ok)throw Error();
    const d=await r.json();
    if(d.receipt?.requestId!==requestId||d.lead?.id!==lead.id)throw Error();
    saved(d.receipt,d.lead);
  }catch{
    setState('unknown');
    setError(t('暂时无法核对，请稍后再查询。','Unable to check; try querying later.','Belum dapat diperiksa. Coba lagi nanti.'));
  }finally{onBusy(false);}
 };
 return <div data-admin-form="" className="crm-editor-compose"><div className="crm-editor-scroll crm-owner-editor" data-admin-stack=""><AdminRequiredNote lang={lang}/>
 <CrmFormSummary><p>{t('当前负责人','Current owner','Penanggung jawab saat ini')}：{name(lead.owner)}</p></CrmFormSummary>
 <CrmFormSection name="owner" lang={lang}>
 <AdminField required>{t('接收销售','Receiving salesperson','Penerima')}<CrmSingleSelect required displayValue={owner?undefined:t('请选择接收销售','Choose a receiving salesperson','Pilih penerima')} label={t('接收销售','Receiving salesperson','Penerima')} value={owner} onChange={(v:string)=>input(v,reason)} options={directory.filter((e:any)=>e.id!==lead.owner).map((e:any)=>({value:e.id,label:name(e.id)}))} searchable lang={lang} isLight={isLight} disabled={busy||unknown||state==='not_found'}/></AdminField>
 <AdminField required={Boolean(lead.owner)}>{t(lead.owner?'交接说明':'分配说明',lead.owner?'Handover note':'Assignment note',lead.owner?'Catatan serah terima':'Catatan penugasan')}<textarea aria-label={t(lead.owner?'交接说明':'分配说明',lead.owner?'Handover note':'Assignment note',lead.owner?'Catatan serah terima':'Catatan penugasan')} aria-required={Boolean(lead.owner)} maxLength={2000} value={reason} disabled={busy||unknown||state==='not_found'} onChange={e=>input(owner,e.target.value)}/></AdminField>
 {owner&&<p>{name(lead.owner)} → {name(owner)}</p>}
 </CrmFormSection>
 {error&&<CrmSaveFeedback lang={lang} state={unknown||state==='not_found'?'unknown':'error'}>{ui(error)}</CrmSaveFeedback>}{state==='saved'&&<CrmSaveFeedback lang={lang} state="saved"/>}
 </div><AdminFormActions className="crm-editor-actions">{(unknown||state==='not_found')&&<button type="button" className="crm-work-button" disabled={checking} onClick={query}>{t('查询保存结果','Check save result','Periksa hasil simpan')}</button>}{!unknown&&<button type="button" className="crm-work-button" data-primary disabled={busy||!owner||Boolean(lead.owner&&!reason.trim())} onClick={save}>{state==='not_found'?t('重试原请求','Retry original request','Ulangi permintaan awal'):t(lead.owner?'确认更换':'确认分配',lead.owner?'Confirm owner change':'Confirm assignment',lead.owner?'Konfirmasi perubahan penanggung jawab':'Konfirmasi penugasan')}</button>}</AdminFormActions></div>;
}

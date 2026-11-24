import {useEffect,useState} from 'react';
import {AdminField} from '../AdminForm';
import {AdminFormFeedback} from '../AdminFormLayout';
import {AdminEditor} from '../admin/AdminEditor';
import {AdminListState} from '../admin/AdminList';
import {AdminRowAction} from '../admin/AdminListControl';
import {AdminSingleSelect} from '../admin/AdminSingleSelect';
import {CrmOpportunitySourcePicker} from './CrmOpportunitySources';
import type {OpportunitySourceRef} from '../../utils/crmOpportunitySources';
import {opportunityFilterDefaults,opportunityListPath} from '../../utils/crmEnrollmentOpportunityRoute';
import {enrollmentOpportunityLevels} from '../../utils/enrollmentCatalog';
import {purchaseIntentSourceRefs,type PurchaseIntentSuggestion} from '../../utils/crmPurchaseIntentSuggestion';
import type {CrmLanguage} from '../../utils/crmLanguage';

export type PurchaseIntentResult={created:boolean;level:string};
type Preview={level:string;ids:string[]}|{level:string;failure:'error'|'denied'};
export function CrmOpenEnrollmentOpportunity({customer,lang,isLight,onBusy,onDirty,onClose,onSaved,onNavigate,suggestion}:{
  customer:{id:string;fullName:string};lang:CrmLanguage;isLight:boolean;suggestion?:PurchaseIntentSuggestion;
  onBusy:(busy:boolean)=>void;onDirty:(dirty:boolean)=>void;onClose:()=>void;
  onSaved:(result:PurchaseIntentResult)=>void;onNavigate:(href:string)=>void;
}) {
  const t=(zh:string,en:string,id:string)=>lang==='zh'?zh:lang==='id'?id:en;
  const [level,setLevel]=useState(suggestion?.level??'');
  const [note,setNote]=useState(suggestion?.summary??'');
  const [sourceRefs,setSourceRefs]=useState<OpportunitySourceRef[]>(()=>suggestion?purchaseIntentSourceRefs(suggestion):[]);
  const [requestId]=useState(()=>crypto.randomUUID());
  const [busy,setBusy]=useState(false);
  const [unknown,setUnknown]=useState(false);
  const [error,setError]=useState('');
  const [preview,setPreview]=useState<Preview>();
  const [previewVersion,retryPreview]=useState(0);
  const title=t('登记购课意向','Record course purchase intent','Catat minat membeli kursus');
  const levelLabel=t('课程级别','Course level','Level kursus');
  const listUrl=opportunityListPath({...opportunityFilterDefaults,opportunityOwner:'all',opportunityLevel:level},customer.id);
  const base='/api/crm/leads/'+encodeURIComponent(customer.id);
  const current=preview?.level===level?preview:undefined;
  const candidates=current&&'ids' in current?current.ids:undefined;
  const previewState=current&&'failure' in current?current.failure:'loading';
  const ready=!!candidates&&candidates.length<=1;
  const savePreview=candidates?.length===0
    ?t('保存后将新建商机。','Saving creates a new opportunity.','Penyimpanan membuat peluang baru.')
    :candidates?.length===1
      ?t(`保存后将记入已有的 ${level} 商机。`,`Saving adds this intent to the existing ${level} opportunity.`,`Minat ini akan dicatat pada peluang ${level} yang sudah ada.`)
      :null;
  useEffect(()=>onDirty(Boolean(level||note.trim()||sourceRefs.length||unknown)),[level,note,sourceRefs,unknown,onDirty]);
  useEffect(()=>{
    if(!level)return;
    const controller=new AbortController();
    void fetch(base+'/enrollment-opportunities?'+new URLSearchParams({level}),{
      cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(15000)]),
    }).then(async response=>{
      if(controller.signal.aborted)return;
      if([401,403,404].includes(response.status)){setPreview({level,failure:'denied'});return;}
      if(!response.ok)throw Error();
      const data=await response.json();
      if(!Array.isArray(data.opportunities)||data.opportunities.some((row:unknown)=>!row||typeof (row as {id?:unknown}).id!=='string'))throw Error();
      if(!controller.signal.aborted)setPreview({level,ids:data.opportunities.map((row:{id:string})=>row.id)});
    }).catch(()=>{if(!controller.signal.aborted)setPreview({level,failure:'error'});});
    return ()=>controller.abort();
  },[base,level,previewVersion]);
  const refreshPreview=()=>{setPreview(undefined);retryPreview(value=>value+1);};
  async function save(check=false) {
    if(busy||(!check&&(!ready||!note.trim()||unknown)))return;
    setBusy(true);onBusy(true);setError('');
    try{
      const response=await fetch(check?base+'/operations/'+requestId:base+'/enrollment-opportunities',{
        ...(check?{cache:'no-store'}:{method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({requestId,level,note,sourceRefs,expectedOpportunityId:candidates?.[0]??null,purchaseIntentSuggestionId:suggestion?.id})}),
        signal:AbortSignal.timeout(20000),
      });
      if(response.status>=500)throw Error();
      if(check&&response.status===404){
        setUnknown(false);refreshPreview();
        setError(t('尚未查到保存记录，请核对后再次保存。','No saved record found. Review the outcome and save again.','Catatan belum ditemukan. Periksa hasil lalu simpan kembali.'));
        return;
      }
      const data=await response.json();
      if(!response.ok){
        const changed=data.error==='enrollment_opportunity_preview_changed'||data.error==='enrollment_opportunity_selection_required';
        if(changed)refreshPreview();
        setError(changed
          ?t('匹配的商机已变化。请核对最新结果，意向草稿已保留。','Matching opportunities changed. Review the latest result. Your draft is retained.','Peluang yang cocok berubah. Periksa hasil terbaru. Draf tetap tersimpan.')
          :data.error==='enrollment_purchase_intent_changed'
            ?t('意向依据已变化，请关掉表单后重新核对。','The evidence has changed. Close this form and review the latest conversation.','Bukti telah berubah. Tutup formulir ini dan tinjau percakapan terbaru.')
          :data.error==='enrollment_opportunity_source_not_found'
            ?t('选择的原文已不可用，请重新选择。','A selected original record is no longer available. Select a record again.','Catatan asli yang dipilih sudah tidak tersedia. Pilih catatan kembali.')
            :t('暂时无法保存，请核对权限和表单内容。','Could not save. Check access and form details.','Penyimpanan gagal. Periksa akses dan isi formulir.'));
        return;
      }
      if(data.leadId!==customer.id||data.operationKind!=='enrollment.opportunity.open'||typeof data.opportunityId!=='string'||typeof data.created!=='boolean')throw Error();
      onDirty(false);
      onSaved({created:data.created,level});
    }catch{setUnknown(true);}
    finally{setBusy(false);onBusy(false);}
  }

  return <AdminEditor variant="drawer" className="crm-enrollment-opportunity-editor" title={title}
    description={<>
      <div>{customer.fullName}</div>
      <div>
        {t('仅登记购课意向，席位和订单由报名流程处理。级别未定时，请先「记录进展」。',
          'This records purchase intent. Seats and orders are handled through enrollment. If the level is unclear, use Record progress first.',
          'Formulir ini mencatat minat membeli kursus. Kursi dan pesanan diproses melalui pendaftaran. Jika level belum jelas, gunakan Catat perkembangan terlebih dahulu.')}
        <div role="status">{savePreview&&<strong>{savePreview}</strong>}</div>
      </div>
    </>}
    lang={lang} light={isLight} required busy={busy} onClose={onClose}
    onSubmit={event=>{event.preventDefault();void save();}}
    footer={<>
      <button type="button" onClick={onClose} disabled={busy}>{t('取消','Cancel','Batal')}</button>
      {unknown?<button type="button" data-primary disabled={busy} onClick={()=>void save(true)}>{t('查询保存结果','Check save result','Periksa hasil simpan')}</button>:
        <button type="submit" data-primary disabled={busy||!ready||!note.trim()}>{busy?t('保存中…','Saving…','Menyimpan…'):t('保存意向','Save intent','Simpan minat')}</button>}
    </>}>
    <div data-admin-stack="">
      <AdminField required>{levelLabel}
        <AdminSingleSelect required label={levelLabel} lang={lang} isLight={isLight} value={level}
          emptyLabel={t('选择课程级别','Select a course level','Pilih level kursus')}
          onChange={value=>{setPreview(undefined);setLevel(value);setError('');}} disabled={busy||unknown}
          options={enrollmentOpportunityLevels.map(value=>({value,label:value}))}/>
      </AdminField>
      {level&&!candidates&&<AdminListState compact lang={lang} state={previewState} onRetry={refreshPreview}/>}
      {candidates&&candidates.length>1&&<div>
        <p role="status">{t('同一级别有多笔进行中的商机，请打开对应商机记录进展。',
          'Several opportunities are active at this level. Open the relevant opportunity to record progress.',
          'Ada beberapa peluang aktif pada level ini. Buka peluang yang sesuai untuk mencatat perkembangan.')}</p>
        <AdminRowAction href={listUrl} onClick={event=>{
          if(event.button!==0||event.metaKey||event.ctrlKey||event.altKey||event.shiftKey)return;
          event.preventDefault();onNavigate(listUrl);
        }}>{t('查看同级商机','View opportunities at this level','Lihat peluang pada level ini')}</AdminRowAction>
      </div>}
      <AdminField required>{t('客户表达的购课意向','Purchase intent expressed by the customer','Minat membeli yang disampaikan pelanggan')}
        <textarea className="admin-text-input" required maxLength={2000} rows={4} value={note} onChange={event=>setNote(event.currentTarget.value)} disabled={busy||unknown}/>
      </AdminField>
      <CrmOpportunitySourcePicker leadId={customer.id} lang={lang} disabled={busy||unknown} selected={sourceRefs}
        onChange={setSourceRefs} showSelectionHint={false}/>
      {error&&<AdminFormFeedback state="error" lang={lang}>{error}</AdminFormFeedback>}
      {unknown&&<AdminFormFeedback state="unknown" lang={lang}/>}
    </div>
  </AdminEditor>;
}

import {useEffect,useState} from 'react';
import {AdminForm,AdminField,AdminFieldLabel,AdminRequiredNote} from '../AdminForm';
import {AdminFormActions,AdminFormFeedback} from '../AdminFormLayout';
import {CrmOperationLayer} from './CrmOperationLayer';
import {CrmSingleSelect} from './CrmSingleSelect';
import {CrmOpportunitySourcePicker} from './CrmOpportunitySources';
import type {OpportunitySourceRef} from '../../utils/crmOpportunitySources';
import {enrollmentOpportunityLevels} from '../../utils/enrollmentCatalog';
import type {CrmLanguage} from '../../utils/crmLanguage';

type Receipt={opportunityId:string;created:boolean};
export function CrmOpenEnrollmentOpportunity({customer,lang,isLight,onBusy,onDirty,onClose,onSaved}:{
  customer:{id:string;fullName:string};lang:CrmLanguage;isLight:boolean;
  onBusy:(busy:boolean)=>void;onDirty:(dirty:boolean)=>void;onClose:()=>void;onSaved:()=>void;
}) {
  const t=(zh:string,en:string,id:string)=>lang==='zh'?zh:lang==='id'?id:en;
  const [level,setLevel]=useState('');
  const [note,setNote]=useState('');
  const [sourceRefs,setSourceRefs]=useState<OpportunitySourceRef[]>([]);
  const [requestId]=useState(()=>crypto.randomUUID());
  const [receipt,setReceipt]=useState<Receipt>();
  const [busy,setBusy]=useState(false);
  const [unknown,setUnknown]=useState(false);
  const [error,setError]=useState('');
  const title=t('登记购课意向','Record course purchase intent','Catat minat membeli kursus');
  const levelLabel=t('课程级别','Course level','Level kursus');
  const listUrl='/crm?'+new URLSearchParams({tab:'opportunities',customerId:customer.id,opportunityOwner:'all'});
  const base=`/api/crm/leads/${encodeURIComponent(customer.id)}`;
  useEffect(()=>onDirty(!receipt&&(Boolean(level||note.trim()||sourceRefs.length)||unknown)),[level,note,sourceRefs,receipt,unknown,onDirty]);

  async function save(check=false) {
    if(busy||(!check&&(!level||!note.trim()||unknown)))return;
    setBusy(true);onBusy(true);setError('');
    try{
      const response=await fetch(check?`${base}/operations/${requestId}`:`${base}/enrollment-opportunities`,{
        ...(check?{cache:'no-store'}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId,level,note,sourceRefs})}),
        signal:AbortSignal.timeout(20000),
      });
      if(response.status>=500)throw Error();
      if(check&&response.status===404){
        setUnknown(false);
        setError(t('尚未查到保存记录，可再次保存。','No saved record found. You can try saving again.','Catatan belum ditemukan. Anda dapat menyimpan kembali.'));
        return;
      }
      const data=await response.json();
      if(!response.ok){
        setError(data.error==='enrollment_opportunity_selection_required'
          ?t('同一级别有多笔进行中的商机。请打开对应商机记录进展。','There are several active opportunities at this level. Open the relevant one to record progress.','Ada beberapa peluang aktif pada level ini. Buka peluang yang sesuai untuk mencatat kemajuan.')
          :data.error==='enrollment_opportunity_source_not_found'
            ?t('选择的原文已不可用，请重新选择。','A selected original record is no longer available. Select a record again.','Catatan asli yang dipilih sudah tidak tersedia. Pilih catatan kembali.')
            :t('暂时无法保存，请核对权限和表单内容。','Could not save. Check access and form details.','Penyimpanan gagal. Periksa akses dan isi formulir.'));
        return;
      }
      if(data.leadId!==customer.id||data.operationKind!=='enrollment.opportunity.open'||typeof data.opportunityId!=='string'||typeof data.created!=='boolean')throw Error();
      setReceipt(data);setUnknown(false);onDirty(false);onSaved();
    }catch{setUnknown(true);}
    finally{setBusy(false);onBusy(false);}
  }

  return <CrmOperationLayer compose className="crm-enrollment-opportunity-editor" customerContext={false} title={title} context={customer.fullName} lang={lang} isLight={isLight} busy={busy} onClose={onClose}>
    {receipt?<div className="crm-simple-form">
      <AdminFormFeedback state="saved" lang={lang}>{receipt.created?t('已创建商机。','Opportunity created.','Peluang dibuat.'):t('已记入现有商机。','Recorded on the existing opportunity.','Dicatat pada peluang yang sudah ada.')}</AdminFormFeedback>
      <AdminFormActions><button type="button" className="crm-work-button" onClick={onClose}>{t('关闭','Close','Tutup')}</button>
        <a className="crm-work-button" data-primary="true" href={listUrl+'&'+new URLSearchParams({opportunity:receipt.opportunityId})}>{t('查看商机','View opportunity','Lihat peluang')}</a></AdminFormActions>
    </div>:<AdminForm className="crm-simple-form" lang={lang} onSubmit={event=>{event.preventDefault();void save();}}>
      <AdminRequiredNote lang={lang}/>
      <div className="crm-simple-select-field"><p><AdminFieldLabel required>{levelLabel}</AdminFieldLabel></p>
        <CrmSingleSelect required label={levelLabel} lang={lang} isLight={isLight} value={level} onChange={setLevel} disabled={busy||unknown}
          options={[{value:'',label:t('选择课程级别','Select course level','Pilih level kursus')},...enrollmentOpportunityLevels.map(value=>({value,label:value}))]}/>
      </div>
      <AdminField required>{t('客户表达的购课意向','Purchase intent expressed by the customer','Niat membeli kursus yang disampaikan pelanggan')}
        <textarea required maxLength={2000} rows={4} value={note} onChange={event=>setNote(event.currentTarget.value)} disabled={busy||unknown}/>
      </AdminField>
      <CrmOpportunitySourcePicker leadId={customer.id} lang={lang} disabled={busy||unknown} selected={sourceRefs} onChange={setSourceRefs}/>
      <p className="crm-simple-help">{t('同一学员和级别已有一笔进行中的商机时，将进展记入该商机。登记意向不会占席或生成订单。','If the learner has one active opportunity at this level, this adds progress to it. Recording intent does not reserve a seat or create an order.','Jika siswa memiliki satu peluang aktif pada level ini, perkembangan dicatat di sana. Pencatatan minat tidak menahan kursi atau membuat pesanan.')}</p>
      {error&&<AdminFormFeedback state="error" lang={lang}>{error}</AdminFormFeedback>}
      {unknown&&<AdminFormFeedback state="unknown" lang={lang}/>}
      <AdminFormActions><button type="button" className="crm-work-button" onClick={onClose} disabled={busy}>{t('取消','Cancel','Batal')}</button>
        {unknown?<button type="button" className="crm-work-button" data-primary="true" disabled={busy} onClick={()=>void save(true)}>{t('查询保存结果','Check save result','Periksa hasil simpan')}</button>:
          <button type="submit" className="crm-work-button" data-primary="true" disabled={busy}>{busy?t('保存中…','Saving…','Menyimpan…'):t('保存','Save','Simpan')}</button>}
      </AdminFormActions>
    </AdminForm>}
  </CrmOperationLayer>;
}

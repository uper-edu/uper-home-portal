import {useEffect,useRef,useState} from 'react';
import {AdminField,AdminForm,AdminRequiredNote} from '../AdminForm';
import {AdminFormActions} from '../AdminFormLayout';
import {AdminDiscardDialog} from '../admin/AdminDiscardDialog';
import {CrmOperationLayer} from './CrmOperationLayer';
import {CrmSaveFeedback} from './CrmDetailWorkspace';
import type {CrmLanguage} from '../../utils/crmLanguage';

type Copy=readonly [string,string,string];

export function CrmEnrollmentInsertion({cohort,lang,isLight,onClose,onSaved,onDirty}:{
  cohort:{id:string;label:string;price:number};lang:CrmLanguage;isLight:boolean;
  onClose:()=>void;onSaved:()=>void;onDirty:(dirty:boolean)=>void;
}){
  const t=([en,id,zh]:Copy)=>lang==='zh'?zh:lang==='id'?id:en;
  const [requestId]=useState(()=>crypto.randomUUID());
  const [busy,setBusy]=useState(false);
  const [pending,setPending]=useState(false);
  const [dirty,setDirty]=useState(false);
  const [discard,setDiscard]=useState(false);
  const [error,setError]=useState('');
  const [checkState,setCheckState]=useState<'missing'|'error'>();
  const inFlight=useRef(false);
  const endpoint='/api/crm/enrollment/classes/'+encodeURIComponent(cohort.id)+'/insertions';
  const checkMessage=checkState==='missing'
    ?t(['No result yet. Your draft is retained.','Hasil belum ditemukan. Draf disimpan.','尚无结果，草稿已保留。'])
    :checkState==='error'?t(['Could not check the result. Your draft is retained.','Hasil tidak dapat diperiksa. Draf disimpan.','暂时无法查询结果，草稿已保留。']):undefined;
  useEffect(()=>{onDirty(dirty||busy||pending);},[onDirty,dirty,busy,pending]);
  useEffect(()=>()=>onDirty(false),[onDirty]);
  const close=()=>{
    if(inFlight.current||pending)return;
    if(dirty)setDiscard(true);else onClose();
  };
  async function saveInsertion(form:FormData) {
    if(inFlight.current||pending) return;
    inFlight.current=true;setBusy(true);setError('');
    try{
      const response=await fetch(endpoint,{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({requestId:requestId,name:form.get('name'),email:form.get('email'),
          phone:form.get('phone'),price:Number(form.get('price')),confirmed:form.get('confirmed')==='on'}),
      });
      if(response.status>=500) throw Error();
      const result=await response.json();
      if(!response.ok){
        setError(result.error==='enrollment_class_full'
          ? t(['This class is full.','Kelas ini penuh.','本班已满。'])
          : result.error==='enrollment_already_has_seat'
            ? t(['This learner already has a seat.','Siswa ini sudah mendapat kursi.','该学员已在本班占有席位。'])
            : t(['Check learner details, tuition and class availability.','Periksa data siswa, biaya, dan ketersediaan kelas.','请核对学员信息、学费和班次状态。']));
        return;
      }
      if(result.classId!==cohort.id||!result.id) throw Error();
      onSaved();
    }catch{setCheckState(undefined);setPending(true);}
    finally{inFlight.current=false;setBusy(false);}
  }
  async function checkInsertion() {
    if(!pending||inFlight.current) return;
    inFlight.current=true;setBusy(true);
    try{
      const response=await fetch(endpoint+'/results/'+encodeURIComponent(requestId),{cache:'no-store'});
      if(response.status===404){setCheckState('missing');return;}
      if(!response.ok)throw Error();
      const result=await response.json();
      if(result.operationKind!=='enrollment.order.insert'||result.classId!==cohort.id||!result.id)throw Error();
      onSaved();
    }catch{setCheckState('error');}
    finally{inFlight.current=false;setBusy(false);}
  }
  return <><CrmOperationLayer compose title={<>{t(['Add learner','Tambah siswa ke kelas','插班'])}<AdminRequiredNote inline lang={lang}/></>}
      lang={lang} isLight={isLight} customerContext={false} busy={busy} onClose={close}>
      <AdminForm lang={lang} className="crm-editor-compose crm-course-editor" onChange={()=>setDirty(true)} onSubmit={event=>{
        event.preventDefault();void saveInsertion(new FormData(event.currentTarget));
      }}>
        <div className="crm-editor-scroll">
          <p>{cohort.label}</p>
          <p>{t(['Confirm tuition with the learner before reserving a seat. The payment deadline uses the enrollment rules in effect when you save.',
            'Konfirmasikan biaya dengan siswa sebelum memesan kursi. Batas pembayaran mengikuti aturan pendaftaran saat Anda menyimpan.',
            '分配席位前请先与学员确认应付金额。付款和提交凭证的截止时间按保存时生效的报名规则计算。'])}</p>
      {error&&<p role="alert">{error}</p>}
          {pending&&<CrmSaveFeedback state={busy?"saving":"unknown"} lang={lang}>{!busy&&checkMessage}</CrmSaveFeedback>}
          <AdminField required>{t(['Learner name','Nama siswa','学员姓名'])}<input name="name" required maxLength={120} disabled={busy||!!pending}/></AdminField>
          <AdminField required>{t(['Email','Email','电子邮箱'])}<input name="email" type="email" required maxLength={254} disabled={busy||!!pending}/></AdminField>
          <AdminField required>{t(['Phone with country code','Nomor telepon dengan kode negara','手机号（含国家区号）'])}
            <input name="phone" type="tel" required disabled={busy||!!pending}/></AdminField>
          <AdminField required>{t(['Agreed tuition (Rp)','Biaya yang disepakati (Rp)','已确认应付金额（Rp）'])}
            <input name="price" type="number" min="1" max="1000000000" step="1" required defaultValue={cohort.price} disabled={busy||!!pending}/></AdminField>
          <label className="admin-field admin-field--choice"><input type="checkbox" name="confirmed" required disabled={busy||!!pending}/>
            <span>{t(['The learner agreed to join at this amount','Siswa menyetujui pendaftaran dengan biaya ini','学员已确认加入并同意应付金额'])} *</span></label>
        </div>
        <AdminFormActions className="crm-editor-actions">
          {pending?<button type="button" className="crm-work-button" disabled={busy} onClick={()=>void checkInsertion().catch(()=>{})}>
            {t(['Check save result','Periksa hasil simpan','查询保存结果'])}</button>:<>
            <button type="button" className="crm-work-button" disabled={busy} onClick={close}>
              {t(['Cancel','Batal','取消'])}</button>
            <button type="submit" className="crm-work-button" data-primary disabled={busy}>{t(['Reserve seat','Pesan kursi','分配席位'])}</button>
          </>}
        </AdminFormActions>
      </AdminForm>
    </CrmOperationLayer>
    {discard&&<AdminDiscardDialog lang={lang} isLight={isLight} onKeep={()=>setDiscard(false)} onDiscard={onClose}/>}
  </>;
}

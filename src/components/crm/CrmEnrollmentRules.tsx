import {useEffect,useRef,useState} from 'react';
import {AdminField,AdminForm,AdminRequiredNote} from '../AdminForm';
import {CrmSaveFeedback} from './CrmDetailWorkspace';
import {adminText} from '../AdminHeader';
import type {CrmLanguage} from '../../utils/crmLanguage';

type EnrollmentRules={paymentHours:number;replyHours:number;revision:number};
type Feedback='saved'|'load-error'|'save-error'|'conflict';
const endpoint='/api/crm/enrollment/rules';
const fields=['paymentHours','replyHours'] as const;
const asDraft=(rules:EnrollmentRules)=>({paymentHours:String(rules.paymentHours),replyHours:String(rules.replyHours)});

export function CrmEnrollmentRules({lang,active,onDraftChange}:{lang:CrmLanguage;active:boolean;onDraftChange:(dirty:boolean)=>void}) {
  const t=(en:string,id:string,zh:string)=>adminText(lang,en,id,zh);
  const [saved,setSaved]=useState<EnrollmentRules>();
  const [draft,setDraft]=useState({paymentHours:'',replyHours:''});
  const [showSaved,setShowSaved]=useState(false);
  const [feedback,setFeedback]=useState<Feedback>();
  const [busy,setBusy]=useState(false);
  const [pending,setPending]=useState<string>();
  const inFlight=useRef(false);
  const dirty=!!saved&&fields.some(field=>draft[field]!==String(saved[field]));
  useEffect(()=>{onDraftChange(dirty||busy||!!pending);},[dirty,busy,pending,onDraftChange]);
  useEffect(()=>()=>onDraftChange(false),[onDraftChange]);

  async function load(keepDraft=false,signal?:AbortSignal) {
    try {
      const response=await fetch(endpoint,{cache:'no-store',signal});
      if(!response.ok) throw Error();
      const rules:EnrollmentRules=await response.json();
      setSaved(rules);
      if(!keepDraft) setDraft(asDraft(rules));
      setShowSaved(keepDraft);
      setFeedback(undefined);
    } catch {
      if(!signal?.aborted) setFeedback(keepDraft?'conflict':'load-error');
    }
  }
  useEffect(()=>{
    if(!active||saved) return;
    const controller=new AbortController();
    void load(false,controller.signal);
    return ()=>controller.abort();
  },[active,saved]);

  function confirm(rules:EnrollmentRules) {
    setSaved(rules);
    setDraft(asDraft(rules));
    setPending(undefined);
    setShowSaved(false);
    setFeedback('saved');
  }
  async function save() {
    if(!saved||!dirty||inFlight.current||pending||feedback==='conflict') return;
    const requestId=crypto.randomUUID();
    inFlight.current=true;
    setBusy(true);
    setFeedback(undefined);
    try {
      const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({requestId,revision:saved.revision,paymentHours:Number(draft.paymentHours),replyHours:Number(draft.replyHours)})});
      if(response.status===409) {setFeedback('conflict');return;}
      if(response.status>=500) throw Error();
      if(!response.ok) {setFeedback('save-error');return;}
      confirm((await response.json()).rules);
    } catch {
      setPending(requestId);
    } finally {
      setBusy(false);
      inFlight.current=false;
    }
  }
  async function checkResult() {
    if(!pending||inFlight.current) return;
    inFlight.current=true;
    setBusy(true);
    try {
      const response=await fetch(endpoint+'/results/'+encodeURIComponent(pending),{cache:'no-store'});
      if(response.status===404) {
        setPending(undefined);
        setFeedback('save-error');
      } else if(response.ok) confirm((await response.json()).rules);
    } catch {
      // Keep the request ID available for a later result check.
    } finally {
      setBusy(false);
      inFlight.current=false;
    }
  }

  return <AdminForm lang={lang} className="crm-form-layout crm-course-catalog" onSubmit={(event:React.FormEvent)=>{event.preventDefault();void save();}}>
    <header className="admin-edit-header">
      <div className="admin-edit-title"><h2>{t('Enrollment rules','Aturan pendaftaran','报名规则')}</h2>{saved&&<AdminRequiredNote inline lang={lang}/>}</div>
      {saved&&<div className="crm-ops-actions"><button type="submit" disabled={!dirty||busy||!!pending||feedback==='conflict'}>{t('Save','Simpan','保存')}</button></div>}
    </header>
    <p className="crm-ops-note">{t('These rules apply across all courses and classes. Saved deadlines stay as recorded.',
      'Aturan ini berlaku untuk semua kursus dan kelas. Tenggat yang sudah tercatat tetap berlaku。',
      '所有课程与班次共用这两项规则。已生成的截止时间按原记录执行。')}</p>
    {!saved&&feedback!=='load-error'&&<p role="status">{t('Loading…','Memuat…','正在加载…')}</p>}
    {feedback==='load-error'&&<p role="alert">{t('Could not load enrollment rules.','Aturan pendaftaran gagal dimuat.','无法读取报名规则。')} <button type="button" className="crm-work-link" onClick={()=>void load()}>{t('Retry','Coba lagi','重试')}</button></p>}
    {saved&&showSaved&&<p role="status">{t(
      `Saved rules · Payment ${saved.paymentHours} h · Transfer reply ${saved.replyHours} h`,
      `Aturan tersimpan · Pembayaran ${saved.paymentHours} jam · Jawaban pindah kelas ${saved.replyHours} jam`,
      `已保存规则 · 付款 ${saved.paymentHours} 小时 · 转班答复 ${saved.replyHours} 小时`)}</p>}
    {saved&&<>
      <AdminField required>{t('Payment deadline (hours)','Batas pembayaran (jam)','付款期限（小时）')}
        <input name="paymentHours" type="number" min="1" step="1" value={draft.paymentHours} disabled={busy||!!pending} onChange={e=>setDraft({...draft,paymentHours:e.target.value})}/>
        <small>{t('From the time a seat is reserved. Default 24 hours.','Sejak kursi diberikan. Standar 24 jam.','从获得席位起算，默认 24 小时。')}</small>
      </AdminField>
      <AdminField required>{t('Transfer reply deadline (hours)','Batas jawaban pindah kelas (jam)','转班邀请答复期限（小时）')}
        <input name="replyHours" type="number" min="1" step="1" value={draft.replyHours} disabled={busy||!!pending} onChange={e=>setDraft({...draft,replyHours:e.target.value})}/>
        <small>{t('From the time an invitation is issued. Default 48 hours, up to the target class’s enrollment deadline.',
          'Sejak undangan dibuat. Standar 48 jam, paling lambat sampai pendaftaran kelas tujuan ditutup.',
          '从发出邀请起算，默认 48 小时，最晚到目标班次的报名截止时间。')}</small>
      </AdminField>
    </>}
    {feedback==='conflict'&&<CrmSaveFeedback state="error" lang={lang}>{t('Another employee updated these rules. Review the saved time limits before applying your draft.','Aturan diperbarui oleh staf lain. Periksa tenggat tersimpan sebelum menyimpan draf.','其他员工已更新报名规则。请核对已保存的期限，再决定是否保存当前草稿。')} <button type="button" className="crm-work-link" onClick={()=>void load(true)}>{t('Review saved rules','Periksa aturan tersimpan','核对已保存规则')}</button></CrmSaveFeedback>}
    {saved&&dirty&&!busy&&!pending&&feedback!== 'conflict'&&<CrmSaveFeedback state={feedback==='save-error'?'error':'dirty'} lang={lang}/>}
    {busy&&<CrmSaveFeedback state="saving" lang={lang}/>}
    {pending&&!busy&&<CrmSaveFeedback state="unknown" lang={lang}>{t('Save outcome unknown.','Hasil penyimpanan belum diketahui.','暂未确认是否保存成功。')} <button type="button" className="crm-work-link" onClick={()=>void checkResult()}>{t('Check save result','Periksa hasil simpan','查询保存结果')}</button></CrmSaveFeedback>}
    {feedback==='saved'&&!dirty&&<CrmSaveFeedback state="saved" lang={lang}/>}
  </AdminForm>;
}

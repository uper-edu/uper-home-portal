import {AdminTopicHeader} from '../admin/AdminTopicHeader';
import {useEffect,useId,useRef,useState} from 'react';
import {Save} from 'lucide-react';
import {CrmPageAction} from './CrmPageAction';
import {AdminListState} from '../admin/AdminList';
import {AdminField,AdminForm,AdminRequiredNote} from '../AdminForm';
import {AdminFormSection} from '../AdminFormLayout';
import {CrmSaveFeedback} from './CrmDetailWorkspace';
import {CrmEnrollmentBank} from './CrmEnrollmentBank';
import type {CrmLanguage} from '../../utils/crmLanguage';
import {enrollmentBusinessDayLimit,enrollmentEmailRuleFields,enrollmentEmailRuleLimits,enrollmentRuleDefaults,enrollmentRuleFields,
  type EnrollmentRuleField,type EnrollmentRules} from '../../utils/enrollmentRules';

type Feedback='load-error'|'load-denied'|'save-error'|'conflict';
const endpoint='/api/crm/enrollment/rules';
const asDraft=(rules:typeof enrollmentRuleDefaults)=>Object.fromEntries(
  enrollmentRuleFields.map(key=>[key,String(rules[key])]),
) as Record<EnrollmentRuleField,string>;
const emailRuleLabels:Record<typeof enrollmentEmailRuleFields[number],readonly [string,string,string]>={
  emailCodeMinutes:['Code validity (minutes)','Masa berlaku kode (menit)','验证码有效期（分钟）'],
  emailResendSeconds:['Resend interval (seconds)','Jeda kirim ulang (detik)','重发间隔（秒）'],
  emailAttemptLimit:['Incorrect attempts before lockout','Jumlah kesalahan sebelum penguncian','暂停验证前允许的输错次数'],
  emailLockMinutes:['Lockout duration (minutes)','Durasi penguncian (menit)','暂停验证时长（分钟）'],
  emailSessionHours:['Verified session duration (hours)','Durasi sesi terverifikasi (jam)','邮箱验证会话时长（小时）'],
};

export function CrmEnrollmentRules({lang,isLight,active,onDraftChange}:{lang:CrmLanguage;isLight:boolean;active:boolean;onDraftChange:(dirty:boolean)=>void}) {
  const t=(en:string,id:string,zh:string)=>lang==='zh'?zh:lang==='id'?id:en;
  const fieldHelp=useId();
  const heading=useRef<HTMLHeadingElement>(null);
  const [saved,setSaved]=useState<EnrollmentRules>();
  const [draft,setDraft]=useState(()=>asDraft(enrollmentRuleDefaults));
  const [showSaved,setShowSaved]=useState(false);
  const [feedback,setFeedback]=useState<Feedback>();
  const [readAttempt,setReadAttempt]=useState(0);
  const [busy,setBusy]=useState(false);
  const [pending,setPending]=useState<string>();
  const [checkState,setCheckState]=useState<"missing"|"error">();
  const [bankDirty,setBankDirty]=useState(false);
  const inFlight=useRef(false);
  const dirty=!!saved&&enrollmentRuleFields.some(field=>draft[field]!==String(saved[field]));
  useEffect(()=>{onDraftChange(dirty||bankDirty||busy||!!pending);},[dirty,bankDirty,busy,pending,onDraftChange]);
  useEffect(()=>()=>onDraftChange(false),[onDraftChange]);

  async function load(keepDraft=false,signal?:AbortSignal) {
    try {
      const response=await fetch(endpoint,{cache:'no-store',signal});
      if(signal?.aborted)return;
      if(!keepDraft&&(response.status===401||response.status===403)){setFeedback('load-denied');return;}
      if(!response.ok) throw Error();
      const rules:EnrollmentRules=await response.json();
      if(signal?.aborted)return;
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
  },[active,saved,readAttempt]);

  function confirm(rules:EnrollmentRules) {
    setSaved(rules);
    setDraft(asDraft(rules));
    setPending(undefined);
    setShowSaved(false);
    setFeedback(undefined);
  }
  async function save() {
    if(!saved||!dirty||inFlight.current||pending||feedback==='conflict') return;
    const requestId=crypto.randomUUID();
    inFlight.current=true;
    setBusy(true);
    setFeedback(undefined);
    try {
      const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({requestId,revision:saved.revision,...Object.fromEntries(enrollmentRuleFields.map(key=>[key,Number(draft[key])]))})});
      if(response.status===409) {setFeedback('conflict');return;}
      if(response.status>=500) throw Error();
      if(!response.ok) {setFeedback('save-error');return;}
      confirm((await response.json()).rules);
    } catch {
      setCheckState(undefined);setPending(requestId);
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
        setCheckState('missing');
      }else{
        if(!response.ok)throw Error();
        confirm((await response.json()).rules);
      }
    }catch{
      setCheckState('error');
    } finally {
      setBusy(false);
      inFlight.current=false;
    }
  }

  const controlsDisabled=busy||!!pending;
  return <section className="crm-enrollment-rules" data-theme={isLight?'light':'dark'}>
    <AdminForm lang={lang}
    onSubmit={(event:React.FormEvent)=>{event.preventDefault();void save();}}>
    <AdminTopicHeader isLight={isLight} headingRef={heading}
      title={<>{t('Enrollment rules','Aturan pendaftaran','报名规则')}{saved&&<AdminRequiredNote inline lang={lang}/>}</>}
      subtitle={t('Set shared rules for payments, transfers, refunds and email verification. Existing deadlines stay in effect.',
        'Atur aturan umum untuk pembayaran, pindah kelas, pengembalian dana, dan verifikasi email. Tenggat yang sudah tercatat tetap berlaku.',
        '统一设置付款、转班、退款及邮箱验证规则。已生成的截止时间沿用原记录。')}
      actions={saved&&
        <CrmPageAction type="submit" icon={Save} variant="primary" label={t('Save','Simpan','保存')}
          disabled={!dirty||controlsDisabled||feedback==='conflict'}/>
      }/>
    <div className="crm-enrollment-rules-body" data-admin-stack>
      {!saved&&<AdminListState lang={lang}
        state={feedback==='load-error'?'error':feedback==='load-denied'?'denied':'loading'}
        message={feedback==='load-error'?t('Could not load enrollment rules.','Aturan pendaftaran gagal dimuat.','无法读取报名规则。'):undefined}
        onRetry={()=>{heading.current?.focus({preventScroll:true});setFeedback(undefined);setReadAttempt(value=>value+1);}}/>}
      {saved&&showSaved&&<div role="status">
        <strong>{t('Latest saved values','Nilai terakhir yang disimpan','最新已保存值')}</strong>
        <ul>
          <li>{t('Payment deadline (hours)','Batas pembayaran (jam)','付款期限（小时）')} · {saved.paymentHours}</li>
          <li>{t('Transfer reply deadline (hours)','Batas jawaban pindah kelas (jam)','转班邀请答复期限（小时）')} · {saved.replyHours}</li>
          <li>{t('First payment review (working days)','Pemeriksaan pembayaran pertama (hari kerja)','财务首轮核验期限（工作日）')} · {saved.firstReviewBusinessDays}</li>
          <li>{t('Send refunds within (working days)','Kirim pengembalian dalam (hari kerja)','退款发出期限（工作日）')} · {saved.refundBusinessDays}</li>
          {enrollmentEmailRuleFields.map(key=><li key={key}>{t(...emailRuleLabels[key])} · {saved[key]}</li>)}
        </ul>
      </div>}
      {saved&&<div className="crm-form-grid" data-admin-grid>
        <AdminField required>{t('Payment deadline (hours)','Batas pembayaran (jam)','付款期限（小时）')}
          <input name="paymentHours" aria-describedby={fieldHelp+'-payment'} type="number" min="1" step="1" value={draft.paymentHours} disabled={controlsDisabled} onChange={e=>setDraft({...draft,paymentHours:e.target.value})}/>
          <small id={fieldHelp+'-payment'}>{t('From the time a seat is reserved. Default 24 hours.','Sejak kursi diberikan. Standar 24 jam.','从获得席位起算，默认 24 小时。')}</small>
        </AdminField>
        <AdminField required>{t('Transfer reply deadline (hours)','Batas jawaban pindah kelas (jam)','转班邀请答复期限（小时）')}
          <input name="replyHours" aria-describedby={fieldHelp+'-reply'} type="number" min="1" step="1" value={draft.replyHours} disabled={controlsDisabled} onChange={e=>setDraft({...draft,replyHours:e.target.value})}/>
          <small id={fieldHelp+'-reply'}>{t('From the time the invitation is issued. Default 48 hours, up to the target class’s enrollment cutoff.',
            'Sejak undangan dibuat. Standar 48 jam, paling lambat saat pendaftaran kelas tujuan ditutup.',
            '从发出邀请起算，默认 48 小时，最晚到目标班次的报名截止时间。')}</small>
        </AdminField>
        <AdminField required>{t('First payment review (working days)','Pemeriksaan pembayaran pertama (hari kerja)','财务首轮核验期限（工作日）')}
          <input name="firstReviewBusinessDays" aria-describedby={fieldHelp+'-review'} type="number" min="1" max={enrollmentBusinessDayLimit} step="1"
            value={draft.firstReviewBusinessDays} disabled={controlsDisabled} onChange={e=>setDraft({...draft,firstReviewBusinessDays:e.target.value})}/>
          <small id={fieldHelp+'-review'}>{t('Default: end of the next working day after the first proof is received. Sales follows up when due.',
            'Standar: akhir hari kerja berikutnya setelah bukti pertama diterima. Tim penjualan menindaklanjuti saat jatuh tempo.',
            '收到首份凭证后，默认在下一个工作日结束前核验。到期由销售跟进。')}</small>
        </AdminField>
        <AdminField required>{t('Send refunds within (working days)','Kirim pengembalian dalam (hari kerja)','退款发出期限（工作日）')}
          <input name="refundBusinessDays" aria-describedby={fieldHelp+'-refund'} type="number" min="1" max={enrollmentBusinessDayLimit} step="1"
            value={draft.refundBusinessDays} disabled={controlsDisabled} onChange={e=>setDraft({...draft,refundBusinessDays:e.target.value})}/>
          <small id={fieldHelp+'-refund'}>{t('Counted from the next working day after the formal request. Default 3 working days.',
            'Dihitung mulai hari kerja berikutnya setelah permintaan resmi. Standar 3 hari kerja.',
            '从收到正式申请后的下一个工作日起算，默认 3 个工作日。')}</small>
        </AdminField>
      </div>}
      {saved&&<AdminFormSection variant="subgroup" title={t('Email verification','Verifikasi email','邮箱验证')}
        description={t('Changes apply when a code is issued, an attempt is checked, or a new session starts.',
          'Perubahan berlaku saat kode diterbitkan, percobaan diperiksa, atau sesi baru dimulai.',
          '新设置在发码、校验或建立新验证会话时生效。')} bodyClassName="crm-form-grid">
        {enrollmentEmailRuleFields.map(key=><AdminField key={key} required>{t(...emailRuleLabels[key])}
          <input name={key} aria-describedby={fieldHelp+'-'+key} type="number" min="1" max={enrollmentEmailRuleLimits[key]} step="1"
            value={draft[key]} disabled={controlsDisabled} onChange={event=>setDraft({...draft,[key]:event.target.value})}/>
          <small id={fieldHelp+'-'+key}>{t(`Default ${enrollmentRuleDefaults[key]} · range 1–${enrollmentEmailRuleLimits[key]}`,`Standar ${enrollmentRuleDefaults[key]} · rentang 1–${enrollmentEmailRuleLimits[key]}`,`默认 ${enrollmentRuleDefaults[key]}，可设为 1–${enrollmentEmailRuleLimits[key]}`)}</small>
        </AdminField>)}
      </AdminFormSection>}
      {feedback==='conflict'&&<CrmSaveFeedback state="error" lang={lang}>{t('Another employee updated these rules. Review the saved time limits before applying your draft.','Aturan diperbarui oleh staf lain. Periksa tenggat tersimpan sebelum menyimpan draf.','其他员工已更新报名规则。请核对已保存的期限，再决定是否保存当前草稿。')} <button type="button" className="crm-work-link" onClick={()=>void load(true)}>{t('Review saved rules','Periksa aturan tersimpan','核对已保存规则')}</button></CrmSaveFeedback>}
      {saved&&dirty&&!busy&&!pending&&feedback!== 'conflict'&&<CrmSaveFeedback state={feedback==='save-error'?'error':'dirty'} lang={lang}/>}
      {busy&&<CrmSaveFeedback state="saving" lang={lang}/>}
      {pending&&!busy&&<CrmSaveFeedback state="unknown" lang={lang}>{checkState==='missing'?t('No result yet. Your draft is retained.','Hasil belum ditemukan. Draf disimpan.','暂未查到这次操作的结果，草稿已保留。'):
        checkState==='error'?t('Unable to check the result. Your draft is retained.','Hasil belum dapat diperiksa. Draf disimpan.','暂时无法查询结果，草稿已保留。'):
        t('Save outcome unknown.','Hasil penyimpanan belum diketahui.','暂未确认是否保存成功。')} <button type="button" className="crm-work-link" onClick={()=>void checkResult()}>{t('Check save result','Periksa hasil simpan','查询保存结果')}</button></CrmSaveFeedback>}
    </div>
    </AdminForm>
    {saved&&<div className="crm-enrollment-rules-body">
      <CrmEnrollmentBank lang={lang} isLight={isLight} active={active} onDraftChange={setBankDirty}/>
    </div>}
  </section>;
}

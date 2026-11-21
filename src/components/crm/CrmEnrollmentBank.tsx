import {useEffect,useState} from 'react';
import {AdminField} from '../AdminForm';
import {AdminFormSection,AdminFormSummary} from '../AdminFormLayout';
import {CrmDiscardDialog,CrmSaveFeedback} from './CrmDetailWorkspace';
import {AdminEditor} from '../admin/AdminEditor';
import {enrollmentBankFields,type EnrollmentBank} from '../../utils/enrollmentBank';
import type {CrmLanguage} from '../../utils/crmLanguage';

type Settings={bank:EnrollmentBank;revision:number};
type Draft={bank:EnrollmentBank;revision:number};
type Copy=readonly [string,string,string];
const path='/api/crm/enrollment/bank';
const labels:Record<keyof EnrollmentBank,Copy>={
  name:['银行','Bank','Bank'],
  accountName:['收款户名','Account holder','Nama pemilik rekening'],
  accountNumber:['账号','Account number','Nomor rekening'],
};
const fields=Object.keys(labels) as (keyof EnrollmentBank)[];

export function CrmEnrollmentBank({lang,isLight,active,onDraftChange}:{
  lang:CrmLanguage;isLight:boolean;active:boolean;onDraftChange:(dirty:boolean)=>void;
}) {
  const t=(copy:Copy)=>copy[lang==='zh'?0:lang==='id'?2:1];
  const [saved,setSaved]=useState<Settings>();
  const [draft,setDraft]=useState<Draft>();
  const [pending,setPending]=useState<string>();
  const [lookup,setLookup]=useState<'missing'|'error'>();
  const [error,setError]=useState<'load'|'conflict'|'save'>();
  const [hidden,setHidden]=useState(false);
  const [busy,setBusy]=useState(false);
  const [discard,setDiscard]=useState(false);
  const dirty=!!(draft&&saved&&fields.some(key=>draft.bank[key].trim()!==saved.bank[key]));
  useEffect(()=>{onDraftChange(dirty||busy||!!pending);},[dirty,busy,pending,onDraftChange]);
  useEffect(()=>()=>onDraftChange(false),[onDraftChange]);
  async function load(signal?:AbortSignal) {
    try{
      const response=await fetch(path,{cache:'no-store',signal});
      if(response.status===403||response.status===404){setHidden(true);return;}
      if(!response.ok)throw Error();
      const settings:Settings=await response.json();
      setSaved(settings);setError(undefined);
      setDraft(edit=>edit?{...edit,revision:settings.revision}:undefined);
    }catch{if(!signal?.aborted)setError('load');}
  }
  useEffect(()=>{
    if(!active||saved||hidden)return;
    const abort=new AbortController();
    void load(abort.signal);
    return ()=>abort.abort();
  },[active,saved,hidden]);

  function success(settings:Settings) {
    setSaved(settings);setPending(undefined);setDraft(undefined);
  }
  async function save() {
    if(!draft||!dirty||busy||pending||error==='conflict')return;
    const requestId=crypto.randomUUID();
    setBusy(true);setError(undefined);
    try{
      const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({...draft,requestId})});
      if(response.status>=500)throw Error();
      if(!response.ok){setError(response.status===409?'conflict':'save');return;}
      success((await response.json()).settings);
    }catch{setLookup(undefined);setPending(requestId);}finally{setBusy(false);}
  }
  async function check() {
    if(!pending||busy)return;
    setBusy(true);
    try{
      const response=await fetch(path+'/results/'+pending,{cache:'no-store'});
      if(response.ok)success((await response.json()).settings);
      else setLookup(response.status===404?'missing':'error');
    }catch{setLookup('error');}
    finally{setBusy(false);}
  }
  const close=()=>{if(!busy&&!pending){if(dirty)setDiscard(true);else setDraft(undefined);}};
  if(hidden)return null;
  const title=t(['报名收款账户','Enrollment bank account','Rekening pembayaran pendaftaran']);
  return <>
    <AdminFormSection title={title} variant="subgroup"
      description={t(['修改只影响之后获席的新订单。现有订单保留原收款账户。','Changes apply to future orders. Existing orders keep their original bank details.','Perubahan berlaku untuk pesanan baru. Pesanan lama tetap memakai rekening sebelumnya.'])}
      actions={saved&&<button type="button" className="crm-work-button" aria-haspopup="dialog" onClick={event=>{event.currentTarget.focus({preventScroll:true});setError(undefined);setDraft(saved);}}>
        {t(['编辑收款账户','Edit bank account','Edit rekening'])}</button>}>
      {!saved&&error==='load'?<CrmSaveFeedback state="error" lang={lang}>
        {t(['暂时无法读取收款账户。','The bank account could not be loaded.','Rekening belum dapat dimuat.'])}{' '}
        <button type="button" className="crm-work-link" onClick={()=>void load()}>{t(['重试','Retry','Coba lagi'])}</button>
      </CrmSaveFeedback>:saved?<AdminFormSummary fields={fields.map(key=>[t(labels[key]),saved.bank[key]])}/>:
        <p role="status">{t(['正在加载…','Loading…','Memuat…'])}</p>}
      <p className="crm-work-muted">{t(['本地模拟，请勿转账。','Local simulation. Do not transfer funds.','Simulasi lokal. Jangan transfer dana.'])}</p>
    </AdminFormSection>
    {active&&draft&&<AdminEditor variant="drawer" required responsiveForm title={t(['编辑收款账户','Edit bank account','Edit rekening'])}
      lang={lang} light={isLight} busy={busy} closeDisabled={!!pending} onClose={close}
      onSubmit={event=>{event.preventDefault();void save();}}
      footer={pending?<button type="button" disabled={busy} onClick={()=>void check()}>
        {t(['查询保存结果','Check save result','Periksa hasil simpan'])}</button>:<>
        <button type="button" disabled={busy} onClick={close}>{t(['取消','Cancel','Batal'])}</button>
        <button type="submit" data-primary disabled={!dirty||busy||error==='conflict'||error==='load'}>{t(['保存','Save','Simpan'])}</button>
      </>}>
        <div data-admin-stack>
          {fields.map(key=><AdminField required key={key}>{t(labels[key])}
            <input name={key} required maxLength={enrollmentBankFields[key]} value={draft.bank[key]} disabled={busy||!!pending}
              onChange={event=>setDraft({...draft,bank:{...draft.bank,[key]:event.target.value}})}/>
          </AdminField>)}
          {pending&&<CrmSaveFeedback state="unknown" lang={lang}>{lookup==='missing'?
            t(['暂未查到本次保存回执，草稿已保留。','No receipt yet. The draft is retained.','Belum ada bukti penyimpanan. Draf dipertahankan.']):
            lookup==='error'?t(['查询失败，保存结果仍待确认。','Lookup failed. The save result remains unconfirmed.','Pencarian gagal. Hasil simpan belum terkonfirmasi.']):undefined}
          </CrmSaveFeedback>}
          {error==='conflict'&&<CrmSaveFeedback state="error" lang={lang}>
            {t(['收款账户已被其他员工修改，请先核对最新值。','Another employee changed the account. Review the latest details first.','Staf lain mengubah rekening. Periksa data terbaru dulu.'])}{' '}
            <button type="button" className="crm-work-link" onClick={()=>void load()}>{t(['读取最新值','Load current details','Muat data terbaru'])}</button>
          </CrmSaveFeedback>}
          {error==='load'&&<CrmSaveFeedback state="error" lang={lang}>
            {t(['暂时无法核对最新的收款账户。','Could not check the current account.','Rekening saat ini belum dapat diperiksa.'])}
          </CrmSaveFeedback>}
          {error==='save'&&<CrmSaveFeedback state="error" lang={lang}/>}
          {saved&&error!=='conflict'&&draft.revision===saved.revision&&dirty&&<p className="crm-work-muted">
            {t(['当前已保存','Current account','Rekening saat ini'])} · {fields.map(key=>saved.bank[key]).join(' · ')}
          </p>}
        </div>
    </AdminEditor>}
    {active&&discard&&<CrmDiscardDialog lang={lang} isLight={isLight}
      onKeep={()=>setDiscard(false)} onDiscard={()=>{setDraft(undefined);setDiscard(false);}}/>}
  </>;
}

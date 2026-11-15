import { useEffect, useState } from 'react';
import { CrmPageIdentity } from './CrmPageIdentity';
import { CrmSingleSelect } from './CrmSingleSelect';
import { crmLocale, type CrmLanguage } from '../../utils/crmLanguage';
import { formatCurrency } from '../../utils/currency';
import { progressLabel, salesProgressStages } from '../../utils/crmSalesProgress';
import { interestOption } from '../EnrollmentInterests';
import { enrollmentPost } from '../EnrollmentApplication';
import { CrmOperationLayer } from './CrmOperationLayer';
import { AdminField, AdminForm, AdminRequiredNote } from '../AdminForm';
import { AdminFormActions } from '../AdminFormLayout';
import { CrmDiscardDialog } from './CrmDetailWorkspace';

type Copy = readonly [string,string,string];
type CourseRecord = {
  id:string; kind:'order'|'waitlist'|'demand'; opportunityId:string|null; state:string; createdAt:string;
  class:{level:string;firstLesson:string;schedule:string;opened:boolean}|null;
  criteria:{level:string;period:string;format:string;notes:string}|null;
  price:number|null;received:number|null;
  attribution?:{entry:string;source?:string;campaign?:string;verified:boolean}|null;
  latestNotice?:string;
};
type Opportunity = {
  id:string; level:string;customerId:string;customerName:string;businessNumber:string;owner:string|null;identityPending:boolean;
  state:'enrolled'|'applying'|'waiting'|'interest'|'closed';records:CourseRecord[];salesStage:string;revision:number;
  progress?:{id:string;actor:string;stage:string;note:string;createdAt:string}[];canProgress?:boolean;
};
const base = '/api/crm/opportunities';
const t = (lang:CrmLanguage,copy:Copy) => copy[lang==='zh'?0:lang==='id'?2:1];
const kinds:Record<CourseRecord['kind'],Copy> = {
  order:['报名申请','Enrollment application','Permohonan pendaftaran'],
  waitlist:['班次候补','Class waitlist','Daftar tunggu kelas'],
  demand:['选课需求','Course preferences','Preferensi kursus'],
};
const states:Record<string,Copy> = {
  awaiting_payment:['待付款','Awaiting payment','Menunggu pembayaran'],
  proof_review:['凭证待核实','Proof awaiting review','Bukti menunggu pemeriksaan'],
  partial:['部分到账','Partially paid','Dibayar sebagian'],paid:['报名成功','Enrollment confirmed','Pendaftaran berhasil'],
  recovered:['已恢复报名','Enrollment restored','Pendaftaran dipulihkan'],
  expired:['订单已终止','Order expired','Pesanan kedaluwarsa'],
  refunding:['退款处理中','Refund in progress','Pengembalian diproses'],
  refunded:['退款已完成','Refund complete','Pengembalian selesai'],
  waiting:['候补中','On waitlist','Dalam daftar tunggu'],
  converted:['已转申请','Converted to application','Menjadi permohonan'],
  withdrawn:['已撤回','Withdrawn','Ditarik'],closed:['已结束','Closed','Ditutup'],
  active:['有效','Active','Aktif'],
};
const next:Record<Opportunity['state'],Copy> = {
  enrolled:['已报名','Enrolled','Terdaftar'], applying:['办理报名','Complete enrollment','Selesaikan pendaftaran'],
  waiting:['等待班次空位','Wait for a seat','Menunggu kursi'],
  interest:['跟进选课需求','Follow up on course preferences','Tindak lanjuti preferensi kursus'],
  closed:['已结束','Closed','Ditutup'],
};
function nextAction(row:Opportunity,lang:CrmLanguage) {
  if (row.identityPending) return t(lang,['核实身份','Review identity','Verifikasi identitas']);
  if (row.records.some(record=>record.state==='proof_review'||record.state==='partial')) return t(lang,['核对到账','Verify payment','Verifikasi pembayaran']);
  if (row.records.some(record=>record.state==='awaiting_payment')) return t(lang,states.awaiting_payment);
  return t(lang,next[row.state]);
}
function stage(row:Opportunity,lang:CrmLanguage) {
  if (row.identityPending) return t(lang,['身份待核实','Identity review pending','Identitas menunggu verifikasi']);
  return progressLabel(row.salesStage,lang);
}
function read<T>(path:string,signal:AbortSignal):Promise<T> {
  return fetch(path,{signal,cache:'no-store'}).then(async response=>{
    if (!response.ok) throw Error(String(response.status));
    return response.json();
  });
}
function crmHref(values:Record<string,string>) {
  return '/crm?'+new URLSearchParams(values).toString();
}
function CourseRecords({ records, link, lang }: {records:CourseRecord[];link:boolean;lang:CrmLanguage}) {
  if(!records.length) return <p className="crm-work-muted">{t(lang,['暂无课程记录。','No course records.','Belum ada catatan kursus.'])}</p>;
  return <ol className="crm-course-records">
    {records.map(row=><li key={row.kind+row.id}>
      <strong>{t(lang,kinds[row.kind])}{row.class?' · '+row.class.level:''}</strong> <span>{states[row.state]?t(lang,states[row.state]):row.state}</span>
      <div className="crm-work-muted"><time dateTime={row.createdAt}>{new Date(row.createdAt).toLocaleDateString(crmLocale(lang))}</time> · {row.id}</div>
      {row.class&&<p>{row.class.firstLesson.replace('T',' ')} WIB · {row.class.schedule}{row.class.opened?' · '+t(lang,['已确认开班','Class confirmed','Kelas dikonfirmasi']):''}</p>}
      {row.criteria&&<p>{[row.criteria.level,row.criteria.period,row.criteria.format].map(value=>interestOption(lang,value)).join(' · ')}{row.criteria.notes?' — '+row.criteria.notes:''}</p>}
      {row.price!==null&&row.received!==null&&<p>{t(lang,['核实实收／应收','Verified receipts / amount due','Dana terverifikasi / tagihan'])} {formatCurrency(row.received,lang)} / {formatCurrency(row.price,lang)}</p>}
      {row.attribution&&<p>{t(lang,['报名来源','Enrollment source','Sumber pendaftaran'])} · {row.attribution.entry==='linkhub'?'UPER Links':
        row.attribution.entry==='website'?t(lang,['官网','Website','Situs web']):t(lang,['直接访问','Direct','Langsung'])}
        {row.attribution.verified&&row.attribution.source?' · '+row.attribution.source:''}{row.attribution.campaign?' · '+row.attribution.campaign:''}</p>}
      {row.latestNotice&&<p>{t(lang,['最近一封模拟邮件','Latest simulated email','Email simulasi terakhir'])} · {row.latestNotice}</p>}
      {link&&row.opportunityId&&<a className="crm-work-link" href={crmHref({tab:'opportunities',opportunity:row.opportunityId})}>{t(lang,['查看商机','View opportunity','Lihat peluang'])}</a>}
    </li>)}
  </ol>;
}

export function CrmCustomerCourseRecords({id,lang}:{id:string;lang:CrmLanguage}) {
  const [records,setRecords]=useState<CourseRecord[]>();
  const [error,setError]=useState(false);
  useEffect(()=>{
    const controller=new AbortController();
    read<{records:CourseRecord[]}>('/api/crm/leads/'+encodeURIComponent(id)+'/enrollment-records',controller.signal)
      .then(data=>setRecords(data.records)).catch(cause=>{if(cause.name!=='AbortError'&&cause.message!=='404')setError(true);});
    return ()=>controller.abort();
  },[id]);
  if(!records?.length&&!error) return null;
  return <section className="crm-opportunity-records" aria-label={t(lang,['课程报名记录','Course enrollment records','Catatan pendaftaran kursus'])}>
    <h3>{t(lang,['课程报名记录','Course enrollment records','Catatan pendaftaran kursus'])}</h3>
    {error?<p role="alert">{t(lang,['暂时无法读取课程记录。','Course records could not be loaded.','Catatan kursus belum dapat dimuat.'])}</p>:<CourseRecords records={records??[]} link lang={lang}/>}
  </section>;
}

export function CrmEnrollmentOpportunities({lang,isLight,employees,canReviewIdentity,canFinance}: {
  lang:CrmLanguage;isLight:boolean;employees:{id:string;displayName?:string}[];canReviewIdentity:boolean;canFinance:boolean;
}) {
  const params=new URLSearchParams(window.location.search);
  const id=params.get('opportunity');
  const [list,setList]=useState<Opportunity[]>();
  const [detail,setDetail]=useState<Opportunity>();
  const [error,setError]=useState('');
  const [filter,setFilter]=useState(params.get('opportunityStatus')||'active');
  const [search,setSearch]=useState(params.get('opportunityQuery')||'');
  const [editing,setEditing]=useState(false);
  const [draft,setDraft]=useState({stage:'',note:'',requestId:''});
  const [confirmDiscard,setConfirmDiscard]=useState(false);
  const [busy,setBusy]=useState(false);
  const [saveError,setSaveError]=useState(false);
  const [notice,setNotice]=useState(false);
  useEffect(()=>{
    const controller=new AbortController();
    const failure=(cause:Error)=>{if(cause.name!=='AbortError')setError(cause.message);};
    if(id) void read<Opportunity>(base+'/'+encodeURIComponent(id),controller.signal).then(setDetail,failure);
    else void read<{opportunities:Opportunity[]}>(base,controller.signal).then(data=>setList(data.opportunities),failure);
    return ()=>controller.abort();
  },[id]);
  useEffect(()=>{
    if(id) return;
    const url=new URL(window.location.href);
    if(url.searchParams.get('tab')!=='opportunities') return;
    if(filter==='active') url.searchParams.delete('opportunityStatus');else url.searchParams.set('opportunityStatus',filter);
    if(search) url.searchParams.set('opportunityQuery',search);else url.searchParams.delete('opportunityQuery');
    window.history.replaceState(null,'',url);
  },[filter,search,id]);
  const back=crmHref({tab:'opportunities',opportunityStatus:filter,opportunityQuery:search});
  const employeeName=(id:string|null)=>employees.find(employee=>employee.id===id)?.displayName||id;
  const owner=(row:Opportunity)=>employeeName(row.owner)||t(lang,['未分配','Unassigned','Belum ditugaskan']);
  const customerLink=(row:Opportunity)=>crmHref({tab:'leads',lead:row.customerId});
  const label=t(lang,['商机','Opportunities','Peluang']);
  const visible=list?.filter(row=>{
    const ended=['progress:enrolled','progress:closed'].includes(row.salesStage);
    return (filter==='all'||(filter==='closed'?ended:!ended)) && [row.level,row.customerName,row.businessNumber].some(value=>value?.toLowerCase().includes(search.trim().toLowerCase()));
  });
  return <section className="crm-opportunity-workspace" aria-busy={!error&&(id?!detail:!list)}>
    {id&&<a className="crm-work-link" href={back}>{t(lang,['返回商机列表','Back to opportunities','Kembali ke daftar peluang'])}</a>}
    <div className="admin-page-toolbar"><CrmPageIdentity title={detail?detail.customerName+' · '+detail.level:label}/></div>
    {error?<p role="alert">{error==='404'?t(lang,['找不到此商机，或当前账号无权查看。','This opportunity is unavailable or outside your access.','Peluang tidak tersedia atau di luar akses Anda.']):t(lang,['暂时无法读取商机。','Opportunities could not be loaded.','Peluang belum dapat dimuat.'])}</p>:id?
      detail?<><dl className="crm-opportunity-summary">
        <div><dt>{t(lang,['客户','Customer','Pelanggan'])}</dt><dd><a className="crm-work-link" href={customerLink(detail)}>{detail.customerName} · {detail.businessNumber}</a></dd></div>
        <div><dt>{t(lang,['负责人','Owner','Penanggung jawab'])}</dt><dd>{owner(detail)}</dd></div>
        <div><dt>{t(lang,['销售阶段','Sales stage','Tahap penjualan'])}</dt><dd>{stage(detail,lang)}</dd></div>
        <div><dt>{t(lang,['下一步','Next step','Langkah berikutnya'])}</dt><dd>{nextAction(detail,lang)}</dd></div>
      </dl>
      {detail.identityPending&&canReviewIdentity&&<a className="crm-work-link" href={crmHref({tab:'leads',lead:detail.customerId,identityLead:detail.customerId})}>{t(lang,['核实身份','Review identity','Verifikasi identitas'])}</a>}
      {canFinance&&detail.records.filter(row=>row.state==='proof_review'||row.state==='partial').map(row=><a key={row.id} className="crm-work-link"
        href={crmHref({tab:'payments',enrollmentOrder:row.id})}>{t(lang,['前往收款核验','Go to payment verification','Buka verifikasi pembayaran'])}</a>)}
      {detail.canProgress&&detail.state!=='enrolled'&&<button type="button" className="crm-work-button justify-self-start" onClick={()=>{
        setDraft({stage:detail.salesStage,note:'',requestId:crypto.randomUUID()});
        setSaveError(false);setNotice(false);setEditing(true);
      }}>{t(lang,['记录商机进展','Record opportunity progress','Catat kemajuan peluang'])}</button>}
      {notice&&<span className="crm-opportunity-feedback" role="status">{t(lang,['商机进展已保存','Opportunity progress saved','Kemajuan peluang tersimpan'])}</span>}
      {editing&&<CrmOperationLayer compose customerContext={false} lang={lang} isLight={isLight} busy={busy}
        title={<>{t(lang,['记录商机进展','Record opportunity progress','Catat kemajuan peluang'])}<AdminRequiredNote inline lang={lang}/></>}
        onClose={()=>{if(!busy){if(draft.note.trim()||draft.stage!==detail.salesStage)setConfirmDiscard(true);else setEditing(false);}}}>
        <AdminForm lang={lang} className="crm-editor-compose" onSubmit={async event=>{
          event.preventDefault();
          if(busy||!draft.note.trim())return;
          setBusy(true);setSaveError(false);
          try{
            await enrollmentPost(base+'/'+detail.id+'/progress',{...draft,revision:detail.revision});
            setDetail(await read<Opportunity>(base+'/'+detail.id,new AbortController().signal));
            setEditing(false);setNotice(true);
          }catch{setSaveError(true);}finally{setBusy(false);}
        }}>
          <div className="crm-editor-scroll">
            <p>{detail.customerName} · {detail.level}</p>
            <AdminField required>{t(lang,['销售阶段','Sales stage','Tahap penjualan'])}
              <CrmSingleSelect required label={t(lang,['销售阶段','Sales stage','Tahap penjualan'])}
                value={draft.stage} isLight={isLight} lang={lang}
                options={salesProgressStages.filter(row=>row[0]!=='progress:enrolled').map(row=>({value:row[0],label:progressLabel(row[0],lang)}))}
                onChange={stage=>setDraft(current=>({...current,stage}))}/>
            </AdminField>
            <AdminField required>{t(lang,['进展与依据','Progress and evidence','Kemajuan dan bukti'])}
              <textarea required maxLength={2000} value={draft.note} onChange={event=>setDraft(current=>({...current,note:event.target.value}))}/>
            </AdminField>
            {saveError&&<p role="alert">{t(lang,['未能确认保存结果，请核对原商机后重试。','Review the original opportunity before retrying.','Periksa peluang awal sebelum mencoba lagi.'])}</p>}
          </div>
          <AdminFormActions className="crm-editor-actions">
            <button type="button" className="crm-work-button" disabled={busy} onClick={()=>draft.note.trim()||draft.stage!==detail.salesStage?setConfirmDiscard(true):setEditing(false)}>{t(lang,['取消','Cancel','Batal'])}</button>
            <button type="submit" className="crm-work-button" data-primary disabled={busy||!draft.note.trim()}>{t(lang,['保存','Save','Simpan'])}</button>
          </AdminFormActions>
        </AdminForm>
      </CrmOperationLayer>}
      {confirmDiscard&&<CrmDiscardDialog lang={lang} isLight={isLight} onKeep={()=>setConfirmDiscard(false)}
        onDiscard={()=>{setEditing(false);setConfirmDiscard(false);}}/>}
      {!!detail.progress?.length&&<section>
        <h2>{t(lang,['商机进展','Opportunity progress','Kemajuan peluang'])}</h2>
        <ol className="crm-course-records">{detail.progress.map(entry=><li key={entry.id}>
          <strong>{progressLabel(entry.stage,lang)}</strong> · {employeeName(entry.actor)} · <time dateTime={entry.createdAt}>{new Date(entry.createdAt).toLocaleDateString(crmLocale(lang))}</time>
          <p>{entry.note}</p>
        </li>)}</ol>
      </section>}
      <CourseRecords records={detail.records} link={false} lang={lang}/></>:null
    : <>
      <div className="crm-opportunity-filters">
        <input type="search" aria-label={t(lang,['搜索商机','Search opportunities','Cari peluang'])} placeholder={t(lang,['姓名、客户编号或级别','Name, customer number, or level','Nama, nomor pelanggan, atau level'])} value={search} onChange={event=>setSearch(event.currentTarget.value)}/>
        <CrmSingleSelect label={t(lang,['商机范围','Opportunity scope','Cakupan peluang'])} value={filter} lang={lang} isLight={isLight} onChange={setFilter} options={[
          {value:'active',label:t(lang,['进行中','In progress','Berlangsung'])},{value:'closed',label:t(lang,['已结束','Ended','Berakhir'])},{value:'all',label:t(lang,['全部','All','Semua'])},
        ]}/>
      </div>
      {visible?.length===0?<p className="crm-work-muted">{t(lang,['当前没有符合条件的商机。','No opportunities match.','Tidak ada peluang yang sesuai.'])}</p>:visible&&
        <div className="crm-opportunity-table"><table>
          <thead><tr>{([
            ['商机','Opportunity','Peluang'],['客户','Customer','Pelanggan'],['负责人','Owner','Penanggung jawab'],['销售阶段','Sales stage','Tahap penjualan'],['下一步','Next step','Langkah berikutnya'],
          ] as const).map(copy=><th scope="col" key={copy[0]}>{t(lang,copy)}</th>)}</tr></thead>
          <tbody>{visible.map(row=><tr key={row.id}>
            <td><a className="crm-work-link" href={crmHref({tab:'opportunities',opportunity:row.id,opportunityStatus:filter,opportunityQuery:search})}>{row.level}</a></td>
            <td><a className="crm-work-link" href={customerLink(row)}>{row.customerName}</a></td>
            <td>{owner(row)}</td><td>{stage(row,lang)}</td><td>{nextAction(row,lang)}</td>
          </tr>)}</tbody>
        </table></div>}
    </>}
  </section>;
}

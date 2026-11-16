import {RefreshCw} from 'lucide-react';
import {CrmPageAction} from './CrmPageAction';
import {AdminDisclosure} from '../admin/AdminDisclosure';
import {AdminListState,AdminListTable} from '../admin/AdminList';
import {AdminStatus} from '../AdminStatus';
import {AdminRowAction} from '../admin/AdminListControl';
import {formatCurrency} from '../../utils/currency';
import {useEffect,useRef,useState} from 'react';
import {AdminField} from '../AdminForm';
import {AdminFormGrid,AdminFormSection} from '../AdminFormLayout';
import {AdminEditor} from '../admin/AdminEditor';
import {CrmDiscardDialog,CrmSaveFeedback} from './CrmDetailWorkspace';
import {courseError} from '../../utils/crmCoursePricing';
import {formatCrmEventTime} from '../../utils/crmOperatingTime';
import type {CrmLanguage} from '../../utils/crmLanguage';
export function CrmCourses({lang,isLight,onDraftChange}:{lang:CrmLanguage;isLight:boolean;onDraftChange:(dirty:boolean)=>void}){
 const t=(en:string,id:string,zh:string)=>lang==='zh'?zh:lang==='id'?id:en;
 const [data,setData]=useState<any>(null),[form,setForm]=useState<any>(null),[error,setError]=useState(''),[state,setState]=useState(''),[dirty,setDirty]=useState(false),[discard,setDiscard]=useState(false),[latest,setLatest]=useState<any>(null);
 const pending=useRef<any>(null),gate=useRef(false);const busy=['saving','checking'].includes(state),unknown=state==='unknown';
 const [readState,setReadState]=useState<'loading'|'ready'|'error'|'denied'>('loading');
 const readRequest=useRef<AbortController|null>(null);
 const title=t('Courses & pricing','Kursus & harga','课程与报价');
 const listState=readState==='loading'&&data?'ready':readState;
 const money=(n:number)=>formatCurrency(n,lang);
 const load=async()=>{
  readRequest.current?.abort();
  const controller=new AbortController();
  readRequest.current=controller;
  const {signal}=controller;
  setReadState('loading');
  try{
   const r=await fetch('/api/crm/courses?stats=1',{cache:'no-store',signal});
   if(signal.aborted)return;
   if(r.status===401||r.status===403){setData(null);setReadState('denied');return;}
   if(!r.ok)throw Error();
   const d=await r.json();
   if(signal.aborted)return;
   setData(d);setReadState('ready');
   try{const id=sessionStorage.getItem('uper_course_pending:'+d.actorId);if(id&&!pending.current){pending.current={requestId:id};setState('unknown');}}catch{}
  }catch(cause){
   if(signal.aborted)return;
   setReadState('error');
   throw cause;
  }
 };
 const refresh=()=>void load().catch(()=>{});
 useEffect(()=>{refresh();return ()=>readRequest.current?.abort();},[]);
 useEffect(()=>{onDraftChange(dirty||unknown||busy);},[onDraftChange,dirty,unknown,busy]);
 useEffect(()=>()=>onDraftChange(false),[onDraftChange]);
 useEffect(()=>{const warn=(e:BeforeUnloadEvent)=>{if(dirty||unknown){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[dirty,unknown]);
 const edit=(c?:any)=>{setForm(c?{...c,config:{name:c.name,sessions:c.sessions,price:c.price,active:c.active,maxDiscountBps:c.maxDiscountBps,maxDiscountAmount:c.maxDiscountAmount}}:{id:crypto.randomUUID(),revision:0,config:{name:'',sessions:'',price:'',active:false,maxDiscountBps:0,maxDiscountAmount:null}});setError('');setLatest(null);setState('');setDirty(false);pending.current=null;};
 const patch=(k:string,v:any)=>{setForm((f:any)=>({...f,config:{...f.config,[k]:v}}));setDirty(true);setError('');setState('');};
 const close=()=>{if(dirty||unknown)setDiscard(true);else setForm(null);};
 const save=async(e:any)=>{e.preventDefault();if(gate.current||unknown)return;gate.current=true;setState('saving');setError('');const b={id:form.id,revision:form.revision,requestId:crypto.randomUUID(),config:{...form.config,sessions:Number(form.config.sessions),price:Number(form.config.price),maxDiscountBps:Number(form.config.maxDiscountBps),maxDiscountAmount:form.config.maxDiscountAmount===null||form.config.maxDiscountAmount===''?null:Number(form.config.maxDiscountAmount)}};pending.current=b;try{sessionStorage.setItem('uper_course_pending:'+data.actorId,b.requestId);}catch{}
 try{const r=await fetch('/api/crm/courses',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});const d=await r.json();if(!r.ok){if(r.status>=500){setState('unknown');return;}setState('failed');setError(courseError(d.error,lang));if(r.status===409){try{const fresh=await fetch('/api/crm/courses',{cache:'no-store'});if(fresh.ok)setLatest((await fresh.json()).courses.find((c:any)=>c.id===b.id));}catch{}}pending.current=null;try{sessionStorage.removeItem('uper_course_pending:'+data.actorId);}catch{}return;}if(d.courseId!==b.id||d.operationKind!=='course')throw Error('unconfirmed');setDirty(false);setForm(null);pending.current=null;try{sessionStorage.removeItem('uper_course_pending:'+data.actorId);}catch{}setState('saved');await load().catch(()=>setError(t('Saved; refresh to review.','Disimpan; segarkan untuk memeriksa.','已保存，请刷新核对。')));}catch{setState('unknown');}finally{gate.current=false;}};
 const query=async()=>{if(!pending.current||gate.current)return;gate.current=true;setState('checking');try{const r=await fetch('/api/crm/courses/results/'+pending.current.requestId,{cache:'no-store'});if(!r.ok)throw Error();setDirty(false);setForm(null);pending.current=null;try{sessionStorage.removeItem('uper_course_pending:'+data.actorId);}catch{}setState('saved');await load().catch(()=>setError(t('Saved; refresh to review.','Disimpan; segarkan untuk memeriksa.','已保存，请刷新核对。')));}catch{setState('unknown');setError(t('Save result is not confirmed. Check again before resubmitting.','Hasil simpan belum pasti. Periksa lagi sebelum mengirim ulang.','保存结果尚未确认，请继续查询，不要重复提交。'));}finally{gate.current=false;}};
 return <div className="crm-course-catalog">
 <header className="admin-edit-header"><div className="admin-edit-title"><h2>{title}</h2><p className="crm-work-muted">{t('Publish course prices and sales discount allowances. Statistics follow your customer access.','Terbitkan harga dan batas diskon sales. Statistik mengikuti akses pelanggan.','维护在售课程、标准价和销售优惠上限；统计遵循当前客户查看范围。')}</p></div><div className="crm-ops-actions"><CrmPageAction icon={RefreshCw} label={t('Refresh','Segarkan','刷新')} loading={readState==='loading'} onClick={refresh}/>{data?.canManage&&<button type="button" className="crm-work-button" data-primary disabled={readState!=='ready'||unknown||busy} onClick={()=>edit()}>{t('Create course','Buat kursus','创建课程')}</button>}</div></header>
 {!form&&unknown&&<div><CrmSaveFeedback state="unknown" lang={lang}/><button type="button" className="crm-work-button" onClick={query}>{t('Check save result','Periksa hasil simpan','查询保存结果')}</button></div>}{!form&&state==='saved'&&<CrmSaveFeedback state="saved" lang={lang}/ >}{!form&&error&&<p role="alert">{error}</p>}
 {(listState!=='ready'||!data?.courses.length)&&<AdminListState lang={lang}
   state={listState==='ready'?'empty':listState}
   message={listState==='ready'
    ?t('No courses yet. Create and publish a course before confirming enrollment.','Belum ada kursus. Buat dan terbitkan sebelum konfirmasi pendaftaran.','暂无课程。创建并发布课程后，销售才能确认报名。')
    :listState==='error'&&data?t('Refresh failed. Showing the last loaded courses.','Gagal menyegarkan. Kursus yang terakhir dimuat masih ditampilkan.','刷新失败，仍显示上次读取的课程。'):undefined}
   onRetry={refresh}/>}
 {data?.courses.length>0&&<AdminListTable label={title} className="crm-course-list" busy={readState==='loading'} headers={[
   t('Course','Kursus','课程'),{label:t('Standard price','Harga standar','标准价'),numeric:true},
   {label:t('Enrollments','Pendaftaran','报名人数'),numeric:true},
   {label:t('Paying customers','Pelanggan membayar','净付款人数'),numeric:true},
   {label:t('Paid in full','Lunas','已收齐人数'),numeric:true},
   {label:t('Net receipts','Penerimaan neto','净收款'),numeric:true},t('Actions','Tindakan','操作'),
 ]}>{data.courses.map((c:any)=><tr key={c.id}><td><strong>{c.name}</strong><p>{c.sessions} {t('sessions','pertemuan','课时')} · <AdminStatus tone={c.active?'success':'neutral'}>{c.active?t('Published','Diterbitkan','已发布'):t('Not on sale','Tidak dijual','未在售')}</AdminStatus></p></td><td className="crm-list-number">{money(c.price)}<p>{t('Max discount','Diskon maks.','优惠上限')} {c.maxDiscountBps/100}%{c.maxDiscountAmount!==null?' / '+money(c.maxDiscountAmount):''}</p></td><td className="crm-list-number">{c.stats.enrolled}{c.stats.voided>0&&<p>{t('Voided','Dibatalkan','已撤销')} {c.stats.voided}</p>}</td><td className="crm-list-number">{c.stats.paying}</td><td className="crm-list-number">{c.stats.paid}</td><td className="crm-list-number">{money(c.stats.net)}<p>{t('Receipts','Penerimaan','收款')} {money(c.stats.received)} · {t('Refunds','Pengembalian','退款')} {money(c.stats.refunded)}</p>{c.stats.pending>0&&<p>{t('Pending verification','Menunggu verifikasi','待核验')} {c.stats.pending}</p>}</td><td>{data.canManage&&<AdminRowAction disabled={readState!=='ready'||unknown||busy} onClick={()=>edit(c)}>{t('Edit','Edit','编辑')}</AdminRowAction>}</td></tr>)}</AdminListTable>}
 {form&&<AdminEditor variant="drawer" responsiveForm required className="crm-course-editor"
  title={form.revision?t('Edit course','Edit kursus','编辑课程'):t('Create course','Buat kursus','创建课程')}
  lang={lang} light={isLight} busy={busy} onClose={close} onSubmit={save}
  footer={unknown
    ?<button type="button" disabled={busy} onClick={query}>{t('Check save result','Periksa hasil simpan','查询保存结果')}</button>
    :<><button type="button" disabled={busy} onClick={close}>{t('Cancel','Batal','取消')}</button>
      <button type="submit" data-primary="" disabled={busy}>{t('Save','Simpan','保存')}</button></>}>
  {error&&<p role="alert">{error}</p>}
  {latest&&<aside><p>{t('Latest standard price','Harga standar terbaru','最新标准价')}：{money(latest.price)}</p>
    <button type="button" className="crm-work-button" onClick={()=>{setForm((f:any)=>({...f,revision:latest.revision}));setLatest(null);setError('');}}>{t('Keep draft after review','Pertahankan draf setelah ditinjau','核对后保留草稿继续')}</button>
  </aside>}
  {unknown&&<CrmSaveFeedback state="unknown" lang={lang}/>}
  <AdminFormSection variant="subgroup" title={t('Course details','Informasi kursus','课程信息')}>
    <AdminFormGrid>
      <AdminField required data-admin-full-width="">{t('Course name','Nama kursus','课程名称')}
        <input type="text" required disabled={busy||unknown} value={form.config.name} onChange={e=>patch('name',e.target.value)}/>
      </AdminField>
      <AdminField required>{t('Sessions','Pertemuan','课时')}
        <input type="number" required min="1" step="1" disabled={busy||unknown} value={form.config.sessions} onChange={e=>patch('sessions',e.target.value)}/>
      </AdminField>
      <AdminField required>{t('Standard total price (Rp)','Harga total standar (Rp)','标准总价（Rp）')}
        <input type="number" required min="0" step="1" disabled={busy||unknown} value={form.config.price} onChange={e=>patch('price',e.target.value)}/>
      </AdminField>
    </AdminFormGrid>
  </AdminFormSection>
  <AdminFormSection variant="subgroup" title={t('Sales discount limits','Batas diskon sales','销售优惠上限')}>
    <AdminFormGrid>
      <AdminField required>{t('Sales discount limit (%)','Batas diskon sales (%)','销售优惠比例上限（%）')}
        <input type="number" min="0" max="100" step="0.01" disabled={busy||unknown} value={form.config.maxDiscountBps===''?'':form.config.maxDiscountBps/100}
          onChange={e=>patch('maxDiscountBps',e.target.value===''?'':Math.round(Number(e.target.value)*100))}/>
      </AdminField>
      <AdminField>{t('Sales discount amount cap (Rp)','Batas nominal diskon sales (Rp)','销售优惠金额上限（Rp）')}
        <input type="number" min="0" step="1" disabled={busy||unknown} value={form.config.maxDiscountAmount??''} onChange={e=>patch('maxDiscountAmount',e.target.value)}/>
      </AdminField>
      <p className="crm-work-muted" data-admin-full-width="">{t('Both limits apply when an amount cap is set. Blank means percentage limit only.','Kedua batas berlaku jika nominal diisi. Kosong berarti batas persentase saja.','金额上限填写后与比例上限同时生效，取更严格者；留空仅限制比例。')}</p>
    </AdminFormGrid>
  </AdminFormSection>
  <AdminFormSection variant="subgroup" title={t('Publication settings','Pengaturan publikasi','发布设置')}>
    <label className="admin-field admin-field--choice"><input type="checkbox" disabled={busy||unknown} checked={form.config.active} onChange={e=>patch('active',e.target.checked)}/>
      <span>{t('Publish for new enrollment','Terbitkan untuk pendaftaran baru','发布并允许新报名')}</span></label>
  </AdminFormSection>
  {form.history?.length>0&&<AdminDisclosure heading={t('Price history','Riwayat harga','价格历史')}>{[...form.history].reverse().map((h:any)=><p key={h.id}>{formatCrmEventTime(h.at)} · {h.actor} · {h.before?money(h.before.price)+' → ':''}{money(h.after.price)} · {h.after.name} · {h.after.maxDiscountBps/100}%</p>)}</AdminDisclosure>}
 </AdminEditor>}
 {discard&&<CrmDiscardDialog lang={lang} isLight={isLight} onKeep={()=>setDiscard(false)} onDiscard={()=>{setDiscard(false);setForm(null);setDirty(false);setError('');}}/>}
 </div>;
}

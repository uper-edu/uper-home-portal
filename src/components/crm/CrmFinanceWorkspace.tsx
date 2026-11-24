import {AdminListPagination,AdminListState,AdminListTable} from '../admin/AdminList';
import {AdminRecordEntry,AdminRowAction} from '../admin/AdminListControl';
import {AdminSearchField} from '../admin/AdminSearchField';
import {formatCurrency} from '../../utils/currency';
import {useEffect,useRef,useState} from 'react';
import {AdminSingleSelect} from '../admin/AdminSingleSelect';
import {CrmPayments} from './CrmPayments';
import {CrmPaymentStatus} from './CrmPaymentStatus';
import {paymentRemainingTone,paymentWorkspaceLabel} from '../../utils/crmPaymentPresentation';
import {CrmDiscardDialog} from './CrmDetailWorkspace';
import {formatCrmEventTime} from '../../utils/crmOperatingTime';
import {canVerifyPayments,paymentListFilters,paymentListNextAction,type PaymentListFilters,type PaymentListRow} from '../../utils/crmPaymentWorklist';
type Selection={leadId:string;projectId?:string;entryId?:string;customer:string;action:string};
function locationState(){try{const p=new URLSearchParams(window.location.search);return paymentListFilters({state:p.get('paymentState')||'outstanding',kind:p.get('paymentKind')||'all',search:p.get('paymentSearch')||'',page:p.get('paymentPage')||'1'});}catch{return paymentListFilters();}}
function locationEntry():Selection|null{if(typeof window==='undefined')return null;const p=new URLSearchParams(window.location.search),leadId=p.get('paymentLead'),entryId=p.get('paymentEntry'),projectId=p.get('paymentProject');return leadId&&(entryId||projectId)?{leadId,...(entryId?{entryId}:{}),...(projectId?{projectId}:{}),customer:'',action:p.get('paymentAction')||'view'}:null;}
export function CrmFinanceWorkspace({employee,lang,isLight,refreshVersion,onRefreshingChange,onDirty=()=>{},onBusy=()=>{},onLocation=()=>{},onQueueChanged=()=>{}}:any){
 const t=(zh:string,en:string,id:string)=>lang==='zh'?zh:lang==='id'?id:en;
 const permitted=canVerifyPayments(employee);
 const scopeKey=JSON.stringify([employee.id,employee.active,employee.permissions,employee.grants,employee.scope]);
 const [filters,setFilters]=useState<PaymentListFilters>(locationState),[search,setSearch]=useState(filters.search),[result,setResult]=useState<{key:string;rows:PaymentListRow[];total:number;page:number;pageSize:number}>(),[loading,setLoading]=useState(true),[error,setError]=useState(''),[denied,setDenied]=useState(false),[refresh,setRefresh]=useState(0);
 const data=permitted&&result?.key===JSON.stringify([scopeKey,filters.state,filters.kind,filters.search,filters.page])?result:undefined;
 const selectionScope=useRef(scopeKey);
 const [selection,setSelection]=useState<Selection|null>(locationEntry),[dirty,setDirty]=useState(false),[busy,setBusy]=useState(false),[pending,setPending]=useState<null|(()=>void)>(null);
 const callbacks=useRef({onDirty,onBusy,onLocation});callbacks.current={onDirty,onBusy,onLocation};
 const current=useRef({filters,selection,dirty,busy});current.current={filters,selection,dirty,busy};const generation=useRef(0),lastUrl=useRef(typeof window==='undefined'?'':window.location.href),workspace=useRef<HTMLElement>(null),opener=useRef<HTMLElement|null>(null);
 useEffect(()=>{
  if(selectionScope.current===scopeKey)return;
  selectionScope.current=scopeKey;setSelection(null);setDirty(false);setPending(null);
 },[scopeKey]);
 useEffect(()=>{onRefreshingChange(loading);return()=>onRefreshingChange(false);},[loading,onRefreshingChange]);
 useEffect(()=>{callbacks.current.onDirty(dirty);return()=>callbacks.current.onDirty(false);},[dirty]);
 useEffect(()=>{callbacks.current.onBusy(busy);return()=>callbacks.current.onBusy(false);},[busy]);
 useEffect(()=>{const timer=setTimeout(()=>setSearch(filters.search),250);return()=>clearTimeout(timer);},[filters.search]);
 useEffect(()=>{if(!permitted){setResult(undefined);setLoading(false);return;}const controller=new AbortController(),version=++generation.current;setLoading(true);setError('');
  const query=new URLSearchParams({state:filters.state,kind:filters.kind,search,page:String(filters.page)});
  void fetch('/api/crm/payments?'+query,{cache:'no-store',signal:controller.signal}).then(async r=>{if(version!==generation.current||controller.signal.aborted)return;if(r.status===401||r.status===403){setResult(undefined);setDenied(true);return;}if(!r.ok)throw Error();const d=await r.json();if(version!==generation.current||controller.signal.aborted)return;setResult({...d,key:JSON.stringify([scopeKey,filters.state,filters.kind,search,filters.page])});setDenied(false);}).catch(e=>{if(!controller.signal.aborted&&version===generation.current)setError(t('清单暂时无法加载，请重试。','Unable to load the list. Try again.','Daftar belum dapat dimuat. Coba lagi.'));}).finally(()=>{if(!controller.signal.aborted&&version===generation.current)setLoading(false);});
  return()=>{controller.abort();generation.current++;};
 },[permitted,scopeKey,filters.state,filters.kind,filters.page,search,refresh,refreshVersion]);
 const write=(next:PaymentListFilters,entry:Selection|null,push=false)=>{const url=new URL(window.location.href);url.searchParams.set('tab','payments');for(const [key,value]of Object.entries({paymentState:next.state,paymentKind:next.kind,paymentSearch:next.search,paymentPage:String(next.page)})){if(value)url.searchParams.set(key,value);else url.searchParams.delete(key);}for(const key of ['paymentLead','paymentEntry','paymentProject','paymentAction'])url.searchParams.delete(key);if(entry){url.searchParams.set('paymentLead',entry.leadId);if(entry.entryId)url.searchParams.set('paymentEntry',entry.entryId);if(entry.projectId)url.searchParams.set('paymentProject',entry.projectId);url.searchParams.set('paymentAction',entry.action);}window.history[push?'pushState':'replaceState']({},'',url);lastUrl.current=url.href;callbacks.current.onLocation(url.href);};
 const guard=(action:()=>void)=>{if(current.current.busy)return;if(current.current.dirty)setPending(()=>action);else action();};
 const close=()=>guard(()=>{setSelection(null);setDirty(false);write(current.current.filters,null);setRefresh(v=>v+1);requestAnimationFrame(()=>{if(!opener.current?.isConnected)workspace.current?.focus({preventScroll:true});});});
 const open=(row:PaymentListRow,action:string,origin?:HTMLElement)=>{opener.current=origin||document.activeElement as HTMLElement;opener.current?.focus({preventScroll:true});const next={leadId:row.leadId,projectId:row.projectId,customer:row.customer,action};write(filters,next,true);setSelection(next);};
 const change=(patch:Partial<PaymentListFilters>)=>{const next={...filters,...patch,page:patch.page??1};setFilters(next);write(next,null);};
 useEffect(()=>{const pop=()=>{const params=new URLSearchParams(window.location.search);if(params.get('tab')!=='payments'||params.get('paymentView')==='enrollment'||params.has('enrollmentOrder'))return;const target=window.location.href,apply=()=>{const next=locationState();setFilters(next);setSelection(locationEntry());setDirty(false);window.history.replaceState({},'',target);lastUrl.current=target;callbacks.current.onLocation(target);};if(current.current.busy||current.current.dirty){window.history.pushState({},'',lastUrl.current);guard(apply);}else apply();};window.addEventListener('popstate',pop);return()=>window.removeEventListener('popstate',pop);},[]);
 const updating=loading||search!==filters.search;
 const money=(value:number|null)=>value===null?t('未确定','Not agreed','Belum ditetapkan'):formatCurrency(value,lang);
 const states=[{value:'all',label:t('全部记录','All records','Semua catatan')},{value:'outstanding',label:t('待处理','Needs attention','Perlu ditangani')},{value:'unpaid',label:t('未收款','Unpaid','Belum dibayar')},{value:'partial',label:t('部分收款','Partially paid','Dibayar sebagian')},{value:'paid',label:t('已收齐','Paid in full','Lunas')},{value:'unpriced',label:t('应收未确定','Not priced','Tagihan belum ditetapkan')},{value:'terminated',label:t('已终止','Terminated','Dihentikan')},{value:'nocharge',label:t('无需收款','No payment due','Tanpa tagihan')},{value:'pending',label:t('有待核验款项','Has pending payments','Ada pembayaran menunggu')},{value:'rejected',label:t('有退回记录','Has returned records','Ada catatan dikembalikan')},{value:'void',label:t('有作废记录','Has voided records','Ada catatan dibatalkan')},{value:'verified',label:t('有核实记录','Has verified records','Ada catatan terverifikasi')}].map(option=>({...option,group:option.value==='all'?undefined:['pending','verified','rejected','void'].includes(option.value)?t('款项记录','Payment records','Catatan pembayaran'):t('应收状态','Receivable status','Status tagihan')}));
 return <section ref={workspace} tabIndex={-1} className="crm-finance-workspace" aria-label={t('收款核验','Payment verification','Verifikasi pembayaran')}>

 {!permitted||denied?<AdminListState lang={lang} state="denied" message={t('你没有收款核验权限。','You do not have payment verification access.','Anda tidak memiliki akses verifikasi pembayaran.')}/>:<>
 <div className="crm-finance-filters"><AdminSearchField className="crm-finance-search" label={t('搜索客户、课程或负责人','Search customer, course or owner','Cari pelanggan, kursus atau penanggung jawab')} placeholder={t('客户、课程或负责人','Customer, course or owner','Pelanggan, kursus atau penanggung jawab')} value={filters.search} onChange={search=>change({search})}/><AdminSingleSelect label={t('收款状态','Payment status','Status pembayaran')} lang={lang} isLight={isLight} value={filters.state} options={states} onChange={state=>change({state:state as PaymentListFilters['state']})}/><AdminSingleSelect label={t('款项记录','Payment records','Catatan pembayaran')} lang={lang} isLight={isLight} value={filters.kind} options={[{value:'all',label:t('全部款项','All payments','Semua pembayaran')},{value:'receipt',label:t('付款','Receipts','Penerimaan')},{value:'refund',label:t('退款','Refunds','Pengembalian')}]} onChange={kind=>change({kind:kind as PaymentListFilters['kind']})}/></div>
 {error&&<AdminListState lang={lang} state="error" message={data?.rows.length?error+' '+t('显示上次成功读取的结果。','Showing the last successful result.','Menampilkan hasil terakhir yang berhasil.'):error} compact={Boolean(data?.rows.length)} onRetry={()=>setRefresh(v=>v+1)}/>}
 {!error&&!data&&<AdminListState lang={lang} state="loading"/>}
 {data&&<p className="crm-list-meta" role="status">{t(`匹配 ${data.total} 条款项记录`,`${data.total} matching payment records`,`${data.total} catatan pembayaran cocok`)}</p>}
 {!error&&data&&!data.rows.length&&<AdminListState lang={lang} state="empty" message={t('暂无符合条件的历史客户款项。','No matching historical payments.','Tidak ada riwayat pembayaran yang sesuai.')}/>}
 {Boolean(data?.rows.length)&&<AdminListTable className="crm-finance-table" busy={updating}
   label={paymentWorkspaceLabel('historical',lang)} headers={[
     t('客户','Customer','Pelanggan'),t('课程','Course','Kursus'),
     {label:t('应收','Amount due','Tagihan'),numeric:true},
     {label:t('已核实到账','Verified receipts','Penerimaan terverifikasi'),numeric:true},
     {label:t('余额','Balance','Saldo'),numeric:true},
     t('报名时间','Enrolled','Terdaftar'),t('销售负责人','Sales owner','Penanggung jawab'),t('状态','Status','Status'),t('操作','Actions','Tindakan'),
   ]}>
 {data?.rows.map((row:PaymentListRow)=>{const next=paymentListNextAction(row);return <tr key={row.leadId+':'+row.projectId}><td><AdminRecordEntry
  aria-label={t('查看款项记录','View payment record','Lihat catatan pembayaran')+' · '+row.customer+' · '+row.course}
  onClick={e=>open(row,'view',e.currentTarget)}>{row.customer}</AdminRecordEntry></td><td>{row.course}</td><td className="crm-finance-amount crm-list-number">{money(row.expected)}</td><td className="crm-finance-amount crm-list-number">{money(row.received)}{row.refunded>0&&<small>{t('已退款','Refunded','Dikembalikan')} {money(row.refunded)}</small>}</td><td className="crm-finance-amount crm-list-number"><span className="crm-payment-balance" data-tone={paymentRemainingTone(row)}>{row.settlement?.state==='refund'?<>{t('待退款','To refund','Perlu dikembalikan')} {money(row.settlement.refund)}</>:row.settlement?.state==='pending'?'—':money(row.remaining)}</span>{row.overpaid>0&&<small>{t('超收','Overpayment','Kelebihan pembayaran')} {money(row.overpaid)}</small>}</td><td className="crm-finance-date">{formatCrmEventTime(row.enrolledAt)}</td><td>{row.owner||t('未分配','Unassigned','Belum ditugaskan')}</td><td><CrmPaymentStatus state={row.settlement?'settlement_'+row.settlement.state:row.state} lang={lang}/>{row.pending>0&&<small>{t('待核验','Pending','Menunggu')} · {row.pending}</small>}</td><td><div className="crm-finance-row-actions">{next?<AdminRowAction onClick={e=>open(row,next,e.currentTarget)}>{next==='review_receipt'?t('核验付款','Verify payment','Verifikasi pembayaran'):next==='review_refund'?t('核验退款','Verify refund','Verifikasi pengembalian'):next==='refund'?t('登记已退款项','Record completed refund','Catat pengembalian selesai'):t('核实到账','Verify receipt','Verifikasi penerimaan')}</AdminRowAction>:<span className="crm-work-muted" aria-label={t('暂无待处理操作','No pending action','Tidak ada tindakan tertunda')}>—</span>}</div></td></tr>;})}
 </AdminListTable>}
 {data&&<AdminListPagination lang={lang} page={data.page} pageCount={Math.max(1,Math.ceil(data.total/data.pageSize))}
   busy={updating} onPageChange={page=>change({page})}/>}
 {selection&&selectionScope.current===scopeKey&&<CrmPayments key={selection.leadId+':'+(selection.entryId||selection.projectId)+':'+selection.action} lead={{id:selection.leadId,fullName:selection.customer}} actorId={employee.id} lang={lang} isLight={isLight} focusEntryId={selection.entryId} focusProjectId={selection.projectId} initialAction={selection.action} verificationOnly onDetailShown={()=>{if(selection.action!=='view')write(current.current.filters,{...selection,action:'view'});}} onOpenRelated={(entryId:string,projectId?:string)=>{const next={...selection,entryId,projectId,action:'view'};write(filters,next,true);setSelection(next);setDirty(false);}} onClose={close} onDirty={setDirty} onBusy={setBusy} onSaved={()=>{setRefresh(v=>v+1);onQueueChanged();}}/>}
 </>}
 {pending&&<CrmDiscardDialog lang={lang} isLight={isLight} onKeep={()=>setPending(null)} onDiscard={()=>{const action=pending;setPending(null);setDirty(false);action();}}/>}
 </section>;
}

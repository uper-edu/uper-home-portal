import { useEffect, useState } from 'react';
import { enrollmentCopy, enrollmentPost, enrollmentStatuses } from '../EnrollmentApplication';
import { formatCurrency } from '../../utils/currency';
import type { CrmLanguage } from '../../utils/crmLanguage';
import { CrmEnrollmentRefund } from './CrmEnrollmentResolution';
import { enrollmentOpportunityReturnPath } from '../../utils/crmEnrollmentOpportunityRoute';
import { formatCrmEventTime,validateLocalInstant,viewerTimeZone } from '../../utils/crmOperatingTime';
import { AdminField,AdminForm,AdminRequiredNote } from '../AdminForm';
import { AdminFormActions } from '../AdminFormLayout';
import { CrmDisclosure } from './CrmDisclosure';
import { CrmEnrollmentReviewDeadline } from './CrmEnrollmentReviewDeadline';

type Receipt = {reference:string;amount:number;account:string|null;settledAt:string};
type RecordRow = { id: string; name: string; price: number; received: number; opened: boolean; status: string; proofId?: string; firstReviewDueAt?:string; receipts:Receipt[] };
const endpoint = '/api/crm/enrollment/finance';

export function CrmEnrollmentFinance({ lang,isLight=true }: { lang: CrmLanguage;isLight?:boolean }) {
  const t = (zh: string, en: string, id: string) => enrollmentCopy(lang, [zh,en,id]);
  const [orders, setOrders] = useState<RecordRow[]>();
  const [hidden, setHidden] = useState(false);
  const [selected, setSelected] = useState<string>();
  const [requestId, setRequestId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const params = new URLSearchParams(window.location.search);
  const target = params.get('enrollmentOrder');
  const returnTo = target ? enrollmentOpportunityReturnPath(params.get('opportunityReturn')) : null;
  async function load() {
    const response = await fetch(target ? endpoint+'?order='+encodeURIComponent(target) : endpoint, {cache:'no-store'});
    if ([403,404].includes(response.status)) { setHidden(true); return; }
    if (!response.ok) throw Error();
    setOrders((await response.json()).orders);
  }
  const failed = () => setError(t('暂时无法读取报名核款。','Enrollment receipts could not be loaded.','Data pembayaran belum dapat dimuat.'));
  useEffect(() => { void load().catch(failed); }, []);
  useEffect(() => {
    if(!saved)return;
    const timer=window.setTimeout(()=>setSaved(false),6000);
    return ()=>window.clearTimeout(timer);
  },[saved]);
  if (hidden) return null;

  return <section className="crm-course-catalog">
    <header className="admin-edit-header">
      <h2>{t('课程报名核款','Enrollment payment verification','Verifikasi pembayaran pendaftaran')}</h2>
      {returnTo&&!selected?<a className="crm-work-link" href={returnTo}>{t('返回商机列表','Back to opportunities','Kembali ke daftar peluang')}</a>:
        target&&!returnTo&&<a className="crm-work-link" href="/crm?tab=payments">{t('查看全部报名核款','View all enrollment payments','Lihat semua pembayaran')}</a>}
      <button type="button" className="crm-work-button" onClick={() => void load().catch(failed)}>{t('刷新','Refresh','Segarkan')}</button>
    </header>
    {error && <p role="alert">{error}</p>}
    {saved&&<span className="crm-opportunity-feedback" role="status">{t('实收已登记','Verified receipt recorded','Dana terverifikasi telah dicatat')}</span>}
    {orders?.length === 0 && <p>{t('暂无报名订单待核实。','No enrollment payments to verify.','Tidak ada pembayaran untuk diverifikasi.')}</p>}
    {orders?.map(row => <article key={row.id} className="crm-course-catalog">
      <h3 data-admin-form-title>{row.name} · {enrollmentCopy(lang,enrollmentStatuses[row.status])}{selected===row.id&&<AdminRequiredNote lang={lang} inline/>}</h3>
      <p>{row.id} · {formatCurrency(row.received,lang)} / {formatCurrency(row.price,lang)}
        {row.opened && ' · '+t('已确认开班','Class confirmed','Kelas dikonfirmasi')}</p>
      {row.firstReviewDueAt&&<CrmEnrollmentReviewDeadline dueAt={row.firstReviewDueAt} lang={lang}/>}
      {row.proofId && <a href={endpoint+'/proofs/'+encodeURIComponent(row.proofId)}>{t('下载凭证','Download proof','Unduh bukti')}</a>}
      {!!row.receipts?.length&&<CrmDisclosure heading={t('已核实收款流水','Verified receipt history','Riwayat penerimaan terverifikasi')}>
        <ul className="crm-course-records">{row.receipts.map(receipt=><li key={receipt.reference}>
          <strong>{formatCurrency(receipt.amount,lang)}</strong> · <time dateTime={receipt.settledAt}>{formatCrmEventTime(receipt.settledAt)}</time>
          <p>{t('实际收款账户','Actual receiving account','Rekening penerima aktual')} · {receipt.account??t('未记录','Not recorded','Belum dicatat')}</p>
          <p>{t('银行流水号','Bank reference','Nomor referensi bank')} · {receipt.reference}</p>
        </li>)}</ul>
      </CrmDisclosure>}
      {['refunding','refunded'].includes(row.status) ? <CrmEnrollmentRefund id={row.id} lang={lang} isLight={isLight} onUpdate={()=>void load().catch(failed)}/> :
      selected !== row.id ? <button type="button" className="crm-work-button" onClick={() => {
        setSelected(row.id);setRequestId(crypto.randomUUID());setError('');setSaved(false);
      }}>{t('登记实际到账','Record verified receipt','Catat dana terverifikasi')}</button>
      : <AdminForm lang={lang} className="crm-form-layout" onSubmit={async (event:React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (busy) return;
        const form = new FormData(event.currentTarget);
        const localTime=String(form.get('time'));
        const instant=new Date(localTime);
        try{
          validateLocalInstant(localTime,instant,viewerTimeZone());
        }catch{
          setError(t('请核对实际到账日期和时间。','Check the actual receipt date and time.','Periksa tanggal dan waktu dana diterima.'));
          return;
        }
        setError('');setBusy(true);
        try {
          await enrollmentPost(endpoint+'/'+row.id+'/receipts',{amount:Number(form.get('amount')),reference:form.get('reference'),
            receivingAccount:form.get('receivingAccount'),transferredAt:instant.toISOString(),requestId});
          setSaved(true);
          setSelected(undefined);
          await load().catch(failed);
        } catch (cause) {
          setError((cause as Error).message==='enrollment_duplicate_receipt'
            ? t('这笔流水已登记。','This bank reference has already been recorded.','Referensi bank sudah dicatat.')
            : (cause as Error).message==='enrollment_receiving_account_required'
            ? t('请填写实际收款账户。','Enter the actual receiving account.','Isi rekening penerima aktual.')
            : t('未能确认结果，请核对后保留原单重试。','Review the result and retry with the original details.','Periksa hasil lalu coba lagi dengan data yang sama.'));
        } finally {setBusy(false);}
      }}>
        <AdminField>{t('银行流水号','Bank reference','Nomor referensi bank')}<input name="reference" maxLength={120} required/></AdminField>
        <AdminField>{t('实际收款账户','Actual receiving account','Rekening penerima aktual')}
          <input name="receivingAccount" maxLength={160} required autoComplete="off"/>
          <p>{t('按收款系统中的实际入账账户填写。','Enter the account credited in the payment system.','Isi rekening yang menerima dana di sistem pembayaran.')}</p>
        </AdminField>
        <AdminField>{t('实收金额（Rp）','Verified amount (Rp)','Nominal terverifikasi (Rp)')}<input name="amount" type="number" min="1" step="1" required/></AdminField>
        <AdminField>{t('实际到账时间','Actual receipt time','Waktu dana diterima')}<input name="time" type="datetime-local" required/></AdminField>
        <AdminFormActions>
          <button type="button" className="crm-work-button" disabled={busy} onClick={()=>setSelected(undefined)}>{t('取消','Cancel','Batal')}</button>
          <button type="submit" className="crm-work-button" data-primary disabled={busy}>{t('保存到账','Save receipt','Simpan penerimaan')}</button>
        </AdminFormActions>
      </AdminForm>}
    </article>)}
  </section>;
}

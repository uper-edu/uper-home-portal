import { useEffect, useState } from 'react';
import { enrollmentCopy, enrollmentPost, enrollmentStatuses } from '../EnrollmentApplication';
import { formatCurrency } from '../../utils/currency';
import type { CrmLanguage } from '../../utils/crmLanguage';
import { CrmEnrollmentRefund } from './CrmEnrollmentResolution';

type RecordRow = { id: string; name: string; price: number; received: number; opened: boolean; status: string; proofId?: string };
const endpoint = '/api/crm/enrollment/finance';

export function CrmEnrollmentFinance({ lang,isLight=true }: { lang: CrmLanguage;isLight?:boolean }) {
  const t = (zh: string, en: string, id: string) => enrollmentCopy(lang, [zh,en,id]);
  const [orders, setOrders] = useState<RecordRow[]>();
  const [hidden, setHidden] = useState(false);
  const [selected, setSelected] = useState<string>();
  const [requestId, setRequestId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const target = new URLSearchParams(window.location.search).get('enrollmentOrder');
  async function load() {
    const response = await fetch(target ? endpoint+'?order='+encodeURIComponent(target) : endpoint, {cache:'no-store'});
    if ([403,404].includes(response.status)) { setHidden(true); return; }
    if (!response.ok) throw Error();
    setOrders((await response.json()).orders);
  }
  const failed = () => setError(t('暂时无法读取报名核款。','Enrollment receipts could not be loaded.','Data pembayaran belum dapat dimuat.'));
  useEffect(() => { void load().catch(failed); }, []);
  if (hidden) return null;

  return <section className="crm-course-catalog">
    <header className="admin-edit-header">
      <h2>{t('课程报名核款','Enrollment payment verification','Verifikasi pembayaran pendaftaran')}</h2>
      {target&&<a className="crm-work-link" href="/crm?tab=payments">{t('查看全部报名核款','View all enrollment payments','Lihat semua pembayaran')}</a>}
      <button type="button" className="crm-work-button" onClick={() => void load().catch(failed)}>{t('刷新','Refresh','Segarkan')}</button>
    </header>
    {error && <p role="alert">{error}</p>}
    {orders?.length === 0 && <p>{t('暂无报名订单待核实。','No enrollment payments to verify.','Tidak ada pembayaran untuk diverifikasi.')}</p>}
    {orders?.map(row => <article key={row.id} className="crm-course-catalog">
      <h3>{row.name} · {enrollmentCopy(lang,enrollmentStatuses[row.status])}</h3>
      <p>{row.id} · {formatCurrency(row.received,lang)} / {formatCurrency(row.price,lang)}
        {row.opened && ' · '+t('已确认开班','Class confirmed','Kelas dikonfirmasi')}</p>
      {row.proofId && <a href={endpoint+'/proofs/'+encodeURIComponent(row.proofId)}>{t('下载凭证','Download proof','Unduh bukti')}</a>}
      {['refunding','refunded'].includes(row.status) ? <CrmEnrollmentRefund id={row.id} lang={lang} isLight={isLight} onUpdate={()=>void load().catch(failed)}/> :
      selected !== row.id ? <button type="button" className="crm-work-button" onClick={() => {
        setSelected(row.id);setRequestId(crypto.randomUUID());setError('');
      }}>{t('登记实际到账','Record verified receipt','Catat dana terverifikasi')}</button>
      : <form className="crm-form-layout" onSubmit={async event => {
        event.preventDefault();
        if (busy) return;
        const form = new FormData(event.currentTarget);
        const transferredAt = new Date(String(form.get('time'))).toISOString();
        setError('');setBusy(true);
        try {
          await enrollmentPost(endpoint+'/'+row.id+'/receipts',{ amount:Number(form.get('amount')),reference:form.get('reference'),transferredAt,requestId });
          setSelected(undefined);
          await load();
        } catch (cause) {
          setError((cause as Error).message==='enrollment_duplicate_receipt'
            ? t('这笔流水已登记。','This bank reference has already been recorded.','Referensi bank sudah dicatat.')
            : t('未能确认结果，请核对后保留原单重试。','Review the result and retry with the original details.','Periksa hasil lalu coba lagi dengan data yang sama.'));
        } finally {setBusy(false);}
      }}>
        <label>{t('银行流水号','Bank reference','Nomor referensi bank')}<input name="reference" maxLength={120} required/></label>
        <label>{t('实收金额（Rp）','Verified amount (Rp)','Nominal terverifikasi (Rp)')}<input name="amount" type="number" min="1" step="1" required/></label>
        <label>{t('实际到账时间','Actual receipt time','Waktu dana diterima')}<input name="time" type="datetime-local" required/></label>
        <button type="button" className="crm-work-button" disabled={busy} onClick={()=>setSelected(undefined)}>{t('取消','Cancel','Batal')}</button>
        <button type="submit" className="crm-work-button" data-primary disabled={busy}>{t('保存到账','Save receipt','Simpan penerimaan')}</button>
      </form>}
    </article>)}
  </section>;
}

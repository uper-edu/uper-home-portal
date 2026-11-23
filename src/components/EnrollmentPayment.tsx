import {enrollmentProofAccept,enrollmentProofSelectionIssue} from '../utils/enrollmentProofFile';
import type { EnrollmentClosureReason } from '../utils/enrollmentOrderStatus';
import { useEffect, useRef, useState } from 'react';
import { Check, Clock3, Copy, Landmark, Upload } from 'lucide-react';
import { enrollmentTeacherLabel, enrollmentClassTitle, enrollmentScheduleLabel, type PublicEnrollmentClass } from '../utils/enrollmentCatalog';
import { formatCurrency } from '../utils/currency';
import { EnrollmentJoiningNote } from './EnrollmentSupport';
import type { EnrollmentBank } from '../utils/enrollmentBank';

export type EnrollmentOrder = {
  id: string;
  classId: string;
  status: string;
  restored: boolean;
  learnerName?: string;
  closureReason?: EnrollmentClosureReason;
  price: number;
  received: number;
  creditIn?: number;
  creditOut?: number;
  deadline: string;
  bank?: EnrollmentBank;
};

type Language = 'zh' | 'en' | 'id';

export function EnrollmentPayment({ order, course, classInfo, language, status, canUpload, file, busy, setFile, upload, existingTransferOnly = false, proofUploadFailed = false, submittingProof = false, onCancel }: {
  order: EnrollmentOrder;
  course?: PublicEnrollmentClass;
  classInfo?:Partial<PublicEnrollmentClass> & {firstLesson:string;schedule:string;level?:string;format?:string;opened?:boolean};
  language: Language;
  status: string;
  canUpload: boolean;
  file?: File;
  busy: boolean;
  setFile: (file?: File) => void;
  upload: (transfer:{reportedAmount?:number;bankReference?:string}) => void;
  existingTransferOnly?: boolean;
  onCancel?: ()=>void;
  proofUploadFailed?: boolean;
  submittingProof?: boolean;
}) {
  const t = (zh: string, en: string, id: string) => language === 'zh' ? zh : language === 'en' ? en : id;
  const locale = t('zh-CN', 'en-GB', 'id-ID');
  const [now, setNow] = useState(Date.now);
  const [copied, setCopied] = useState('');
  const [copyFailed, setCopyFailed] = useState(false);
  const [fileIssue,setFileIssue]=useState<ReturnType<typeof enrollmentProofSelectionIssue>>();
  const proofInput = useRef<HTMLInputElement>(null);
  const hasBalance = !existingTransferOnly && !!order.bank && ['awaiting_payment','partial'].includes(order.status);
  useEffect(() => {
    if (!file && proofInput.current) proofInput.current.value = '';
  }, [file]);
  useEffect(() => {
    if (!hasBalance) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [hasBalance]);
  useEffect(() => {
    if (!copied && !copyFailed) return;
    const id = window.setTimeout(() => { setCopied(''); setCopyFailed(false); }, 2000);
    return () => window.clearTimeout(id);
  }, [copied, copyFailed]);

  const dayFormat = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', timeZone: 'Asia/Jakarta' });
  const deadline = new Date(order.deadline);
  const minutes = Math.max(0, Math.ceil((deadline.valueOf() - now) / 60000));
  const hours = Math.floor(minutes / 60);
  const shortMinutes = minutes % 60;
  const timeLeft = t(
    '剩余 ' + (hours ? hours + ' 小时 ' : '') + shortMinutes + ' 分钟',
    (hours ? hours + ' hr ' : '') + shortMinutes + ' min left',
    'Sisa ' + (hours ? hours + ' jam ' : '') + shortMinutes + ' mnt',
  );
  const cohort=classInfo??course;
  const schedule=enrollmentScheduleLabel(cohort,language);
  const start = cohort && dayFormat.format(new Date(cohort.firstLesson + ':00+07:00'));
  const title = cohort && enrollmentClassTitle({...course,...classInfo},language);
  const bank = order.bank;
  const bankRows = bank ? [
    [t('银行', 'Bank', 'Bank'), bank.name],
    [t('收款户名', 'Account holder', 'Nama pemilik rekening'), bank.accountName],
    [t('账号', 'Account number', 'Nomor rekening'), bank.accountNumber],
    [t('备注', 'Transfer reference', 'Catatan transfer'), order.id],
  ] : [];
  const chooseProof = t('选择凭证', 'Choose proof', 'Pilih bukti');
  const balance = Math.max(0, order.price - order.received);
  const amountLabel = order.received ? t('剩余应付', 'Remaining balance', 'Sisa tagihan') : t('应付金额', 'Amount due', 'Jumlah tagihan');

  async function copyValue(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopyFailed(false);
      setCopied(label);
    } catch {
      setCopied('');
      setCopyFailed(true);
    }
  }

  const copyButton = (label: string, value: string) =>
    <button className="enrollment-copy" type="button" onClick={() => void copyValue(label, value)}
      aria-label={t('复制' + label, 'Copy ' + label, 'Salin ' + label)}>
      {copied === label ? <Check size={16} aria-hidden="true"/> : <Copy size={16} aria-hidden="true"/>}
    </button>;

  return <>
    <div className="enrollment-payment-summary">
      <h2>{title || status}</h2>
      {cohort&&<p>{[enrollmentTeacherLabel(cohort.teacherType,language),start&&(cohort.opened?t(start+'开课','Starts '+start,'Mulai '+start):t('首课 '+start,'First session '+start,'Pertemuan pertama '+start))].filter(Boolean).join(' · ')}</p>}
      {schedule&&<p>{schedule}</p>}
      {hasBalance && <EnrollmentJoiningNote firstLesson={cohort?.firstLesson} now={now} language={language}/>}
      {course && order.status !== 'awaiting_payment' && <p className="enrollment-payment-status">{status}</p>}
      {!bank && <p>{t('报名编号', 'Order number', 'Nomor pendaftaran')} · {order.id}</p>}
      {!!order.creditIn&&<p>{t('旧订单已冲抵','Credit applied from an earlier order','Dana pesanan sebelumnya yang digunakan')} · {formatCurrency(order.creditIn,language)}</p>}
    </div>
    {order.status === 'awaiting_payment' && Number.isFinite(deadline.valueOf()) && <div className="enrollment-payment-deadline">
      <span><Clock3 size={16} aria-hidden="true"/>{minutes ? timeLeft : t('付款时间已到', 'Payment deadline reached', 'Batas pembayaran tercapai')}</span>
      <time dateTime={deadline.toISOString()}>{dayFormat.format(deadline)} {new Intl.DateTimeFormat(locale, {
        hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Jakarta',
      }).format(deadline)} WIB <span>{t('截止', 'deadline', 'batas')}</span></time>
    </div>}
    {bank ? <>
      <div className="enrollment-payment-amount">
        <div><small>{amountLabel}</small><strong>{formatCurrency(balance, language)}</strong></div>
        {copyButton(amountLabel, String(balance))}
      </div>
      <section className="enrollment-payment-section">
        <h2><Landmark size={18} aria-hidden="true"/>{t('银行转账', 'Bank transfer', 'Transfer bank')}</h2>
        <dl className="enrollment-bank">
          {bankRows.map(([label, value]) => <div key={label}>
            <dt>{label}</dt>
            <dd><span>{value}</span>{copyButton(label, value)}</dd>
          </div>)}
        </dl>
        <span className="sr-only" role="status">{copied ? t('已复制' + copied, 'Copied ' + copied, copied + ' disalin') :
          copyFailed ? t('复制失败，请手动复制。', 'Could not copy. Select the value to copy it.', 'Gagal menyalin. Salin nilainya secara manual.') : ''}</span>
        <p className="enrollment-payment-test-note">{t('模拟账号，请勿转账。', 'Test account. Do not transfer funds.', 'Rekening uji. Jangan transfer dana.')}</p>
      </section>
    </> : <div className="enrollment-payment-summary">
      {existingTransferOnly ? <p>{t('原付款入口已关闭。此处可提交已发生的转账记录。','The original payment link is closed. Only submit proof of a transfer you already made.','Pembayaran awal telah ditutup. Kirim bukti transfer yang sudah dilakukan.')}</p>
        : <p>{t('实际到账', 'Verified receipts', 'Dana terverifikasi')} · {formatCurrency(order.received, language)}</p>}
    </div>}
    {proofUploadFailed && <p className="enrollment-result-state" role="alert">{t(
      '付款凭证上传失败，请重试。','The payment proof could not be uploaded. Try again.','Bukti pembayaran gagal diunggah. Coba lagi.',
    )}</p>}
    {canUpload && <form className="enrollment-payment-form" onSubmit={event => {
      event.preventDefault();
      const fields=new FormData(event.currentTarget);
      const amount=String(fields.get('reportedAmount')??'').trim();
      const bankReference=String(fields.get('bankReference')??'').trim()||undefined;
      upload({reportedAmount:amount?Number(amount):undefined,bankReference});
    }}>
      <section className="enrollment-upload-section">
        <h2>{t('转账凭证', 'Transfer proof', 'Bukti transfer')}</h2>
        <label className="enrollment-file">
          <input ref={proofInput} aria-label={chooseProof} type="file" accept={enrollmentProofAccept+',.png,.jpg,.jpeg,.pdf'}
            required={!file} disabled={busy}
            aria-invalid={fileIssue ? true : undefined} aria-describedby={fileIssue ? 'enrollment-proof-file-issue' : undefined}
            onChange={event => {
              const selected=event.target.files?.[0];
              const issue=selected ? enrollmentProofSelectionIssue(selected) : undefined;
              setFileIssue(issue);
              if(issue)event.target.value='';
              setFile(issue?undefined:selected);
            }}/>
          <span>{file?.name || t('银行回执或截图', 'Bank receipt or screenshot', 'Bukti bank atau tangkapan layar')}</span>
          <strong><Upload size={15} aria-hidden="true"/>{chooseProof}</strong>
        </label>
        {fileIssue&&<p id="enrollment-proof-file-issue" className="enrollment-result-state" role="alert">
          {fileIssue==='too_large'
            ? t('凭证不能超过 2 MB，请选小一点的文件。','Choose a proof file no larger than 2 MB.','Pilih file bukti berukuran maksimal 2 MB.')
            : t('请选择有效的 PNG、JPEG 或 PDF 文件。','Choose a valid PNG, JPEG or PDF file.','Pilih file PNG, JPEG, atau PDF yang valid.')}
        </p>}
        <div className="enrollment-proof-transfer">
          <label>{t('转账金额（Rp，选填）','Transfer amount (Rp, optional)','Nominal transfer (Rp, opsional)')}
            <input name="reportedAmount" type="number" inputMode="numeric" min="1" max="1000000000" step="1" disabled={busy}/>
          </label>
          <label>{t('银行流水号（选填）','Bank reference (optional)','Referensi bank (opsional)')}
            <input name="bankReference" maxLength={120} autoComplete="off" disabled={busy}/>
          </label>
          <p>{t('请按银行回执填写。财务会核对实际到账。','Use the details on your bank receipt. Finance will verify the amount received.','Isi sesuai bukti bank. Tim keuangan akan memverifikasi dana yang diterima.')}</p>
        </div>
      </section>
      <div className="enrollment-proof-actions enrollment-payment-actions">
        {onCancel&&<button className="enrollment-quiet" type="button" disabled={busy} onClick={onCancel}>{t('取消报名','Cancel enrollment','Batalkan pendaftaran')}</button>}
        {!existingTransferOnly && <p>{t('财务核实足额到账后，报名才算成功。', 'Enrollment is confirmed after Finance verifies full payment.', 'Pendaftaran berhasil setelah pembayaran penuh diverifikasi.')}</p>}
        <button className="enrollment-primary" type="submit" disabled={busy || !file} aria-busy={submittingProof}>{submittingProof
          ? t('正在提交凭证…','Submitting proof…','Mengirim bukti…')
          : existingTransferOnly
          ? t('提交已转账凭证','Submit proof of an existing transfer','Kirim bukti transfer yang sudah dilakukan')
          : proofUploadFailed ? t('重新提交凭证','Retry proof submission','Coba kirim bukti lagi')
            : t('提交凭证', 'Submit proof', 'Kirim bukti')}</button>
      </div>
    </form>}
  </>;
}

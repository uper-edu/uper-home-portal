import { useEffect, useRef, useState } from 'react';
import { Check, Clock3, Copy, Landmark, Upload } from 'lucide-react';
import type { PublicEnrollmentClass } from '../utils/enrollmentCatalog';
import { formatCurrency } from '../utils/currency';

export type EnrollmentOrder = {
  id: string;
  classId: string;
  status: string;
  restored: boolean;
  learnerName?: string;
  price: number;
  received: number;
  deadline: string;
  bank?: { name: string; accountName: string; accountNumber: string };
};

type Language = 'zh' | 'en' | 'id';

export function EnrollmentPayment({ order, course, schedule, language, status, canUpload, file, busy, setFile, upload, existingTransferOnly = false, proofUploadFailed = false }: {
  order: EnrollmentOrder;
  course?: PublicEnrollmentClass;
  schedule?: string;
  language: Language;
  status: string;
  canUpload: boolean;
  file?: File;
  busy: boolean;
  setFile: (file?: File) => void;
  upload: () => void;
  existingTransferOnly?: boolean;
  proofUploadFailed?: boolean;
}) {
  const t = (zh: string, en: string, id: string) => language === 'zh' ? zh : language === 'en' ? en : id;
  const locale = t('zh-CN', 'en-GB', 'id-ID');
  const [now, setNow] = useState(Date.now);
  const [copied, setCopied] = useState('');
  const [copyFailed, setCopyFailed] = useState(false);
  const proofInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!file && proofInput.current) proofInput.current.value = '';
  }, [file]);
  useEffect(() => {
    if (order.status !== 'awaiting_payment') return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [order.status]);
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
  const start = course && dayFormat.format(new Date(course.firstLesson + ':00+07:00'));
  const title = course && [
    course.level,
    course.format === 'standard' ? t('标准班', 'Standard class', 'Kelas standar') : t('小班', 'Small group', 'Kelas kecil'),
    course.opened ? t(start + '开课', 'Starts ' + start, 'Mulai ' + start) : t('预计 ' + start + '开课', 'Expected ' + start, 'Perkiraan ' + start),
  ].join(' · ');
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
      {(course?.schedule || schedule) && <p>{course?.schedule || schedule}</p>}
      {course && order.status !== 'awaiting_payment' && <p className="enrollment-payment-status">{status}</p>}
      {!bank && <p>{t('报名编号', 'Order number', 'Nomor pendaftaran')} · {order.id}</p>}
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
    {canUpload && <form className="enrollment-payment-form" onSubmit={event => { event.preventDefault(); upload(); }}>
      <section className="enrollment-upload-section">
        <h2>{t('转账凭证', 'Transfer proof', 'Bukti transfer')}</h2>
        <label className="enrollment-file">
          <input ref={proofInput} aria-label={chooseProof} type="file" accept="image/png,image/jpeg,application/pdf" required
            onChange={event => setFile(event.target.files?.[0])}/>
          <span>{file?.name || t('银行回执或截图', 'Bank receipt or screenshot', 'Bukti bank atau tangkapan layar')}</span>
          <strong><Upload size={15} aria-hidden="true"/>{chooseProof}</strong>
        </label>
      </section>
      <div className="enrollment-proof-actions enrollment-payment-actions">
        {!existingTransferOnly && <p>{t('财务核实足额到账后，报名才算成功。', 'Enrollment is confirmed after Finance verifies full payment.', 'Pendaftaran berhasil setelah pembayaran penuh diverifikasi.')}</p>}
        <button className="enrollment-primary" type="submit" disabled={busy || !file}>{existingTransferOnly
          ? t('提交已转账凭证','Submit proof of an existing transfer','Kirim bukti transfer yang sudah dilakukan')
          : proofUploadFailed ? t('重新提交凭证','Retry proof submission','Coba kirim bukti lagi')
            : t('提交凭证', 'Submit proof', 'Kirim bukti')}</button>
      </div>
    </form>}
  </>;
}

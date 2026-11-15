import { ArrowLeft, CircleCheck, Clock3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatCurrency } from '../utils/currency';
import { enrollmentOpeningNotice,type PublicEnrollmentClass } from '../utils/enrollmentCatalog';
import { useEnrollmentOpeningClock } from '../utils/useEnrollmentOpeningClock';
import type { EnrollmentOrder } from './EnrollmentPayment';
import { enrollmentSupportPath } from './EnrollmentSupport';
import { interestOption, interestText, type InterestLanguage } from './EnrollmentInterests';

type Copy = readonly [string, string, string];

export function EnrollmentOrderResult({ order, course, classInfo, classState, language, backPath, uploadPath, refundPath, balancePath, busy, onRefresh }: {
  order: EnrollmentOrder;
  course?: PublicEnrollmentClass;
  classInfo?: {firstLesson:string;schedule:string;level?:string;format?:string;decisionAt?:string;opened?:boolean};
  classState?: string;
  language: InterestLanguage;
  backPath: string;
  uploadPath?: string;
  refundPath?: string;
  balancePath?: string;
  busy: boolean;
  onRefresh: () => void;
}) {
  const t = (text: Copy) => interestText(language,text);
  const paid = order.status === 'paid';
  const partial = order.status === 'partial';
  const opened = classInfo?.opened??course?.opened;
  const cancelled = classState === 'cancelled';
  const dateFormat = new Intl.DateTimeFormat(t(['zh-CN','en-GB','id-ID']),{
    month:'long',day:'numeric',timeZone:'Asia/Jakarta',
  });
  function day(value?: string) {
    const date = value && new Date(value.slice(0,10)+'T00:00:00+07:00');
    return date && Number.isFinite(date.valueOf()) ? dateFormat.format(date) : '';
  }
  const courseDay = day(course?.firstLesson ?? classInfo?.firstLesson);
  const openingClock=useEnrollmentOpeningClock();
  const classFormat=classInfo?.format??course?.format;
  const schedule = classInfo?.schedule || course?.schedule;
  const openingDate = courseDay && (opened
    ? t([courseDay+'开课','Starts '+courseDay,'Mulai '+courseDay])
    : opened===false && !cancelled
      ? t(['预计 '+courseDay+'开课','Expected '+courseDay,'Perkiraan '+courseDay])
      : courseDay);
  const title = [classInfo?.level??course?.level,classFormat&&interestOption(language,classFormat),openingDate].filter(Boolean).join(' · ');
  const openingUpdate=opened||cancelled?'':enrollmentOpeningNotice(classInfo?.decisionAt??course?.decisionAt,language,openingClock);
  const back = t(['返回我的报名','Back to my enrollments','Kembali ke pendaftaran saya']);
  const support = t(['联系销售或客服','Contact sales or support','Hubungi tim penjualan atau layanan pelanggan']);

  return <div className="enrollment-order-result">
    <Link className="enrollment-back" to={backPath}><ArrowLeft size={15} aria-hidden="true"/>{back}</Link>
    <h1>{t(['报名详情','Enrollment details','Detail pendaftaran'])}</h1>
    <div className="enrollment-result-body">
      <article className="enrollment-record">
        <h2>{title || t(['报名编号','Order number','Nomor pendaftaran'])+' · '+order.id}</h2>
        {cancelled ? <p>{t(['原班已确认不开班。','The original class will not open.','Kelas asal tidak dibuka.'])}</p>
          : opened && <p>{t(['已确认开班','Class opening confirmed','Pembukaan kelas dikonfirmasi'])}</p>}
        {!paid && schedule && <p>{schedule}</p>}
      </article>
      <p className="enrollment-result-state" data-paid={paid} role="status">
        {paid ? <CircleCheck size={19} aria-hidden="true"/> : <Clock3 size={19} aria-hidden="true"/>}
        {t(paid ? ['已核实足额到账 · 报名成功','Full payment verified · Enrollment confirmed','Pembayaran penuh terverifikasi · Pendaftaran berhasil']
          : partial ? ['已收到部分款项 · 待补款','Partial payment received · Balance due','Pembayaran sebagian diterima · Sisa tagihan']
          : ['凭证已提交 · 待核实到账','Proof submitted · Awaiting payment verification','Bukti dikirim · Menunggu verifikasi pembayaran'])}
      </p>
      {paid || partial ? <>
        <article className="enrollment-record">
          <h2>{t(['收款进度','Payment progress','Status pembayaran'])}</h2>
          <dl className="enrollment-result-amounts">
            <div><dt>{t(['应付','Amount due','Jumlah tagihan'])}</dt><dd>{formatCurrency(order.price,language)}</dd></div>
            <div><dt>{t(['已核实到账','Verified receipts','Dana terverifikasi'])}</dt><dd>{formatCurrency(order.received,language)}</dd></div>
            {partial&&<div><dt>{t(['还需补款','Balance due','Sisa tagihan'])}</dt><dd>{formatCurrency(Math.max(0,order.price-order.received),language)}</dd></div>}
          </dl>
          {partial&&<p>{t(['你的报名和席位继续保留。销售运营会和你确认补款安排。','Your enrollment and seat stay reserved. Sales operations will confirm how to pay the balance.','Pendaftaran dan kursi tetap disimpan. Tim penjualan akan mengonfirmasi cara melunasi sisa tagihan.'])}</p>}
        </article>
        {paid && schedule && <article className="enrollment-record">
          <h2>{t(['每周上课时间','Weekly schedule','Jadwal mingguan'])}</h2><p>{schedule}</p>
        </article>}
        {paid && !cancelled && opened===false && <article className="enrollment-record">
          <h2>{t(['开班结果','Class opening','Pembukaan kelas'])}</h2>
          <p>{openingUpdate||t(['待成班','Awaiting class confirmation','Menunggu konfirmasi kelas'])}</p>
        </article>}
      </> : <article className="enrollment-record">
        <h2>{t(['下一步','What happens next','Langkah berikutnya'])}</h2>
        <p>{t(['财务会核对实际到账，你可以在这里查看进度。','Finance will check whether the payment arrived. You can follow the status here.','Tim keuangan akan memeriksa dana yang masuk. Anda dapat melihat statusnya di sini.'])}</p>
        {!cancelled && (course || classState==='published') && <p>{t(['你的席位继续保留。','Your seat stays reserved.','Kursi Anda tetap disimpan.'])}</p>}
        {!opened && !cancelled && openingUpdate && <p>{openingUpdate}</p>}
      </article>}
      <div className="enrollment-result-tools">
        <button type="button" className="enrollment-quiet" disabled={busy} onClick={onRefresh}>{t(['刷新状态','Refresh status','Muat ulang status'])}</button>
        {balancePath ? <Link className="enrollment-quiet" to={balancePath}>{t(['查看剩余应付','View remaining payment','Lihat sisa tagihan'])}</Link>
          : uploadPath && <Link className="enrollment-quiet" to={uploadPath}>{t(['补交凭证','Submit another proof','Kirim bukti tambahan'])}</Link>}
        {refundPath && <Link className="enrollment-quiet" to={refundPath}>{t(['退款咨询','Refund assistance','Bantuan pengembalian dana'])}</Link>}
      </div>
      <div className="enrollment-journey-actions">
        {!partial&&<Link className="enrollment-quiet" to={enrollmentSupportPath(paid?'advisor':'payment',language)}>{support}</Link>}
        <Link className="enrollment-primary" to={partial?enrollmentSupportPath('payment',language):backPath}>
          {partial?t(['联系销售运营','Contact sales operations','Hubungi tim penjualan']):back}</Link>
      </div>
    </div>
  </div>;
}

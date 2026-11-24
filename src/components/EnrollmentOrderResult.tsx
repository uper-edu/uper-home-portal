import {EnrollmentOrderInformation,EnrollmentPriceActions,EnrollmentRecordActions,EnrollmentRecordSummary} from './EnrollmentRecordLayout';
import {EnrollmentJourneyLink} from './EnrollmentJourneyLink';
import { formatCurrency } from '../utils/currency';
import {enrollmentScheduleLabel, enrollmentClassTitle, type PublicEnrollmentClass } from '../utils/enrollmentCatalog';
import { useEnrollmentOpeningClock } from '../utils/useEnrollmentOpeningClock';
import type { EnrollmentOrder } from './EnrollmentPayment';
import { EnrollmentJoiningNote, enrollmentSupportPath } from './EnrollmentSupport';
import { interestText, type InterestLanguage } from '../utils/enrollmentInterestCopy';
import type {AftercareCourse} from '../utils/enrollmentAftercare';
import {enrollmentOrderTone} from '../utils/enrollmentOrderStatus';

type Copy = readonly [string, string, string];

export function EnrollmentOrderResult({ order, identity, course, classInfo, classState, language, uploadPath, refundPath, balancePath, busy }: {
  order: EnrollmentOrder;
  identity?: React.ReactNode;
  course?: PublicEnrollmentClass;
  classInfo?: AftercareCourse;
  classState?: string;
  language: InterestLanguage;
  uploadPath?: string;
  refundPath?: string;
  balancePath?: string;
  busy: boolean;
}) {
  const t = (text: Copy) => interestText(language,text);
  const paid = order.status === 'paid';
  const partial = order.status === 'partial';
  const payableBalance = partial&&balancePath;
  const opened = classInfo?.opened??course?.opened;
  const cancelled = classState === 'cancelled';
  const firstLesson=classInfo?.firstLesson??course?.firstLesson;
  const openingClock=useEnrollmentOpeningClock(!paid&&!cancelled?firstLesson:undefined,order.serverClockOffsetMs);
  const schedule = enrollmentScheduleLabel(classInfo,language) || enrollmentScheduleLabel(course,language);
  const title = enrollmentClassTitle({...course,...classInfo},language);
  const support = t(['联系销售或客服','Contact sales or support','Hubungi tim penjualan atau layanan pelanggan']);

  return <div className="enrollment-order-result">
    <div className="enrollment-result-body">
      <EnrollmentRecordSummary language={language} teacherType={classInfo?.teacherType??course?.teacherType} firstLesson={!cancelled?firstLesson:undefined} title={title||t(['班次报名','Class application','Pendaftaran kelas'])} schedule={schedule}
        tone={enrollmentOrderTone(order.status,{restored:order.restored,needsAction:!!payableBalance})} status={t(paid
          ? ['报名成功','Enrollment confirmed','Pendaftaran berhasil']
          : partial ? ['部分到账','Partially paid','Pembayaran sebagian']
          : ['待核实到账','Awaiting verification','Menunggu verifikasi'])}>
        {cancelled ? <p>{t(['原班已确认不开班。','The original class will not open.','Kelas asal tidak dibuka.'])}</p>
          : opened && <p>{t(['已确认开班','Class opening confirmed','Pembukaan kelas dikonfirmasi'])}</p>}
        {!paid && !cancelled && <EnrollmentJoiningNote firstLesson={firstLesson}
          now={openingClock} language={language}/>}
      </EnrollmentRecordSummary>
      {(paid || partial) && <>
        <section className="enrollment-detail-section">
          <h2 className="enrollment-record-section-title">{t(['收款进度','Payment progress','Status pembayaran'])}</h2>
          <dl className="enrollment-result-amounts">
            <div><dt>{t(['应付','Amount due','Jumlah tagihan'])}</dt><dd>{formatCurrency(order.price,language)}</dd></div>
            {(!order.creditIn||order.received>order.creditIn)&&<div><dt>{t(['本单已核实到账','Verified receipts on this order','Dana terverifikasi untuk pesanan ini'])}</dt><dd>{formatCurrency(order.received-(order.creditIn??0),language)}</dd></div>}
            {!!order.creditIn&&<div><dt>{t(['旧订单已冲抵','Credit applied from an earlier order','Dana dari pesanan sebelumnya'])}</dt><dd>{formatCurrency(order.creditIn,language)}</dd></div>}
            {partial&&!payableBalance&&<div><dt>{t(['还需补款','Balance due','Sisa tagihan'])}</dt><dd className="enrollment-main-amount">{formatCurrency(Math.max(0,order.price-order.received),language)}</dd></div>}
          </dl>
          {partial&&<p>{t(balancePath
            ? ['你的席位继续保留。请核对剩余金额和转账信息。','Your seat stays reserved. Check your balance and transfer details.','Kursi tetap disimpan. Periksa sisa tagihan dan rincian transfer.']
            : ['你的席位继续保留。销售运营会和你确认补款安排。','Your seat stays reserved. Sales operations will confirm how to pay the balance.','Kursi tetap disimpan. Tim penjualan akan mengonfirmasi cara melunasi sisa tagihan.'])}</p>}
        </section>
      </>}
      <EnrollmentOrderInformation order={order} language={language} identity={identity}/>
      {!paid&&!partial&&<section className="enrollment-detail-section">
        <h2 className="enrollment-record-section-title">{t(['下一步','What happens next','Langkah berikutnya'])}</h2>
        <p>{t(['财务会核对实际到账，你可以在这里查看进度。','Finance will check whether the payment arrived. You can follow the status here.','Tim keuangan akan memeriksa dana yang masuk. Anda dapat melihat statusnya di sini.'])}</p>
        {!cancelled && (course || classState==='published') && <p>{t(['你的席位继续保留。','Your seat stays reserved.','Kursi Anda tetap disimpan.'])}</p>}
        <p><EnrollmentJourneyLink className="enrollment-quiet" stepEntry="enrollment-review-help" to={enrollmentSupportPath('payment',language)}>{support}</EnrollmentJourneyLink></p>
      </section>}
      {payableBalance&&refundPath&&<EnrollmentJourneyLink className="enrollment-quiet enrollment-detail-cancel" to={refundPath}>
        {t(['退款咨询','Refund assistance','Bantuan pengembalian dana'])}
      </EnrollmentJourneyLink>}
      {payableBalance&&<EnrollmentPriceActions label={t(['剩余应付','Remaining balance','Sisa tagihan'])}
        amount={Math.max(0,order.price-order.received)} language={language}>
        <EnrollmentJourneyLink className="enrollment-primary" stepEntry="enrollment-balance-step" to={payableBalance}>
          {t(['查看补款','View balance','Lihat sisa tagihan'])}
        </EnrollmentJourneyLink>
      </EnrollmentPriceActions>}
      {!payableBalance&&<EnrollmentRecordActions primary={partial
        ? <EnrollmentJourneyLink className="enrollment-primary" stepEntry="enrollment-balance-step" to={enrollmentSupportPath('payment',language)}>
          {t(['联系销售运营','Contact sales operations','Hubungi tim penjualan'])}
        </EnrollmentJourneyLink> : undefined}
        secondary={<>
          {!balancePath&&uploadPath&&<EnrollmentJourneyLink className="enrollment-outline enrollment-proof-follow-up" stepEntry="enrollment-additional-proof" to={uploadPath}>
            {t(['补交凭证','Submit another proof','Kirim bukti tambahan'])}
          </EnrollmentJourneyLink>}
          {refundPath&&<EnrollmentJourneyLink className="enrollment-quiet" to={refundPath}>
            {t(['退款咨询','Refund assistance','Bantuan pengembalian dana'])}
          </EnrollmentJourneyLink>}
          {paid&&<EnrollmentJourneyLink className="enrollment-quiet" stepEntry="enrollment-paid-help" to={enrollmentSupportPath('advisor',language)}>{support}</EnrollmentJourneyLink>}
        </>}/>}
    </div>
  </div>;
}

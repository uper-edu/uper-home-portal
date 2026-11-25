import {EnrollmentDetailActions,EnrollmentOrderInformation,EnrollmentPriceActions,EnrollmentRecordActions,EnrollmentRecordSummary} from './EnrollmentRecordLayout';
import {EnrollmentJourneyLink} from './EnrollmentJourneyLink';
import { formatCurrency } from '../utils/currency';
import {enrollmentScheduleLabel, enrollmentClassTitle, type PublicEnrollmentClass } from '../utils/enrollmentCatalog';
import { useEnrollmentOpeningClock } from '../utils/useEnrollmentOpeningClock';
import type { EnrollmentOrder } from './EnrollmentPayment';
import {EnrollmentJoiningNote} from './EnrollmentJoiningNote';
import {enrollmentSupportPath} from '../utils/enrollmentSupportNavigation';
import { interestText, type InterestLanguage } from '../utils/enrollmentInterestCopy';
import type {AftercareCourse} from '../utils/enrollmentAftercare';
import {enrollmentOrderTone} from '../utils/enrollmentOrderStatus';
import {EnrollmentPaymentInformation,EnrollmentSubmittedTransfers} from './EnrollmentPaymentInformation';
import {enrollmentDateFormatter} from '../utils/enrollmentDateFormat';

type Copy = readonly [string, string, string];

export function EnrollmentOrderResult({ order, enrollmentDetail, verifiedEmail, course, classInfo, classState, language, uploadPath, refundPath, balancePath, busy }: {
  order: EnrollmentOrder;
  enrollmentDetail: boolean;
  verifiedEmail?: string;
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
  const inReview = !paid&&!partial;
  const payableBalance = !order.payment||order.payment.action==='top_up' ? balancePath : undefined;
  const estimated = order.payment?.estimated;
  const pendingProof=!!order.transfers?.some(row=>row.verifiedAmount===undefined);
  const paymentWaiting = inReview||order.payment?.action==='wait';
  const showReviewActions = enrollmentDetail&&paymentWaiting&&!payableBalance;
  const opened = classInfo?.opened??course?.opened;
  const cancelled = classState === 'cancelled';
  const firstLesson=classInfo?.firstLesson??course?.firstLesson;
  const openingClock=useEnrollmentOpeningClock(!paid&&!cancelled?firstLesson:undefined,order.serverClockOffsetMs);
  const schedule = enrollmentScheduleLabel(classInfo,language) || enrollmentScheduleLabel(course,language);
  const title = enrollmentClassTitle({...course,...classInfo},language);
  const support = t(['联系销售或客服','Contact sales or support','Hubungi tim penjualan atau layanan pelanggan']);
  const reviewHelp=paymentWaiting&&<EnrollmentJourneyLink className="enrollment-quiet" stepEntry="enrollment-review-help"
    to={enrollmentSupportPath('payment',language)}>{support}</EnrollmentJourneyLink>;
  const proofAction=!payableBalance&&uploadPath&&<EnrollmentJourneyLink className="enrollment-outline enrollment-proof-follow-up"
    stepEntry="enrollment-additional-proof" to={uploadPath}>
    {t(['补交已转账凭证','Submit proof for an existing transfer','Kirim bukti transfer yang sudah dilakukan'])}
  </EnrollmentJourneyLink>;
  const refundAction=refundPath&&<EnrollmentJourneyLink className="enrollment-quiet" to={refundPath}>
    {t(['退款咨询','Refund assistance','Bantuan pengembalian dana'])}
  </EnrollmentJourneyLink>;
  const reviewDescription=paymentWaiting?<p>
    {t(['财务正在核对到账。','Finance is checking your payment.','Tim keuangan sedang memeriksa pembayaran.'])}
    {!cancelled&&(course||classState==='published')&&' '+t([
      '核验期间，你的席位继续保留。','Your seat stays reserved during review.','Kursi Anda tetap disimpan.',
    ])}
  </p>:undefined;
  const hasReviewDeadline=inReview&&!!payableBalance&&Number.isFinite(Date.parse(order.deadline));
  const balance=order.payment?.balance??Math.max(0,order.price-order.received);
  const reportedPartial=estimated&&(order.payment?.balance??0)>0;
  const balanceLabel=estimated?t(['预计剩余应付','Estimated balance','Perkiraan sisa tagihan']):t(['剩余应付','Remaining balance','Sisa tagihan']);

  return <div className="enrollment-order-result">
    <div className="enrollment-result-body">
      <EnrollmentRecordSummary language={language} teacherType={classInfo?.teacherType??course?.teacherType} firstLesson={!cancelled?firstLesson:undefined} title={title||t(['班次报名','Class application','Pendaftaran kelas'])} schedule={schedule}
        sessions={classInfo?.sessions??course?.sessions} minutes={classInfo?.minutes??course?.minutes}
        statusSection={enrollmentDetail?{kind:'enrollment',description:reviewDescription,fields:[
          [t(['付款截止','Payment deadline','Batas pembayaran']),hasReviewDeadline&&<time dateTime={order.deadline}>
            {enrollmentDateFormatter(language,'dateTime').format(new Date(order.deadline))} WIB
          </time>],
        ]}:undefined}
        tone={enrollmentOrderTone(order.status,{restored:order.restored,needsAction:!!payableBalance&&(reportedPartial||!paymentWaiting&&!pendingProof)})} status={t(paid
          ? ['报名成功','Enrollment confirmed','Pendaftaran berhasil']
          : reportedPartial ? ['部分交款','Partial payment reported','Transfer sebagian dilaporkan']
            : partial ? ['部分到账','Partially paid','Dibayar sebagian']
            : ['凭证待财务核实','Proof awaiting verification','Bukti menunggu verifikasi'])}>
        {cancelled ? <p>{t(['原班已确认不开班。','The original class will not open.','Kelas asal tidak dibuka.'])}</p>
          : opened && <p>{t(['已确认开班','Class opening confirmed','Pembukaan kelas dikonfirmasi'])}</p>}
        {!paid && !cancelled && <EnrollmentJoiningNote firstLesson={firstLesson}
          now={openingClock} language={language}/>}
      </EnrollmentRecordSummary>
      <EnrollmentPaymentInformation order={order} language={language} includeBalance={!payableBalance}/>
      {paymentWaiting&&!payableBalance&&<p>{t(['请等待核验。如果已有转账，可以提交对应凭证。','Please wait for verification. If you already transferred funds, you can submit the proof.','Tunggu hasil verifikasi. Jika sudah transfer, Anda dapat mengirim buktinya.'])}</p>}
      <EnrollmentSubmittedTransfers transfers={order.transfers} language={language}/>
      <EnrollmentOrderInformation order={order} language={language} verifiedEmail={verifiedEmail}/>
      {inReview&&!enrollmentDetail&&<section className="enrollment-detail-section">
        <h2 className="enrollment-record-section-title">{t(['下一步','What happens next','Langkah berikutnya'])}</h2>
        <p>{t(['财务会核对实际到账，你可以在这里查看进度。','Finance will check whether the payment arrived. You can follow the status here.','Tim keuangan akan memeriksa dana yang masuk. Anda dapat melihat statusnya di sini.'])}</p>
        {!cancelled && (course || classState==='published') && <p>{t(['你的席位继续保留。','Your seat stays reserved.','Kursi Anda tetap disimpan.'])}</p>}
      </section>}
      {payableBalance&&refundPath&&<EnrollmentJourneyLink className="enrollment-quiet enrollment-detail-cancel" to={refundPath}>
        {t(['退款咨询','Refund assistance','Bantuan pengembalian dana'])}
      </EnrollmentJourneyLink>}
      {payableBalance&&<EnrollmentPriceActions label={balanceLabel}
        amount={balance} language={language} secondaryLink={reviewHelp}>
        <EnrollmentJourneyLink className="enrollment-primary" stepEntry="enrollment-balance-step" to={payableBalance}>
          {t(['补缴余款','Pay remaining balance','Lunasi sisa pembayaran'])}
        </EnrollmentJourneyLink>
      </EnrollmentPriceActions>}
      {showReviewActions
        ? <EnrollmentDetailActions secondaryLink={reviewHelp} additional={refundAction}>{proofAction}</EnrollmentDetailActions>
        : !payableBalance&&<EnrollmentRecordActions primary={order.payment?.action==='support'||!order.payment&&partial
        ? <EnrollmentJourneyLink className="enrollment-primary" stepEntry="enrollment-balance-step" to={enrollmentSupportPath('payment',language)}>
          {support}
        </EnrollmentJourneyLink> : undefined}
        secondary={<>
          {reviewHelp}
          {proofAction}
          {refundAction}
          {paid&&<EnrollmentJourneyLink className="enrollment-quiet" stepEntry="enrollment-paid-help" to={enrollmentSupportPath('advisor',language)}>{support}</EnrollmentJourneyLink>}
        </>}/>}
    </div>
  </div>;
}

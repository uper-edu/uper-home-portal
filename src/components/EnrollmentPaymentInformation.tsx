import type {EnrollmentOrder} from './EnrollmentPayment';
import {EnrollmentDetailFields,EnrollmentDetailSection,EnrollmentStatusBadge} from './EnrollmentRecordLayout';
import {enrollmentDateFormatter} from '../utils/enrollmentDateFormat';
import {enrollmentCopy} from '../utils/enrollmentCatalog';
import {formatCurrency} from '../utils/currency';
import type {EnrollmentLearnerTransfer} from '../utils/enrollmentLearnerPayments';

type Language='zh'|'en'|'id';

export function EnrollmentPaymentInformation({order,language,includeBalance=true}:{
  order:EnrollmentOrder;language:Language;includeBalance?:boolean;
}) {
  const t=(labels:readonly [string,string,string])=>enrollmentCopy(language,labels);
  const money=(amount:number)=>formatCurrency(amount,language);
  const balance=order.payment?.balance;
  const estimated=order.payment?.estimated;
  return <EnrollmentDetailSection title={t(['付款信息','Payment information','Informasi pembayaran'])} fields={[
    [t(['本单应付','Order total','Total tagihan']),money(order.price)],
    [t(['本单已核实到账','Verified transfers','Transfer terverifikasi']),money(Math.max(0,order.received-(order.creditIn??0)))],
    [t(['旧单抵扣','Credit from an earlier order','Kredit dari pesanan sebelumnya']),!!order.creditIn&&money(order.creditIn)],
    [t(['已用于新订单','Applied to a new order','Digunakan untuk pesanan baru']),!!order.creditOut&&money(order.creditOut)],
    [estimated?t(['预计剩余应付','Estimated balance','Perkiraan sisa tagihan']):t(['剩余应付','Balance due','Sisa tagihan']),
      includeBalance&&balance!=null&&balance>0&&money(balance)],
  ]}/>;
}

export function EnrollmentSubmittedTransfers({transfers,language}:{transfers?:EnrollmentLearnerTransfer[];language:Language}) {
  if(!transfers?.length)return null;
  const t=(labels:readonly [string,string,string])=>enrollmentCopy(language,labels);
  const money=(amount:number)=>formatCurrency(amount,language);
  const notProvided=t(['未填写','Not provided','Tidak diisi']);
  const time=(value:string)=>enrollmentDateFormatter(language,'dateTime').format(new Date(value))+' WIB';
  const transferFields=(row:EnrollmentLearnerTransfer)=><EnrollmentDetailFields fields={[
    [t(['申报转账金额','Reported transfer amount','Nominal yang dilaporkan']),row.amount===undefined?notProvided:money(row.amount),
      row.verifiedAmount===undefined&&<EnrollmentStatusBadge status={t(['待财务核实','Awaiting verification','Menunggu verifikasi'])} tone="progress"/>],
    [t(['已核实到账','Verified amount','Nominal terverifikasi']),row.verifiedAmount!==undefined&&money(row.verifiedAmount)],
    [t(['提交时间','Submitted at','Waktu pengiriman']),<time dateTime={row.submittedAt}>{time(row.submittedAt)}</time>],
    [t(['银行流水号','Bank reference','Referensi bank']),row.reference??notProvided],
  ]}/>;
  const [latest,...earlier]=transfers;
  return <section className="enrollment-detail-section">
    <h2 className="enrollment-record-section-title">{t(['已提交的转账记录','Submitted transfers','Transfer yang dilaporkan'])}</h2>
    {transferFields(latest)}
    {earlier.length>0&&<details className="enrollment-history">
      <summary>{t(['查看较早转账记录','View earlier transfers','Lihat transfer sebelumnya'])} ({earlier.length})</summary>
      {earlier.map(row=><div key={row.id}>{transferFields(row)}</div>)}
    </details>}
  </section>;
}

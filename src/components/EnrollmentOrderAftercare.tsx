import { ArrowLeft, ArrowRight, Clock3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatCurrency } from '../utils/currency';
import type { PublicEnrollmentClass } from '../utils/enrollmentCatalog';
import { interestOption, interestText, type InterestLanguage } from './EnrollmentInterests';
import type { EnrollmentOrder } from './EnrollmentPayment';

type Copy = readonly [string, string, string];
type Course = { level?: string; format?: string; opened?: boolean; firstLesson: string; schedule: string };
type TransferTarget = Course & { id: string };
type Invitation = Course & { id: string; targetClassId: string; state: string; expiresAt: string };
export type EnrollmentAftercare = {
  originalClassState: string;
  currentClass: Course;
  transfers: TransferTarget[];
  invitations: Invitation[];
  transferHistory: { source_class_id: string; target_class_id: string; created_at: string }[];
  lateProofSubmitted?: boolean;
  refundProgress?: { expected: number; refunded: number } | null;
  refund: { mode: string; maximum?: number };
};

export function EnrollmentOrderAftercare({
  order, details, catalog, search, language, minePath, proofPath, busy, onTransfer, onRefresh,
}: {
  order: EnrollmentOrder;
  details?: EnrollmentAftercare;
  catalog: PublicEnrollmentClass[];
  search: URLSearchParams;
  language: InterestLanguage;
  minePath: string;
  proofPath?: string;
  busy: boolean;
  onTransfer: (classId: string, choice: 'accept' | 'decline', invitationId?: string) => void;
  onRefresh: () => void;
}) {
  const t = (copy: Copy) => interestText(language, copy);
  const currency = (amount: number) => formatCurrency(amount,language);
  const locale = t(['zh-CN','en-GB','id-ID']);
  const dateFormat = new Intl.DateTimeFormat(locale,{month:'long',day:'numeric',timeZone:'Asia/Jakarta'});
  const timeFormat = new Intl.DateTimeFormat(locale,{hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZone:'Asia/Jakarta'});
  const course = catalog.find(row=>row.id===order.classId) ?? details?.currentClass;
  const closed = details?.originalClassState==='cancelled';
  const expired = order.status==='expired' && !order.restored;
  const lateProofSubmitted = expired && details?.lateProofSubmitted;
  const progress = details?.refundProgress;
  const transfers = details?.transfers ?? [];
  const invitations = details?.invitations ?? [];
  const invitation = invitations.find(row=>row.id===search.get('target'));
  const activeInvitation = invitations.find(row=>row.state==='offered');
  const target = transfers.find(row=>row.id===search.get('target'));
  const view = search.get('view');
  const refundState = ['refunding','refunded'].includes(order.status);
  const allowRefundContact = details?.refund.mode==='contact_support' || details?.refund.mode==='special_review';

  function orderLink(nextView?: string, item?: string) {
    const params = new URLSearchParams(minePath.split('?')[1]);
    params.set('order',order.id);
    if (nextView) params.set('view',nextView);
    if (item) params.set('target',item);
    return '/enrollment/mine?'+params.toString();
  }
  const listPath = orderLink('transfers');
  const refundPath = orderLink('refund');
  const originalPath = orderLink();
  const contact = '/contact?lang='+language;
  const catalogUrl = new URLSearchParams(minePath.split('?')[1]);
  catalogUrl.delete('tab');
  const browsePath = '/enrollment?'+catalogUrl.toString();
  const support = t(['联系销售或客服','Contact sales or support','Hubungi tim penjualan atau layanan pelanggan']);
  const backMine = t(['返回我的报名','Back to my enrollments','Kembali ke pendaftaran saya']);
  const backOriginal = t(['返回原报名详情','Back to original enrollment','Kembali ke detail pendaftaran asal']);
  const originalClosed = t(['原班无法如期开课','The original class will not open','Kelas asal tidak dibuka']);
  const viewTransfers = t(['查看可转班次','View available classes','Lihat kelas pengganti']);
  const requestRefund = t(['申请退款','Request a refund','Ajukan pengembalian dana']);
  const refresh = t(['刷新状态','Refresh status','Muat ulang status']);

  function courseTitle(value?: Course, fallback?: Course, expected = false) {
    if (!value) return t(['报名编号','Order number','Nomor pendaftaran'])+' · '+order.id;
    const date = new Date(value.firstLesson.slice(0,10)+'T00:00:00+07:00');
    const day = Number.isFinite(date.valueOf()) ? dateFormat.format(date) : '';
    const format = value.format ?? fallback?.format;
    const dayLabel = day && t(expected
      ? ['预计 '+day+'开课','Expected '+day,'Perkiraan '+day] : [day+'开课','Starts '+day,'Mulai '+day]);
    return [value.level ?? fallback?.level,format && interestOption(language,format),dayLabel].filter(Boolean).join(' · ');
  }

  const classCard = (value?: Course, label?: string, isOriginal = false) => <article className="enrollment-record">
    {label&&<small>{label}</small>}
    <h2>{courseTitle(value,course,value?.opened===false || (isOriginal&&closed))}</h2>
    {value?.schedule&&<p>{value.schedule}</p>}
    {isOriginal&&closed&&<p>{originalClosed}</p>}
  </article>;
  const foot = (primary: React.ReactNode, secondary?: React.ReactNode) => <div className="enrollment-journey-actions">
    {secondary&&<div className="enrollment-aftercare-secondary">{secondary}</div>}
    {primary}
  </div>;
  const link = (label: string,to: string,primary = false) => <Link className={primary?'enrollment-primary':'enrollment-quiet'} to={to}>{label}</Link>;

  let heading = t(['报名详情','Enrollment details','Detail pendaftaran']);
  let back = {text:backMine,path:minePath};
  let body: React.ReactNode;

  if (refundState) {
    const complete = order.status==='refunded';
    heading = t(['退款详情','Refund details','Detail pengembalian dana']);
    body = <>
      <p className="enrollment-result-state" role="status" data-paid={complete}>{t(complete && progress && progress.refunded>0
        ? ['退款已发出','Refund issued','Pengembalian dana telah dikirim']
        : complete ? ['退款已完成','Refund complete','Pengembalian dana selesai']
          : ['退款处理中','Refund in progress','Pengembalian dana sedang diproses'])}</p>
      {classCard(course,t(['原报名','Original enrollment','Pendaftaran asal']),true)}
      <article className="enrollment-record">
        <h2>{t(['退款进度','Refund progress','Progres pengembalian dana'])}</h2>
        <p>{t(['报名已结束，相关席位已释放。','Enrollment has ended and its seats were released.','Pendaftaran telah berakhir dan kursi sudah dilepas.'])}</p>
        {progress && <dl className="enrollment-result-amounts">
          <div><dt>{t(['申请金额','Approved amount','Jumlah yang disetujui'])}</dt><dd>{currency(progress.expected)}</dd></div>
          <div><dt>{t(['累计已退','Total refunded','Total yang dikembalikan'])}</dt><dd>{currency(progress.refunded)}</dd></div>
          <div><dt>{t(['退回方式','Refund method','Metode pengembalian'])}</dt><dd>{t(['原付款渠道','Original payment method','Metode pembayaran awal'])}</dd></div>
        </dl>}
        {complete&&progress&&progress.refunded>0&&<p>{t(['实际到账时间以原付款渠道为准。','Arrival times depend on the original payment method.','Waktu dana diterima bergantung pada metode pembayaran awal.'])}</p>}
      </article>
      <button type="button" className="enrollment-quiet enrollment-aftercare-refresh" disabled={busy} onClick={onRefresh}>{refresh}</button>
      {foot(link(backMine,minePath,true),link(support,contact))}
    </>;
  } else if (view==='refund' && allowRefundContact) {
    heading = requestRefund;
    back = {text:backOriginal,path:originalPath};
    body = <>
      {classCard(course,undefined,true)}
      <article className="enrollment-record">
        <h2>{t(['退款金额与方式','Refund amount and method','Jumlah dan metode pengembalian'])}</h2>
        {typeof details?.refund.maximum==='number' && <strong>{currency(details.refund.maximum)}</strong>}
        <p>{t(['客服核实后确认金额，款项按原付款渠道退回，无需提供新的收款账户。','Support confirms the amount after review. Funds go to the original payment method, so no new account is needed.','Layanan pelanggan mengonfirmasi jumlah setelah pemeriksaan. Dana kembali ke metode pembayaran awal tanpa rekening baru.'])}</p>
      </article>
      <article className="enrollment-record">
        <h2>{t(['正式受理后','After support accepts the request','Setelah permintaan diterima'])}</h2>
        <p>{t(['客服登记后，报名和转班等待结束，已保留的席位释放。','When support records the request, enrollment and transfer waiting end and any seat on hold is released.','Setelah tim mencatat pengajuan, pendaftaran dan penantian pindah kelas berakhir, dan kursi yang ditahan dilepas.'])}</p>
        <p>{t(['联系时请提供报名编号','Have your order number ready','Siapkan nomor pendaftaran'])} · {order.id}</p>
      </article>
      {foot(link(support,contact,true),link(backOriginal,originalPath))}
    </>;
  } else if (view==='invitation' && invitation && closed) {
    heading = t(['转班邀请','Transfer invitation','Undangan pindah kelas']);
    back = {text:backOriginal,path:originalPath};
    const offered = invitation.state==='offered' && order.status==='paid_cancelled';
    const date = new Date(invitation.expiresAt);
    const reply = Number.isFinite(date.valueOf()) ? dateFormat.format(date)+' '+timeFormat.format(date)+' WIB' : '';
    const seatLabel = invitation.state==='declined'
      ? t(['你已拒绝这次安排，目标班席位已释放。','You declined this invitation. The seat was released.','Anda menolak undangan ini. Kursi telah dilepas.'])
      : invitation.state==='expired' ? t(['答复时间已过，目标班席位已释放。','The reply deadline passed and the seat was released.','Batas waktu jawaban terlewati dan kursi dilepas.'])
      : t(['这次邀请已结束。','This invitation has closed.','Undangan ini telah ditutup.']);
    body = offered ? <>
      <p className="enrollment-result-state" role="status"><Clock3 size={18} aria-hidden="true"/>{t([
        '已为你留位 · 请于 '+reply+' 前答复','Seat held · Reply by '+reply,'Kursi ditahan · Jawab sebelum '+reply,
      ])}</p>
      {classCard(course,t(['原班','Original class','Kelas asal']),true)}
      {classCard(invitation,t(['目标班','New class','Kelas baru']))}
      <article className="enrollment-record">
        <h2>{t(['已付学费','Tuition paid','Biaya yang telah dibayar'])}</h2>
        <p>{currency(order.received)} · {t(['转入目标班，无需再付款。','Applied to the new class. No additional payment is needed.','Dialihkan ke kelas baru. Tidak perlu membayar lagi.'])}</p>
        <p>{t(['超过答复时间，目标班席位将释放。','The held seat is released after the reply deadline.','Kursi dilepas setelah batas waktu jawaban.'])}</p>
      </article>
      {foot(<button type="button" className="enrollment-primary" disabled={busy} onClick={()=>onTransfer(invitation.targetClassId,'accept',invitation.id)}>
        {t(['接受并转班','Accept and transfer','Terima dan pindah kelas'])}</button>,<>
        <button type="button" className="enrollment-quiet" disabled={busy} onClick={()=>onTransfer(invitation.targetClassId,'decline',invitation.id)}>
          {t(['拒绝这次安排','Decline invitation','Tolak undangan'])}</button>
        {allowRefundContact&&link(requestRefund,refundPath)}
      </>)}
    </> : <>
      <p className="enrollment-journey-note" role="status">{seatLabel}</p>
      {classCard(course,t(['原报名','Original enrollment','Pendaftaran asal']),true)}
      {foot(link(viewTransfers,listPath,true),allowRefundContact&&link(requestRefund,refundPath))}
    </>;
  } else if (view==='transfers' && closed && order.status==='paid_cancelled') {
    heading = t(['可转班次','Available transfer classes','Kelas pengganti yang tersedia']);
    back = {text:backOriginal,path:originalPath};
    body = <>
      {transfers.map(row=>{
        const option = catalog.find(item=>item.id===row.id);
        return <article key={row.id} className="enrollment-record enrollment-transfer-card">
          <h2>{courseTitle(row,course,option?.opened===false)}</h2>
          {option&&<p>{t([option.sessions+' 次课 · 每次 '+option.minutes+' 分钟',option.sessions+' sessions · '+option.minutes+' min each',option.sessions+' sesi · '+option.minutes+' menit per sesi'])}</p>}
          <p>{row.schedule}</p>
          <p><span className="enrollment-status" data-state="confirmed">{t(['可转班','Available for transfer','Tersedia untuk pindah kelas'])}</span></p>
          <div className="enrollment-transfer-card-actions">
            <div><strong>{t(['原款转入','Existing payment carries over','Pembayaran awal dialihkan'])}</strong>
              <p>{t(['无需再次付款','No additional payment','Tidak perlu membayar lagi'])}</p></div>
            <Link className="enrollment-primary" to={orderLink('transfer',row.id)}>{t(['查看转班详情','Review transfer','Lihat detail pindah kelas'])}<ArrowRight size={14} aria-hidden="true"/></Link>
          </div>
        </article>;
      })}
      {!transfers.length&&<p className="enrollment-journey-note">{t(['暂时没有同级别、同班型的可转班次。','No classes at the same level and in the same format are available right now.','Belum ada kelas dengan level dan jenis yang sama.'])}</p>}
      <p className="enrollment-journey-note">{t(['暂不转班？你可以继续等待合适的班次。','You can wait for another suitable class.','Anda dapat menunggu kelas lain yang sesuai.'])}</p>
      {foot(link(backOriginal,originalPath,true))}
    </>;
  } else if (view==='transfer' && target && closed && order.status==='paid_cancelled') {
    heading = t(['转班详情','Transfer details','Detail pindah kelas']);
    back = {text:viewTransfers,path:listPath};
    body = <>
      {classCard(course,t(['原班','Original class','Kelas asal']),true)}
      {classCard(target,t(['目标班','New class','Kelas baru']))}
      <article className="enrollment-record">
        <h2>{t(['已付学费','Tuition paid','Biaya yang telah dibayar'])}</h2>
        <p>{currency(order.received)} · {t(['转入目标班，无需再付款。','Applied to the new class. No additional payment is needed.','Dialihkan ke kelas baru. Tidak perlu membayar lagi.'])}</p>
        <p>{t(['提交确认时会核对目标班的实际空位。','Availability is checked when you confirm.','Ketersediaan kursi diperiksa saat Anda mengonfirmasi.'])}</p>
      </article>
      {foot(<button type="button" className="enrollment-primary" disabled={busy} onClick={()=>onTransfer(target.id,'accept')}>
        {t(['确认转班','Confirm transfer','Konfirmasi pindah kelas'])}</button>)}
    </>;
  } else if (expired) {
    body = <>
      {classCard(course,undefined,true)}
      <p className="enrollment-result-state" role="status">{t(lateProofSubmitted
        ? ['订单已终止 · 转账凭证待核实','Order expired · Proof under review','Pesanan kedaluwarsa · Bukti sedang diperiksa']
        : order.received>0 ? ['订单已终止 · 已核实到账','Order expired · Payment verified','Pesanan kedaluwarsa · Pembayaran terverifikasi']
        : ['订单已终止 · 未按时提交付款凭证','Order expired · No proof submitted in time','Pesanan kedaluwarsa · Bukti tidak dikirim tepat waktu'])}</p>
      <article className="enrollment-record">
        <h2>{t(order.received>0?['收款状态','Payment status','Status pembayaran']:lateProofSubmitted?['下一步','What happens next','Langkah berikutnya']:['已经转账？','Already transferred?','Sudah transfer?'])}</h2>
        {order.received>0 ? <p>{t(['已核实到账','Verified receipts','Dana terverifikasi'])} · {currency(order.received)}</p>
          : lateProofSubmitted ? <p>{t(['财务会核对这笔转账。若核实在原截止前已足额转账，且原班可接收，系统会恢复原班报名。','Finance will review the transfer. Enrollment can be restored if full payment was made before the original deadline and the class can still admit you.','Tim keuangan akan memeriksa transfer. Pendaftaran dapat dipulihkan jika pembayaran lunas sebelum batas awal dan kelas masih dapat menerima Anda.'])}</p>
          : <p>{t(['可提交已发生的转账凭证，财务会核对实际到账。','If you already transferred funds, submit the proof for Finance to review.','Jika sudah transfer, kirim buktinya untuk diperiksa tim keuangan.'])}</p>}
        <p>{t(['原付款入口已关闭，原席位已释放。','The original payment link is closed and the seat was released.','Pembayaran untuk pesanan awal ditutup dan kursinya sudah dilepas.'])}</p>
      </article>
      <button type="button" className="enrollment-quiet enrollment-aftercare-refresh" disabled={busy} onClick={onRefresh}>{refresh}</button>
      {foot(lateProofSubmitted ? link(backMine,minePath,true)
        : proofPath ? link(t(['提交已转账凭证','Submit proof of an existing transfer','Kirim bukti transfer yang sudah dilakukan']),proofPath,true)
        : link(backMine,minePath,true), <>
        {allowRefundContact&&link(requestRefund,refundPath)}
        {lateProofSubmitted&&proofPath&&link(t(['补交凭证','Submit another proof','Kirim bukti tambahan']),proofPath)}
        {!lateProofSubmitted&&link(t(['重新查看可报名班次','Browse open classes','Lihat kelas yang masih dibuka']),browsePath)}
      </>)}
    </>;
  } else {
    const showTransfers = closed && order.status==='paid_cancelled';
    const primary = showTransfers && activeInvitation
      ? link(t(['查看转班邀请','View transfer invitation','Lihat undangan pindah kelas']),orderLink('invitation',activeInvitation.id),true)
      : showTransfers ? link(viewTransfers,listPath,true) : link(backMine,minePath,true);
    body = <>
      {classCard(course,undefined,true)}
      {closed&&<p className="enrollment-result-state" role="status">{originalClosed}</p>}
      <article className="enrollment-record">
        <h2>{t(['收款状态','Payment status','Status pembayaran'])}</h2>
        <p>{t(['已核实到账','Verified receipts','Dana terverifikasi'])} · {currency(order.received)}</p>
        {showTransfers&&<p>{t(['可查看同级别、同班型的班次，也可以继续等待。','Browse classes at the same level and in the same format, or keep waiting.','Lihat kelas dengan level dan jenis yang sama, atau lanjut menunggu.'])}</p>}
        {!showTransfers&&closed&&<p>{t(['原班已停止收款，请勿转账。','Payments for the original class have closed.','Pembayaran untuk kelas asal telah ditutup.'])}</p>}
      </article>
      {showTransfers&&invitations.filter(row=>['offered','declined','expired'].includes(row.state)).map(row=>
        <Link className="enrollment-record-link" key={row.id} to={orderLink('invitation',row.id)}>
          {t(row.state==='offered'?['转班邀请 · 待答复','Transfer invitation · Reply needed','Undangan pindah kelas · Perlu jawaban']
            : row.state==='declined'?['转班邀请 · 已拒绝','Transfer invitation · Declined','Undangan pindah kelas · Ditolak']
            : ['转班邀请 · 已过期','Transfer invitation · Expired','Undangan pindah kelas · Kedaluwarsa'])}<ArrowRight size={14} aria-hidden="true"/>
        </Link>)}
      <button type="button" className="enrollment-quiet enrollment-aftercare-refresh" disabled={busy} onClick={onRefresh}>{refresh}</button>
      {foot(primary, <>
        {activeInvitation&&link(viewTransfers,listPath)}
        {allowRefundContact&&link(requestRefund,refundPath)}
        {!showTransfers&&proofPath&&link(t(['提交已转账凭证','Submit proof of an existing transfer','Kirim bukti transfer yang sudah dilakukan']),proofPath)}
      </>)}
    </>;
  }

  return <div className="enrollment-order-result enrollment-aftercare">
    <Link className="enrollment-back" to={back.path}><ArrowLeft size={15} aria-hidden="true"/>{back.text}</Link>
    <h1>{heading}</h1>
    <div className="enrollment-result-body">{body}</div>
  </div>;
}

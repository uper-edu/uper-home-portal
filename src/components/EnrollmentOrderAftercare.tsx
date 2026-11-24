import {EnrollmentClassName} from './EnrollmentClassName';
import { useState } from 'react';
import { ArrowRight, Check, Clock3, Copy as CopyIcon } from 'lucide-react';
import {EnrollmentOrderInformation,EnrollmentRecordActions,EnrollmentRecordSummary} from './EnrollmentRecordLayout';
import {EnrollmentJourneyLink} from './EnrollmentJourneyLink';
import { formatCurrency } from '../utils/currency';
import {enrollmentTeacherLabel,enrollmentClassTitle,enrollmentScheduleLabel, type PublicEnrollmentClass} from '../utils/enrollmentCatalog';
import { interestOption, interestText, type InterestLanguage } from '../utils/enrollmentInterestCopy';
import type { EnrollmentOrder } from './EnrollmentPayment';
import { enrollmentSupportPath } from './EnrollmentSupport';
import { SocialProfileIcon, socialProfiles } from './SocialProfileIcon';
import type { AftercareCourse as Course, EnrollmentAftercare } from '../utils/enrollmentAftercare';

type Copy = readonly [string, string, string];

export function EnrollmentOrderAftercare({
  order, details, catalog, search, language, searchBase, proofPath, busy, onTransfer, onEnablePriority, onCancel,
}: {
  order: EnrollmentOrder;
  details?: EnrollmentAftercare;
  catalog: ReadonlyMap<string,PublicEnrollmentClass>;
  search: URLSearchParams;
  language: InterestLanguage;
  searchBase: URLSearchParams;
  proofPath?: string;
  busy: boolean;
  onTransfer: (classId: string, choice: 'accept' | 'decline', invitationId?: string) => void;
  onEnablePriority: () => void;
  onCancel?: () => void;
}) {
  const [copyState,setCopyState] = useState<'copied'|'failed'>();
  const t = (copy: Copy) => interestText(language, copy);
  const currency = (amount: number) => formatCurrency(amount,language);
  const locale = t(['zh-CN','en-GB','id-ID']);
  const dateFormat = new Intl.DateTimeFormat(locale,{month:'long',day:'numeric',timeZone:'Asia/Jakarta'});
  const timeFormat = new Intl.DateTimeFormat(locale,{hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZone:'Asia/Jakarta'});
  const course = catalog.get(order.classId) ?? details?.currentClass;
  const closed = details?.originalClassState==='cancelled';
  const expired = order.status==='expired' && !order.restored;
  const learnerCancelled=order.closureReason==='learner_cancelled';
  const lateProofSubmitted = (expired||learnerCancelled) && details?.lateProofSubmitted;
  const progress = details?.refundProgress;
  const transfers = details?.transfers ?? [];
  const invitations = details?.invitations ?? [];
  const invitation = invitations.find(row=>row.id===search.get('target'));
  const activeInvitation = invitations.find(row=>row.state==='offered');
  const target = transfers.find(row=>row.id===search.get('target'));
  const view = search.get('view');
  const refundState = ['refunding','refunded'].includes(order.status);
  const transferred = !closed && order.status==='paid' && details?.transferHistory.some(row=>row.target_class_id===order.classId);
  const allowRefundContact = details?.refund.mode==='contact_support' || details?.refund.mode==='special_review';

  function orderLink(nextView?: string, item?: string) {
    const params = new URLSearchParams(searchBase);
    params.set('order',order.id);
    if (nextView) params.set('view',nextView);
    if (item) params.set('target',item);
    return '/enrollment/mine?'+params.toString();
  }
  const listPath = orderLink('transfers');
  const refundPath = orderLink('refund');
  const refundContactPath = orderLink('refund-contact');
  const contact = '/contact?lang='+language;
  const catalogUrl = new URLSearchParams(searchBase);
  catalogUrl.delete('tab');
  const browsePath = '/enrollment?'+catalogUrl.toString();
  const support = t(['联系销售或客服','Contact sales or support','Hubungi tim penjualan atau layanan pelanggan']);
  const originalClosed = t(['原班无法如期开课','The original class will not open','Kelas asal tidak dibuka']);
  const viewTransfers = t(['查看可转班次','View available classes','Lihat kelas pengganti']);
  const requestRefund = t(['申请退款','Request a refund','Ajukan pengembalian dana']);

  function courseTitle(value?: Course, fallback?: Course, expected = false) {
    if (!value) return t(['报名编号','Order number','Nomor pendaftaran'])+' · '+order.id;
    if(value.period||fallback?.period)return enrollmentClassTitle({...fallback,...value},language);
    const date = new Date(value.firstLesson.slice(0,10)+'T00:00:00+07:00');
    const day = Number.isFinite(date.valueOf()) ? dateFormat.format(date) : '';
    const format = value.format ?? fallback?.format;
    const dayLabel = day && t(expected
      ? ['首课 '+day,'First session '+day,'Pertemuan pertama '+day] : [day+'开课','Starts '+day,'Mulai '+day]);
    return [value.level ?? fallback?.level,format && interestOption(language,format),dayLabel].filter(Boolean).join(' · ');
  }

  const classCard = (value?: Course, label?: string, isOriginal = false, status?: string, tone:'pending'|'confirmed'|'full'='full') =>
    <EnrollmentRecordSummary title={courseTitle(value,course,value?.opened===false || (isOriginal&&closed))}
      schedule={enrollmentScheduleLabel(value,language)} status={status??(isOriginal&&closed?originalClosed:undefined)} tone={tone}>
      {label&&<p>{label}</p>}
      {value&&<p>{[enrollmentTeacherLabel(value.teacherType??course?.teacherType,language),value.firstLesson.replace('T',' ')+' WIB'].filter(Boolean).join(' · ')}</p>}
    </EnrollmentRecordSummary>;
  const actions = (primary?: React.ReactNode, secondary?: React.ReactNode) =>
    <>
      <EnrollmentOrderInformation order={order} language={language}/>
      <EnrollmentRecordActions primary={primary} secondary={<>
        {secondary}
        {onCancel&&<button type="button" className="enrollment-outline enrollment-order-cancel" disabled={busy} onClick={onCancel}>
          {t(['取消报名','Cancel enrollment','Batalkan pendaftaran'])}
        </button>}
      </>}/>
    </>;
  const link = (label: string,to: string,primary = false) => <EnrollmentJourneyLink className={primary?'enrollment-primary':'enrollment-quiet'}
    stepEntry={to===proofPath?'enrollment-aftercare-proof':undefined} to={to}>{label}</EnrollmentJourneyLink>;
  let heading: string | undefined;
  let body: React.ReactNode;

  if (refundState) {
    const complete = order.status==='refunded';
    const returned = progress?.returned ?? 0;
    heading = t(['退款详情','Refund details','Detail pengembalian dana']);
    const refundStatus=t(complete && progress && progress.refunded>0
      ? ['退款已发出','Refund issued','Pengembalian dana telah dikirim']
      : complete ? ['退款已完成','Refund complete','Pengembalian dana selesai']
        : returned>0 ? ['银行已退回','Returned by the bank','Dikembalikan oleh bank']
          : ['退款处理中','Refund in progress','Pengembalian dana sedang diproses']);
    body = <>
      {classCard(course,t(['原报名','Original enrollment','Pendaftaran asal']),true,refundStatus,complete?'confirmed':'pending')}
      <article className="enrollment-record">
        <h2>{t(['退款进度','Refund progress','Progres pengembalian dana'])}</h2>
        {!complete&&returned>0&&<p>{t(['银行已退回，财务正在处理。','The bank returned the refund. Finance is handling it.','Bank mengembalikan dana. Tim keuangan sedang menanganinya.'])}</p>}
        <p>{t(['报名已结束，相关席位已释放。','Enrollment has ended and its seats were released.','Pendaftaran telah berakhir dan kursi sudah dilepas.'])}</p>
        {progress && <dl className="enrollment-result-amounts">
          <div><dt>{t(['申请金额','Approved amount','Jumlah yang disetujui'])}</dt><dd>{currency(progress.expected)}</dd></div>
          <div><dt>{t(['累计已退','Total refunded','Total yang dikembalikan'])}</dt><dd>{currency(progress.refunded)}</dd></div>
          {!complete&&returned>0&&<div><dt>{t(['剩余应退','Remaining refund','Sisa pengembalian'])}</dt><dd>{currency(progress.expected-progress.refunded)}</dd></div>}
          {!complete&&returned===0&&progress.sendBy&&<div><dt>{t(['预计发出时间','Expected send-by date','Perkiraan batas pengiriman'])}</dt>
            <dd><time dateTime={progress.sendBy}>{dateFormat.format(new Date(progress.sendBy))} · {timeFormat.format(new Date(progress.sendBy))} WIB</time></dd>
          </div>}
          <div><dt>{t(['退回方式','Refund method','Metode pengembalian'])}</dt><dd>{t(['原付款渠道','Original payment method','Metode pembayaran awal'])}</dd></div>
        </dl>}
        {complete&&progress&&progress.refunded>0&&<p>{t(['实际到账时间以原付款渠道为准。','Arrival times depend on the original payment method.','Waktu dana diterima bergantung pada metode pembayaran awal.'])}</p>}
      </article>

      {actions(undefined,<EnrollmentJourneyLink className="enrollment-quiet" stepEntry="enrollment-refund-help"
        to={enrollmentSupportPath('refund',language)}>{support}</EnrollmentJourneyLink>)}
    </>;
  } else if (view==='refund' && allowRefundContact) {
    heading = requestRefund;
    body = <>
      {classCard(course,undefined,true)}
      <article className="enrollment-record">
        <h2>{t(['退款金额与方式','Refund amount and method','Jumlah dan metode pengembalian'])}</h2>
        {typeof details?.refund.maximum==='number' && <strong className="enrollment-main-amount">{currency(details.refund.maximum)}</strong>}
        <p>{t(['客服核实后确认金额，款项按原付款渠道退回，无需提供新的收款账户。','Support confirms the amount after review. Funds go to the original payment method, so no new account is needed.','Layanan pelanggan mengonfirmasi jumlah setelah pemeriksaan. Dana kembali ke metode pembayaran awal tanpa rekening baru.'])}</p>
      </article>
      <article className="enrollment-record">
        <h2>{t(['正式受理后','After support accepts the request','Setelah permintaan diterima'])}</h2>
        <p>{t(['客服登记后，报名和转班等待结束，已保留的席位释放。','When support records the request, enrollment and transfer waiting end and any seat on hold is released.','Setelah tim mencatat pengajuan, pendaftaran dan penantian pindah kelas berakhir, dan kursi yang ditahan dilepas.'])}</p>
        <p>{t(['联系时请提供报名编号','Have your order number ready','Siapkan nomor pendaftaran'])} · {order.id}</p>
      </article>
      {actions(link(support,refundContactPath,true))}
    </>;
  } else if (view==='refund-contact' && allowRefundContact) {
    heading = t(['联系销售或客服办理退款','Contact sales or support about a refund','Hubungi tim penjualan atau layanan pelanggan untuk pengembalian dana']);
    body = <>
      <article className="enrollment-record enrollment-refund-contact">
        <h2>{t(['退款协助','Refund assistance','Bantuan pengembalian dana'])}</h2>
        <p>{t([
          '请提供报名编号，并说明是咨询退款条件还是正式提出申请。自行退出时，按报名前公示的退款政策核定。',
          'Share your order number and say whether you want to ask about eligibility or submit a request. If you withdraw, the policy shown before enrollment applies.',
          'Berikan nomor pendaftaran dan jelaskan apakah Anda ingin menanyakan syarat atau mengajukan permintaan. Jika mengundurkan diri, kebijakan yang diumumkan sebelum pendaftaran berlaku.',
        ])}</p>
        <div className="enrollment-refund-reference">
          <span>{t(['报名编号','Order number','Nomor pendaftaran'])}</span>
          <span className="enrollment-order-reference">{order.id}</span>
          <button className="enrollment-copy" type="button" aria-label={t(['复制报名编号','Copy order number','Salin nomor pendaftaran'])}
            onClick={async()=>{
              try { await navigator.clipboard.writeText(order.id); setCopyState('copied'); }
              catch { setCopyState('failed'); }
            }}>
            {copyState==='copied'?<Check size={16} aria-hidden="true"/>:<CopyIcon size={16} aria-hidden="true"/>}
          </button>
        </div>
        {copyState&&<p role="status">{copyState==='copied'
          ? t(['已复制报名编号','Order number copied','Nomor pendaftaran disalin'])
          : t(['复制失败，可手动复制上方编号。','Could not copy. You can copy the number above manually.','Gagal menyalin. Anda dapat menyalin nomor di atas secara manual.'])}</p>}
      </article>
      {actions(<a className="enrollment-primary enrollment-whatsapp-action" href={socialProfiles.whatsapp.url} target="_blank" rel="noopener noreferrer">
        <SocialProfileIcon platform="whatsapp" className="size-4"/>
        {t(['通过 WhatsApp 联系','Contact on WhatsApp','Hubungi via WhatsApp'])}
      </a>)}
    </>;
  } else if (view==='invitation' && invitation && closed) {
    heading = t(['转班邀请','Transfer invitation','Undangan pindah kelas']);
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
      {actions(<button type="button" className="enrollment-primary" disabled={busy} onClick={()=>onTransfer(invitation.targetClassId,'accept',invitation.id)}>
        {t(['接受并转班','Accept and transfer','Terima dan pindah kelas'])}</button>,<>
        <button type="button" className="enrollment-quiet" disabled={busy} onClick={()=>onTransfer(invitation.targetClassId,'decline',invitation.id)}>
          {t(['拒绝这次安排','Decline invitation','Tolak undangan'])}</button>
        {allowRefundContact&&link(requestRefund,refundPath)}
      </>)}
    </> : <>
      <p className="enrollment-journey-note" role="status">{seatLabel}</p>
      {classCard(course,t(['原报名','Original enrollment','Pendaftaran asal']),true)}
      {actions(link(viewTransfers,listPath,true),allowRefundContact&&link(requestRefund,refundPath))}
    </>;
  } else if (view==='transfers' && closed && order.status==='paid_cancelled') {
    heading = t(['可转班次','Available transfer classes','Kelas pengganti yang tersedia']);
    body = <>
      {transfers.map(row=>{
        const option = catalog.get(row.id);
        return <article key={row.id} className="enrollment-record enrollment-transfer-card">
          <h2 className="enrollment-class-heading"><EnrollmentClassName title={courseTitle(row,course,option?.opened===false)}/></h2>
          {option&&<p>{t([option.sessions+' 次课 · 每次 '+option.minutes+' 分钟',option.sessions+' sessions · '+option.minutes+' min each',option.sessions+' sesi · '+option.minutes+' menit per sesi'])}</p>}
          <p>{enrollmentScheduleLabel(row,language)}</p>
          <p><span className="enrollment-status" data-state="confirmed">{t(['可转班','Available for transfer','Tersedia untuk pindah kelas'])}</span></p>
          <div className="enrollment-transfer-card-actions">
            <div><strong>{t(['原款转入','Existing payment carries over','Pembayaran awal dialihkan'])}</strong>
              <p>{t(['无需再次付款','No additional payment','Tidak perlu membayar lagi'])}</p></div>
            <EnrollmentJourneyLink className="enrollment-primary" to={orderLink('transfer',row.id)}>{t(['查看转班详情','Review transfer','Lihat detail pindah kelas'])}<ArrowRight size={14} aria-hidden="true"/></EnrollmentJourneyLink>
          </div>
        </article>;
      })}
      {!transfers.length&&<p className="enrollment-journey-note">{t(['暂时没有同级别、同班型的可转班次。','No classes at the same level and in the same format are available right now.','Belum ada kelas dengan level dan jenis yang sama.'])}</p>}
      <p className="enrollment-journey-note">{t(['暂不转班？你可以继续等待合适的班次。','You can wait for another suitable class.','Anda dapat menunggu kelas lain yang sesuai.'])}</p>
      {actions()}
    </>;
  } else if (view==='transfer' && target && closed && order.status==='paid_cancelled') {
    heading = t(['转班详情','Transfer details','Detail pindah kelas']);
    body = <>
      {classCard(course,t(['原班','Original class','Kelas asal']),true)}
      {classCard(target,t(['目标班','New class','Kelas baru']))}
      <article className="enrollment-record">
        <h2>{t(['已付学费','Tuition paid','Biaya yang telah dibayar'])}</h2>
        <p>{currency(order.received)} · {t(['转入目标班，无需再付款。','Applied to the new class. No additional payment is needed.','Dialihkan ke kelas baru. Tidak perlu membayar lagi.'])}</p>
        <p>{t(['提交确认时会核对目标班的实际空位。','Availability is checked when you confirm.','Ketersediaan kursi diperiksa saat Anda mengonfirmasi.'])}</p>
      </article>
      {actions(<button type="button" className="enrollment-primary" disabled={busy} onClick={()=>onTransfer(target.id,'accept')}>
        {t(['确认转班','Confirm transfer','Konfirmasi pindah kelas'])}</button>)}
    </>;
  } else if (order.status==='ended') {
    body = <>
      {classCard(course,undefined,false,t(learnerCancelled?['已取消报名','Enrollment canceled','Pendaftaran dibatalkan']:['报名已结束','Enrollment ended','Pendaftaran telah berakhir']))}
      <article className="enrollment-record">
        <p>{t(['席位已释放，付款入口已关闭。','Your seat has been released and the payment link is closed.','Kursi telah dilepas dan tautan pembayaran ditutup.'])}</p>
        <p>{t(['已核实到账','Verified receipts','Dana terverifikasi'])} · {currency(order.received)}</p>
      </article>
      {learnerCancelled&&lateProofSubmitted&&<p role="status">{t(['转账凭证待核实','Transfer proof awaiting verification','Bukti transfer menunggu verifikasi'])}</p>}
      {actions(learnerCancelled&&proofPath&&!lateProofSubmitted
        ? link(t(['补交已转账凭证','Submit proof of an existing transfer','Kirim bukti transfer yang sudah dilakukan']),proofPath,true)
        : undefined, <>
        {allowRefundContact&&link(support,refundContactPath)}
        {learnerCancelled&&proofPath&&lateProofSubmitted&&link(t(['补交凭证','Submit another proof','Kirim bukti tambahan']),proofPath)}
      </>)}
    </>;
  } else if (expired) {
    body = <>
      {classCard(course,undefined,true,t(['付款超时','Payment deadline passed','Tenggat pembayaran terlewati']))}
      {lateProofSubmitted&&<p className="enrollment-result-state" role="status">
        {t(['已收凭证，等待核实到账。','Proof received. Awaiting payment verification.','Bukti diterima dan menunggu verifikasi pembayaran.'])}
      </p>}
      <article className="enrollment-record">
        <h2>{t(order.received>0||order.creditOut?['收款状态','Payment status','Status pembayaran']:lateProofSubmitted?['下一步','What happens next','Langkah berikutnya']:['已经转账？','Already transferred?','Sudah transfer?'])}</h2>
        {order.received>0||order.creditOut ? <p>{t(['已核实到账','Verified receipts','Dana terverifikasi'])} · {currency(order.received+(order.creditOut??0))}</p>
          : lateProofSubmitted ? <p>{t([
            '财务会核对这笔转账。若足额转账的时间在原付款截止时刻或之前，且原班仍可接收，系统会恢复原班报名。',
            'Finance will review the transfer. If you transferred the full amount by the original payment deadline and the class can still admit you, your enrollment will be restored.',
            'Tim keuangan akan memeriksa transfer ini. Jika Anda sudah mentransfer jumlah penuh paling lambat pada tenggat pembayaran awal dan kelas masih dapat menerima Anda, pendaftaran Anda akan dipulihkan.',
          ])}</p>
          : <p>{t(['可提交已发生的转账凭证，财务会核对实际到账。','If you already transferred funds, submit the proof for Finance to review.','Jika sudah transfer, kirim buktinya untuk diperiksa tim keuangan.'])}</p>}
        {!!order.creditOut&&<p>{t(['已冲抵新订单','Applied to a new order','Digunakan untuk pesanan baru'])} · {currency(order.creditOut)}</p>}
        <p>{t(['原付款入口已关闭，原席位已释放。','The original payment link is closed and the seat was released.','Pembayaran untuk pesanan awal ditutup dan kursinya sudah dilepas.'])}</p>
      </article>

      {actions(order.received>0 && allowRefundContact ? link(support,refundContactPath,true)
        : !lateProofSubmitted&&!order.creditOut&&proofPath
          ? link(t(['提交已转账凭证','Submit proof of an existing transfer','Kirim bukti transfer yang sudah dilakukan']),proofPath,true)
          : undefined, <>
        {(lateProofSubmitted||order.creditOut||order.received>0&&allowRefundContact)&&proofPath&&link(t(['补交凭证','Submit another proof','Kirim bukti tambahan']),proofPath)}
        {!lateProofSubmitted&&!order.creditOut&&order.received===0&&link(t(['重新查看可报名班次','Browse open classes','Lihat kelas yang masih dibuka']),browsePath)}
      </>)}
    </>;
  } else if (transferred) {
    body = <>
      {classCard(course,undefined,false,t(['转班成功','Transfer complete','Pindah kelas berhasil']),'confirmed')}
      {course?.opened===true&&<p>{t(['已确认开班','Class opening confirmed','Pembukaan kelas dikonfirmasi'])}</p>}
      <article className="enrollment-record">
        <h2>{t(['学费','Tuition','Biaya kelas'])}</h2>
        <p>{t([
          '原报名已核实到账 '+currency(order.received)+'，已用于本班。无需再次转账。',
          'The '+currency(order.received)+' verified for your original enrollment has been applied to this class. No new transfer is needed.',
          'Dana '+currency(order.received)+' yang terverifikasi untuk pendaftaran awal telah digunakan untuk kelas ini. Tidak perlu transfer lagi.',
        ])}</p>
      </article>

      {actions(undefined,link(support,contact))}
    </>;
  } else {
    const showTransfers = closed && order.status==='paid_cancelled';
    const pendingProof = order.status==='proof_review';
    const paidPart = order.received>0 && !showTransfers;
    const primary = showTransfers && activeInvitation
      ? link(t(['查看转班邀请','View transfer invitation','Lihat undangan pindah kelas']),orderLink('invitation',activeInvitation.id),true)
      : showTransfers ? link(viewTransfers,listPath,true)
      : paidPart && allowRefundContact ? link(support,refundContactPath,true)
      : undefined;
    const replyDate = activeInvitation && new Date(activeInvitation.expiresAt);
    const replyBy = replyDate && Number.isFinite(replyDate.valueOf()) ? dateFormat.format(replyDate)+' '+timeFormat.format(replyDate)+' WIB' : '';
    body = <>
      {classCard(course,undefined,closed)}
      <article className="enrollment-record">
        <h2>{t(showTransfers?['收款进度','Payment progress','Status pembayaran']:['收款状态','Payment status','Status pembayaran'])}</h2>
        {showTransfers ? <dl className="enrollment-result-amounts">
          <div><dt>{t(['应付','Amount due','Jumlah tagihan'])}</dt><dd>{currency(order.price)}</dd></div>
          <div><dt>{t(['已核实到账','Verified receipts','Dana terverifikasi'])}</dt><dd>{currency(order.received)}</dd></div>
        </dl> : <>
          <p>{paidPart ? t(['已核实到账','Verified receipts','Dana terverifikasi'])+' · '+currency(order.received)
            : pendingProof ? t(['凭证已提交 · 待核实到账','Proof submitted · Awaiting payment verification','Bukti dikirim · Menunggu verifikasi pembayaran'])
            : t(['待付款','Awaiting payment','Menunggu pembayaran'])}</p>
          {pendingProof ? <p>{t(['财务会继续核对你的转账。核实到账后，可在这里查看下一步。','Finance will continue to review your transfer. Check here for next steps after verification.','Tim keuangan akan melanjutkan pemeriksaan transfer. Lihat langkah berikutnya setelah verifikasi.'])}</p>
            : <p>{t(['原班已停止收款，请勿转账。','Payments for the original class have closed. Please do not transfer funds.','Pembayaran untuk kelas asal telah ditutup. Jangan transfer dana.'])}</p>}
          {paidPart&&allowRefundContact&&<p>{t(['如需退款，请向销售或客服提出。','Contact sales or support if you need a refund.','Hubungi tim penjualan atau layanan pelanggan jika memerlukan pengembalian dana.'])}</p>}
        </>}
      </article>
      {showTransfers && activeInvitation && <p className="enrollment-journey-note enrollment-invite-notice">
        <Clock3 size={16} aria-hidden="true"/>
        {replyBy ? t(['目标班已为你留位 · '+replyBy+' 前答复','Seat held in the new class · Reply by '+replyBy,'Kursi ditahan di kelas baru · Jawab sebelum '+replyBy])
          : t(['目标班已为你留位','A seat is held in the new class','Kursi ditahan di kelas baru'])}
      </p>}
      {showTransfers&&<article className="enrollment-record">
        <h2>{t(['接下来的安排','Your options','Pilihan Anda'])}</h2>
        <dl className="enrollment-aftercare-options">
          <div><dt>{t(['换一个班','Choose another class','Pilih kelas lain'])}</dt>
            <dd>{t(['查看同级别、同班型的班次。','Browse classes at the same level and in the same format.','Lihat kelas dengan level dan jenis yang sama.'])}</dd></div>
          <div><dt>{t(['继续等待','Keep waiting','Lanjut menunggu'])}</dt>
            <dd>{t(activeInvitation ? ['可先查看本次邀请，再决定是否接受。','Review the invitation before deciding whether to accept.','Tinjau undangan sebelum memutuskan untuk menerima.']
              : details?.priorityRequested ? ['已开启优先安排。有合适的安排时，我们会与你确认。','Priority arrangements are on. We’ll check with you when we find a suitable option.','Pengaturan prioritas aktif. Kami akan menghubungi Anda jika ada pilihan yang sesuai.']
              : ['开启优先安排后，销售客服可为你安排合适班次，再请你确认。','Enable priority arrangements so our team can offer a suitable class for you to confirm.','Aktifkan pengaturan prioritas agar tim kami dapat menawarkan kelas yang cocok untuk Anda konfirmasi.'])}</dd>
            {!details?.priorityRequested&&!activeInvitation&&<dd>
              <button className="enrollment-record-link" type="button" disabled={busy} onClick={onEnablePriority}>
                {t(['开启优先安排','Enable priority arrangements','Aktifkan pengaturan prioritas'])}
              </button>
            </dd>}</div>
          {allowRefundContact&&<div><dt>{requestRefund}</dt>
            <dd>{t(['联系销售或客服。正式受理并登记后结束报名及留位。','Contact sales or support. They will close the enrollment and release any seat held once they formally record the request.','Hubungi tim penjualan atau layanan pelanggan. Pendaftaran berakhir dan kursi dilepas setelah permintaan dicatat.'])}</dd></div>}
        </dl>
      </article>}
      {showTransfers&&invitations.filter(row=>['declined','expired'].includes(row.state)).map(row=>
        <EnrollmentJourneyLink className="enrollment-record-link" key={row.id} to={orderLink('invitation',row.id)}>
          {t(row.state==='declined'?['转班邀请 · 已拒绝','Transfer invitation · Declined','Undangan pindah kelas · Ditolak']
            : ['转班邀请 · 已过期','Transfer invitation · Expired','Undangan pindah kelas · Kedaluwarsa'])}<ArrowRight size={14} aria-hidden="true"/>
        </EnrollmentJourneyLink>)}

      {actions(primary, <>
        {showTransfers&&activeInvitation&&link(viewTransfers,listPath)}
        {showTransfers&&allowRefundContact&&link(requestRefund,refundPath)}
        {!showTransfers&&!pendingProof&&!paidPart&&link(t(['查看其他班次','Browse other classes','Lihat kelas lain']),browsePath)}
        {!showTransfers&&proofPath&&link(t(pendingProof
          ? ['补充已转账凭证','Submit additional proof','Kirim bukti tambahan']
          : ['如果已经转账，提交凭证','Already transferred? Submit proof','Sudah transfer? Kirim bukti']),proofPath)}
      </>)}
    </>;
  }

  return <div className="enrollment-order-result enrollment-aftercare enrollment-result-body">
    {heading&&<h2 className="enrollment-record-section-title">{heading}</h2>}
    {body}
  </div>;
}

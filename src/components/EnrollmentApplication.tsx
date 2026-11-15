import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { formatCurrency } from '../utils/currency';
import { EnrollmentDemandForm, interestOption, waitlistStates, type DemandItem, type Interests } from './EnrollmentInterests';

type Language = 'zh' | 'en' | 'id';
type Copy = readonly [string, string, string];
export const enrollmentStatuses: Record<string, Copy> = {
  awaiting_payment: ['待付款', 'Awaiting payment', 'Menunggu pembayaran'],
  proof_review: ['凭证待财务核实', 'Proof awaiting verification', 'Bukti menunggu verifikasi'],
  partial: ['部分到账', 'Partially paid', 'Pembayaran sebagian'],
  paid: ['报名成功', 'Enrollment confirmed', 'Pendaftaran berhasil'],
  expired: ['订单已终止', 'Order expired', 'Pesanan kedaluwarsa'],
  refunding: ['退款处理中','Refund in progress','Pengembalian diproses'],
  refunded: ['退款已完成','Refund complete','Pengembalian selesai'],
};
export function enrollmentCopy(language: Language, text: Copy) {
  return text[language === 'zh' ? 0 : language === 'id' ? 2 : 1];
}
export async function enrollmentPost(path: string, body: unknown) {
  const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw Error(data.error);
  return data;
}
type Order = { id: string; classId: string; status: string; restored: boolean; price: number; received: number; deadline: string;
  bank?: { name: string; accountName: string; accountNumber: string } };
type Aftercare = {
  originalClassState:string; transfers:{id:string;firstLesson:string;schedule:string}[];
  currentClass:{firstLesson:string;schedule:string};
  invitations:{id:string;targetClassId:string;state:string;expiresAt:string;firstLesson:string;schedule:string}[];
  transferHistory:{source_class_id:string;target_class_id:string;created_at:string}[];
  refundProgress?:{expected:number;refunded:number};
  refund:{mode:string};
};
type OrderSummary = Order & { level: string; firstLesson: string };

export function EnrollmentApplication({ classId, language, full = false, demandOnly = false }: {
  classId?: string; language: Language; full?: boolean; demandOnly?: boolean;
}) {
  const t = (text: Copy) => enrollmentCopy(language,text);
  const [params,setParams] = useSearchParams();
  const orderId = params.get('order');
  const [order,setOrder] = useState<Order>();
  const [aftercare,setAftercare] = useState<Aftercare>();
  const [open,setOpen] = useState(!!orderId || !classId);
  const [orders,setOrders] = useState<OrderSummary[]>();
  const [interests,setInterests] = useState<Interests>();
  const [tab,setTab] = useState(() => ['orders','waitlist','demands'].find(value=>value===params.get('tab')) || 'all');
  const [editDemand,setEditDemand] = useState<DemandItem>();
  const [joined,setJoined] = useState(false);
  const [savedDemand,setSavedDemand] = useState(false);
  const [hasNoSeat,setHasNoSeat] = useState(full);
  const [email,setEmail] = useState('');
  const [name,setName] = useState('');
  const [phone,setPhone] = useState('');
  const [priority,setPriority] = useState(true);
  const [challenge,setChallenge] = useState<string>();
  const [code,setCode] = useState('');
  const [verified,setVerified] = useState(false);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [requestId] = useState(() => crypto.randomUUID());
  const [file,setFile] = useState<File>();
  const base = '/api/enrollment';
  async function getOrder(id:string) {
    const response = await fetch(base+'/orders/'+encodeURIComponent(id),{cache:'no-store'});
    if (!response.ok) throw Error(response.status===401?'enrollment_verification_required':'enrollment_order_not_found');
    setOrder(await response.json());
    const options=await fetch(base+'/orders/'+encodeURIComponent(id)+'/aftercare',{cache:'no-store'});
    if(options.ok) setAftercare(await options.json());
    else setAftercare(undefined);
  }
  async function getOrders() {
    const response = await fetch(base+'/orders',{cache:'no-store'});
    if (response.status === 401) return;
    if (!response.ok) throw Error('enrollment_failed');
    setOrders((await response.json()).orders);
    setVerified(true);
    if (!classId && !demandOnly) {
      const response=await fetch(base+'/interests',{cache:'no-store'});
      if (!response.ok) throw Error('enrollment_failed');
      setInterests(await response.json());
    }
  }
  useEffect(() => setHasNoSeat(full),[full]);
  useEffect(() => { if (orderId) void getOrder(orderId).catch(reason=>setError(reason.message)); },[orderId]);
  useEffect(() => { if (open) void getOrders().catch(reason=>setError(reason.message)); },[open,classId]);
  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError('');
    try { await action(); } catch (cause) {
      const message=(cause as Error).message || 'enrollment_failed';
      if (message==='enrollment_class_full') setHasNoSeat(true);
      if (message==='enrollment_seat_available') setHasNoSeat(false);
      setError(message);
    }
    finally { setBusy(false); }
  }
  function sendCode() {
    return run(async () => { const data=await enrollmentPost(base+'/email/request',{email});setChallenge(data.challengeId);setCode(''); });
  }
  function verify() {
    return run(async () => {
      await enrollmentPost(base+'/email/verify',{email,challengeId:challenge,code});
      setVerified(true);
      if (orderId) await getOrder(orderId);
      else if (!classId) await getOrders();
    });
  }
  function apply() {
    return run(async () => {
      const result=await enrollmentPost(base+'/applications',{ classId,name,phone,priority,requestId });
      const next=new URLSearchParams(params);
      next.set('order',result.id);
      setParams(next,{replace:true,preventScrollReset:true});
      await getOrder(result.id);
    });
  }
  function upload() {
    if (!order || !file) return;
    return run(async () => {
      const path=base+'/orders/'+encodeURIComponent(order.id)+'/proofs';
      const started=await enrollmentPost(path+'/start',{});
      const encoded=await new Promise<string>((resolve,reject)=>{
        const reader=new FileReader();
        reader.onerror=reject;
        reader.onload=()=>resolve(String(reader.result).split(',')[1]||'');
        reader.readAsDataURL(file);
      });
      await enrollmentPost(path+'/finish',{uploadId:started.uploadId,mime:file.type,encoded});
      setFile(undefined);
      await getOrder(order.id);
    });
  }
  const join = () => run(async () => {
    await enrollmentPost(base+'/waitlist',{classId,phone});
    setJoined(true);
  });
  function savePreferences(data: Parameters<React.ComponentProps<typeof EnrollmentDemandForm>['onSave']>[0]) {
    void run(async () => {
      await enrollmentPost(base+'/demands',data);
      if (demandOnly) setSavedDemand(true);
      else {setEditDemand(undefined);await getOrders();}
    });
  }
  function remove(group:'waitlist'|'demands',id:string) {
    void run(async () => {
      await enrollmentPost(base+'/'+group+'/'+encodeURIComponent(id)+'/withdraw',{});
      await getOrders();
    });
  }
  const publicQuery = '?lang='+language;
  const mineLink='/enrollment/mine'+publicQuery;
  const joinText=t(['加入候补','Join waitlist','Masuk daftar tunggu']);
  const applyText=t(['申请这个班','Apply for this class','Daftar kelas ini']);
  function selectOrder(id?:string) {
    const next = new URLSearchParams(params);
    if (id) next.set('order', id);
    else {
      next.delete('order');
      setOrder(undefined);
      setAftercare(undefined);
    }
    setError('');
    setParams(next, { replace:true, preventScrollReset:true });
  }
  const errors: Record<string, Copy> = {
    enrollment_invitation_expired:['邀请已到期。请刷新查看可转班次。','This invitation has expired. Refresh to check available classes.','Undangan kedaluwarsa. Muat ulang untuk melihat kelas.'],
    enrollment_aftercare_conflict:['报名状态已变化，请刷新后再操作。','Your enrollment has changed. Refresh before trying again.','Pendaftaran berubah. Muat ulang sebelum melanjutkan.'],
    enrollment_class_full:['最后一个席位已被占用。','The last seat has been taken.','Kursi terakhir sudah diambil.'],
    enrollment_seat_available:['现在有空位，可以申请这个班。','A seat is available. You can apply now.','Ada kursi tersedia. Anda dapat mendaftar.'],
    enrollment_demand_conflict:['这条需求已更新或撤回，请刷新后查看。','This request has changed or been withdrawn. Refresh to review.','Permintaan berubah atau ditarik. Muat ulang.'],
    enrollment_code_wait:['请稍后再申请验证码。','Wait before requesting another code.','Tunggu sebelum meminta kode baru.'],
    enrollment_invalid_code:['验证码无效或已过期。','The code is invalid or expired.','Kode tidak berlaku atau kedaluwarsa.'],
    enrollment_verification_required:['请验证邮箱后查看报名。','Verify your email to view the order.','Verifikasi email untuk melihat pesanan.'],
    enrollment_invalid_proof:['凭证上传失败。请检查文件后重试。','Upload failed. Check the file and retry.','Unggahan gagal. Periksa file dan coba lagi.'],
  };
  const message=errors[error] || ['操作未完成，请核对后重试。','The action could not be completed. Please review and retry.','Tindakan belum selesai. Periksa dan coba lagi.'];
  function transfer(targetClassId:string,decision:'accept'|'decline',invitationId?:string) {
    if(!order) return;
    void run(async()=>{
      await enrollmentPost(base+'/orders/'+order.id+'/transfer',{classId:order.classId,targetClassId,decision,invitationId,requestId:crypto.randomUUID()});
      await getOrder(order.id);
    });
  }
  if (!open) return <button className="enrollment-action" type="button" onClick={()=>setOpen(true)}>{hasNoSeat?joinText:applyText}</button>;
  return <section className="enrollment-card enrollment-application">
    {error && <p role="alert">{t(message)}</p>}
    {order ? <>
      {!classId && <button type="button" onClick={()=>{selectOrder(); void run(getOrders);}}>
        {t(['返回报名列表','Back to enrollments','Kembali ke daftar pendaftaran'])}
      </button>}
      <h2>{t(order.restored ? ['已恢复原班报名','Enrollment restored','Pendaftaran dipulihkan'] : enrollmentStatuses[order.status])}</h2>
      <p>{t(['报名编号','Order number','Nomor pendaftaran'])} {order.id}</p>
      <p>{t(['应付','Amount due','Tagihan'])} {formatCurrency(order.price,language)} · {t(['实际到账','Verified receipts','Dana terverifikasi'])} {formatCurrency(order.received,language)}</p>
      {order.status==='awaiting_payment' && <p>{t(['付款截止','Payment deadline','Batas pembayaran'])} {new Intl.DateTimeFormat(language==='zh'?'zh-CN':language,{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Jakarta'}).format(new Date(order.deadline))} WIB</p>}
      {order.bank && <p>{order.bank.name} · {order.bank.accountName} · {order.bank.accountNumber}<br/>{t(['模拟账号，请勿转账。','Test account. Do not transfer funds.','Rekening uji. Jangan transfer dana.'])}</p>}
      {aftercare?.originalClassState==='cancelled' && <p>{t(['原班已确认不开班。','The original class will not open.','Kelas asal tidak dibuka.'])}</p>}
      {!!aftercare?.transferHistory.length && aftercare.originalClassState!=='cancelled' && <>
        <p>{t(['已确认转班，原实收已用于目标班。','Transfer confirmed. Your payment was applied to the new class.','Pindah kelas dikonfirmasi. Pembayaran digunakan untuk kelas baru.'])}</p>
        <p>{aftercare.currentClass.firstLesson.replace('T',' ')} WIB · {aftercare.currentClass.schedule}</p>
      </>}
      {!['paid','refunding','refunded'].includes(order.status) && !order.restored && <form onSubmit={event=>{event.preventDefault();void upload();}}>
        <label>{t(['转账凭证','Transfer proof','Bukti transfer'])}<input type="file" accept="image/png,image/jpeg,application/pdf" required onChange={event=>setFile(event.target.files?.[0])}/></label>
        <button className="enrollment-action" type="submit" disabled={busy||!file}>{t(['提交凭证','Submit proof','Kirim bukti'])}</button>
      </form>}
      {aftercare?.invitations.filter(item=>['offered','expired'].includes(item.state)).map(item=><article key={item.id} className="enrollment-card">
        {item.state==='offered' ? <>
          <h3>{t(['转班邀请','Transfer invitation','Undangan pindah kelas'])}</h3>
          <p>{item.firstLesson.replace('T',' ')} WIB · {item.schedule}</p>
          <p>{t(['答复截止','Reply by','Batas jawaban'])} {new Intl.DateTimeFormat(language==='zh'?'zh-CN':language,{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Jakarta'}).format(new Date(item.expiresAt))} WIB</p>
          <button type="button" className="enrollment-action" disabled={busy} onClick={()=>transfer(item.targetClassId,'accept',item.id)}>{t(['确认转班','Confirm transfer','Konfirmasi pindah kelas'])}</button>
          <button type="button" disabled={busy} onClick={()=>transfer(item.targetClassId,'decline',item.id)}>{t(['拒绝邀请','Decline invitation','Tolak undangan'])}</button>
        </> : item.state==='expired' ? <p>{t(['转班邀请已到期','Transfer invitation expired','Undangan pindah kelas kedaluwarsa'])}</p> : null}
      </article>)}
      {aftercare?.transfers.map(item=><article key={item.id} className="enrollment-card">
        <p>{item.firstLesson.replace('T',' ')} WIB · {item.schedule}</p>
        <button className="enrollment-action" type="button" disabled={busy} onClick={()=>transfer(item.id,'accept')}>{t(['转到这个班','Transfer to this class','Pindah ke kelas ini'])}</button>
      </article>)}
      {aftercare?.refundProgress ? <p>{t(['累计已原路退款','Total refunded to original payment','Total dikembalikan ke pembayaran asal'])} {formatCurrency(aftercare.refundProgress.refunded,language)} / {formatCurrency(aftercare.refundProgress.expected,language)}</p>
        : aftercare?.refund.mode==='contact_support' && <Link to={'/contact?lang='+language}>{t(['联系销售客服申请退款','Contact support to request a refund','Hubungi layanan pelanggan untuk meminta pengembalian'])}</Link>}
      {aftercare?.refund.mode==='special_review' && !aftercare.refundProgress && <p>{t([
        '班次已确认开班。因特殊情况需要退出，请联系销售客服核实。',
        'This class is confirmed. Contact support if exceptional circumstances require you to withdraw.',
        'Kelas sudah dikonfirmasi. Hubungi layanan pelanggan jika harus mengundurkan diri karena keadaan khusus.',
      ])} <Link to={'/contact?lang='+language}>{t(['联系销售客服','Contact support','Hubungi layanan pelanggan'])}</Link></p>}
      <button type="button" onClick={()=>void run(()=>getOrder(order.id))}>{t(['刷新状态','Refresh status','Muat ulang status'])}</button>
    </> : !verified ? <form onSubmit={event=>{event.preventDefault();void (challenge?verify():sendCode());}}>
      <h2>{t(['验证邮箱','Verify your email','Verifikasi email'])}</h2>
      <label>{t(['电子邮箱','Email','Email'])}<input type="email" autoComplete="email" required value={email} readOnly={!!challenge} onChange={event=>setEmail(event.target.value)}/></label>
      {challenge && <label>{t(['六位验证码','Six-digit code','Kode enam digit'])}<input autoComplete="one-time-code" required pattern="[0-9]{6}" inputMode="numeric" value={code} onChange={event=>setCode(event.target.value)}/></label>}
      <button className="enrollment-action" type="submit" disabled={busy}>{t(challenge?['验证','Verify','Verifikasi']:['发送验证码','Send code','Kirim kode'])}</button>
      {challenge && <button type="button" disabled={busy} onClick={()=>void sendCode()}>{t(['重发验证码','Resend code','Kirim ulang'])}</button>}
    </form> : demandOnly ? savedDemand ? <><p role="status">{t(['选课需求已保存。','Course preferences saved.','Preferensi kursus disimpan.'])}</p>
      <Link to={mineLink+'&tab=demands'}>{t(['查看我的需求','See my preferences','Lihat preferensi saya'])}</Link></>
      : <EnrollmentDemandForm language={language} busy={busy} onSave={savePreferences}/>
    : !classId ? <div className="enrollment-order-list">
      <div className="enrollment-levels" role="group" aria-label={t(['记录类别','Activity type','Jenis aktivitas'])}>
        {([
          ['all', ['全部','All','Semua'], undefined],
          ['orders',['申请','Applications','Pendaftaran'],orders?.filter(v=>v.status!=='expired'||v.restored).length],
          ['waitlist',['候补','Waitlist','Daftar tunggu'],interests?.waitlist.filter(v=>v.state==='waiting').length],
          ['demands',['选课需求','Course preferences','Preferensi kursus'],interests?.demands.filter(v=>v.state==='active').length],
        ] as const).map(([key,label,count])=><button type="button" key={key} aria-pressed={tab===key} onClick={()=>{setTab(key);setEditDemand(undefined);}}>
          {t(label)}{count!==undefined&&<span className="enrollment-tab-count">{count}</span>}
        </button>)}
      </div>
      <button type="button" onClick={()=>void run(getOrders)} disabled={busy}>{t(['刷新记录','Refresh records','Muat ulang catatan'])}</button>
      {(!orders||!interests) && <p role="status">{t(['正在读取报名…','Loading enrollments…','Memuat pendaftaran…'])}</p>}
      {(tab==='all'||tab==='orders') && orders?.map(row => <article className="enrollment-card" key={row.id}>
        <small>{t(['申请','Application','Pendaftaran'])}</small>
        <p>{row.level} · {row.firstLesson.slice(0,10)} · {t(enrollmentStatuses[row.status])}</p>
        <p>{row.id}</p>
        <button type="button" className="enrollment-action" onClick={()=>selectOrder(row.id)}>{t(['查看报名','View enrollment','Lihat pendaftaran'])}</button>
      </article>)}
      {(tab==='all'||tab==='waitlist') && interests?.waitlist.map(row=><article className="enrollment-card" key={row.id}>
        <small>{t(['候补','Waitlist','Daftar tunggu'])}</small>
        <h2>{row.level} · {row.firstLesson?.slice(0,10)}</h2>
        <p>{t(waitlistStates[row.state])}{row.state==='waiting' && ' · '+t(row.available
          ? ['有空位可申请','Seats available','Kursi tersedia']:['暂无空位','No seats available','Belum ada kursi'])}</p>
        {row.state==='waiting'&&<>
          {row.available&&<Link className="enrollment-action" to={'/enrollment/'+row.classId+publicQuery}>{applyText}</Link>}
          <button type="button" disabled={busy} onClick={()=>remove('waitlist',row.id)}>{t(['取消候补','Cancel waitlist entry','Batalkan daftar tunggu'])}</button>
        </>}
        {row.state==='converted'&&row.orderId&&<button type="button" onClick={()=>selectOrder(row.orderId)}>{t(['查看对应报名','View related application','Lihat pendaftaran terkait'])}</button>}
      </article>)}
      {(tab==='all'||tab==='demands') && interests?.demands.map(row=><article className="enrollment-card" key={row.id}>
        <small>{t(['选课需求','Course preferences','Preferensi kursus'])}</small>
        <h2>{[row.criteria.level,row.criteria.period,row.criteria.format].map(value=>interestOption(language,value)).join(' · ')}</h2>
        <p>{row.state==='withdrawn'?t(['已撤回','Withdrawn','Ditarik']):row.matches.length?t(['有匹配班次','Matching classes available','Ada kelas yang cocok']):t(['等待匹配','Waiting for a match','Menunggu kecocokan'])}</p>
        {row.criteria.notes&&<p>{row.criteria.notes}</p>}
        {row.matches.map(match=><Link key={match.id} to={'/enrollment/'+match.id+publicQuery}>{match.level} · {match.firstLesson.slice(0,10)}</Link>)}
        {row.state==='active'&&<>
          <button type="button" disabled={busy} onClick={()=>setEditDemand(row)}>{t(['修改','Edit','Ubah'])}</button>
          <button type="button" disabled={busy} onClick={()=>remove('demands',row.id)}>{t(['撤回需求','Withdraw request','Tarik permintaan'])}</button>
        </>}
        {editDemand?.id===row.id&&<EnrollmentDemandForm key={row.id+':'+row.revision} language={language} initial={row} busy={busy} onSave={savePreferences}/>}
      </article>)}
      {!!orders&&!!interests&&((tab==='all'&&!orders.length&&!interests.waitlist.length&&!interests.demands.length)||
        (tab==='orders'&&!orders.length)||(tab==='waitlist'&&!interests.waitlist.length)||(tab==='demands'&&!interests.demands.length))
        && <p>{t(['该类别暂无记录。','No records in this category.','Belum ada catatan dalam kategori ini.'])}</p>}
    </div> : joined ? <><p role="status">{t(['候补已登记。','You joined the waitlist.','Anda masuk daftar tunggu.'])}</p>
      <Link to={mineLink+'&tab=waitlist'}>{t(['查看我的候补','View my waitlist','Lihat daftar tunggu saya'])}</Link></>
    : hasNoSeat ? <form onSubmit={event=>{event.preventDefault();void join();}}>
      <h2>{joinText}</h2>
      <label>{t(['WhatsApp／手机号','WhatsApp or phone','WhatsApp atau nomor HP'])}<input type="tel" required value={phone} onChange={event=>setPhone(event.target.value)}/></label>
      <p>{t(['有空位时可以自行申请。','Apply when a seat becomes available.','Daftar saat kursi tersedia.'])}</p>
      <button className="enrollment-action" type="submit" disabled={busy}>{t(['确认加入候补','Confirm waitlist entry','Konfirmasi daftar tunggu'])}</button>
    </form> : <form onSubmit={event=>{event.preventDefault();void apply();}}>
      <h2>{applyText}</h2>
      <label>{t(['学员姓名','Learner name','Nama siswa'])}<input required maxLength={120} value={name} onChange={event=>setName(event.target.value)}/></label>
      <label>{t(['WhatsApp／手机号','WhatsApp or phone','WhatsApp atau nomor HP'])}<input type="tel" required value={phone} onChange={event=>setPhone(event.target.value)}/></label>
      <label><input type="checkbox" checked={priority} onChange={event=>setPriority(event.target.checked)}/> {t(['优先安排顺延或转班方案','Prioritize rescheduling or transfer options','Utamakan opsi penjadwalan ulang atau pindah kelas'])}</label>
      <p>{t(['财务核实足额到账后，报名才算成功。','Enrollment is confirmed after Finance verifies full payment.','Pendaftaran berhasil setelah pembayaran penuh diverifikasi.'])}</p>
      <button className="enrollment-action" type="submit" disabled={busy}>{t(['提交申请','Submit application','Kirim pendaftaran'])}</button>
    </form>}
  </section>;
}

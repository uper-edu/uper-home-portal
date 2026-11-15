import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { formatCurrency } from '../utils/currency';

type Language = 'zh' | 'en' | 'id';
type Copy = readonly [string, string, string];
export const enrollmentStatuses: Record<string, Copy> = {
  awaiting_payment: ['待付款', 'Awaiting payment', 'Menunggu pembayaran'],
  proof_review: ['凭证待财务核实', 'Proof awaiting verification', 'Bukti menunggu verifikasi'],
  partial: ['部分到账', 'Partially paid', 'Pembayaran sebagian'],
  paid: ['报名成功', 'Enrollment confirmed', 'Pendaftaran berhasil'],
  expired: ['订单已终止', 'Order expired', 'Pesanan kedaluwarsa'],
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
type Order = { id: string; status: string; restored: boolean; price: number; received: number; deadline: string;
  bank?: { name: string; accountName: string; accountNumber: string } };
type OrderSummary = Order & { level: string; firstLesson: string };

export function EnrollmentApplication({ classId, language }: { classId?: string; language: Language }) {
  const t = (text: Copy) => enrollmentCopy(language,text);
  const [params,setParams] = useSearchParams();
  const orderId = params.get('order');
  const [order,setOrder] = useState<Order>();
  const [open,setOpen] = useState(!!orderId || !classId);
  const [orders,setOrders] = useState<OrderSummary[]>();
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
  }
  async function getOrders() {
    const response = await fetch(base+'/orders',{cache:'no-store'});
    if (response.status === 401) return;
    if (!response.ok) throw Error('enrollment_failed');
    setOrders((await response.json()).orders);
    setVerified(true);
  }
  useEffect(() => { if (orderId) void getOrder(orderId).catch(reason=>setError(reason.message)); },[orderId]);
  useEffect(() => { if (!classId) void getOrders().catch(reason=>setError(reason.message)); },[classId]);
  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError('');
    try { await action(); } catch (cause) { setError((cause as Error).message || 'enrollment_failed'); }
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
  function selectOrder(id?:string) {
    const next = new URLSearchParams(params);
    if (id) next.set('order', id);
    else {
      next.delete('order');
      setOrder(undefined);
    }
    setError('');
    setParams(next, { replace:true, preventScrollReset:true });
  }
  const errors: Record<string, Copy> = {
    enrollment_class_full:['最后一个席位已被占用。','The last seat has been taken.','Kursi terakhir sudah diambil.'],
    enrollment_code_wait:['请稍后再申请验证码。','Wait before requesting another code.','Tunggu sebelum meminta kode baru.'],
    enrollment_invalid_code:['验证码无效或已过期。','The code is invalid or expired.','Kode tidak berlaku atau kedaluwarsa.'],
    enrollment_verification_required:['请验证邮箱后查看报名。','Verify your email to view the order.','Verifikasi email untuk melihat pesanan.'],
    enrollment_invalid_proof:['凭证上传失败。请检查文件后重试。','Upload failed. Check the file and retry.','Unggahan gagal. Periksa file dan coba lagi.'],
  };
  const message=errors[error] || ['操作未完成，请核对后重试。','The action could not be completed. Please review and retry.','Tindakan belum selesai. Periksa dan coba lagi.'];
  if (!open) return <button className="enrollment-action" type="button" onClick={()=>setOpen(true)}>{t(['申请这个班','Apply for this class','Daftar kelas ini'])}</button>;
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
      {order.status!=='paid' && !order.restored && <form onSubmit={event=>{event.preventDefault();void upload();}}>
        <label>{t(['转账凭证','Transfer proof','Bukti transfer'])}<input type="file" accept="image/png,image/jpeg,application/pdf" required onChange={event=>setFile(event.target.files?.[0])}/></label>
        <button className="enrollment-action" type="submit" disabled={busy||!file}>{t(['提交凭证','Submit proof','Kirim bukti'])}</button>
      </form>}
      <button type="button" onClick={()=>void run(()=>getOrder(order.id))}>{t(['刷新状态','Refresh status','Muat ulang status'])}</button>
    </> : !verified ? <form onSubmit={event=>{event.preventDefault();void (challenge?verify():sendCode());}}>
      <h2>{t(['验证邮箱','Verify your email','Verifikasi email'])}</h2>
      <label>{t(['电子邮箱','Email','Email'])}<input type="email" autoComplete="email" required value={email} readOnly={!!challenge} onChange={event=>setEmail(event.target.value)}/></label>
      {challenge && <label>{t(['六位验证码','Six-digit code','Kode enam digit'])}<input autoComplete="one-time-code" required pattern="[0-9]{6}" inputMode="numeric" value={code} onChange={event=>setCode(event.target.value)}/></label>}
      <button className="enrollment-action" type="submit" disabled={busy}>{t(challenge?['验证','Verify','Verifikasi']:['发送验证码','Send code','Kirim kode'])}</button>
      {challenge && <button type="button" disabled={busy} onClick={()=>void sendCode()}>{t(['重发验证码','Resend code','Kirim ulang'])}</button>}
    </form> : !classId ? <div className="enrollment-order-list">
      {!orders && <p role="status">{t(['正在读取报名…','Loading enrollments…','Memuat pendaftaran…'])}</p>}
      {orders?.length === 0 && <p>{t(['这个邮箱暂无报名。','No enrollments for this email.','Belum ada pendaftaran untuk email ini.'])}</p>}
      {orders?.map(row => <article className="enrollment-card" key={row.id}>
        <p>{row.level} · {row.firstLesson.slice(0,10)} · {t(enrollmentStatuses[row.status])}</p>
        <p>{row.id}</p>
        <button type="button" className="enrollment-action" onClick={()=>selectOrder(row.id)}>{t(['查看报名','View enrollment','Lihat pendaftaran'])}</button>
      </article>)}
    </div> : <form onSubmit={event=>{event.preventDefault();void apply();}}>
      <h2>{t(['申请这个班','Apply for this class','Daftar kelas ini'])}</h2>
      <label>{t(['学员姓名','Learner name','Nama siswa'])}<input required maxLength={120} value={name} onChange={event=>setName(event.target.value)}/></label>
      <label>{t(['WhatsApp／手机号','WhatsApp or phone','WhatsApp atau nomor HP'])}<input type="tel" required value={phone} onChange={event=>setPhone(event.target.value)}/></label>
      <label><input type="checkbox" checked={priority} onChange={event=>setPriority(event.target.checked)}/> {t(['优先安排顺延或转班方案','Prioritize rescheduling or transfer options','Utamakan opsi penjadwalan ulang atau pindah kelas'])}</label>
      <p>{t(['财务核实足额到账后，报名才算成功。','Enrollment is confirmed after Finance verifies full payment.','Pendaftaran berhasil setelah pembayaran penuh diverifikasi.'])}</p>
      <button className="enrollment-action" type="submit" disabled={busy}>{t(['提交申请','Submit application','Kirim pendaftaran'])}</button>
    </form>}
  </section>;
}

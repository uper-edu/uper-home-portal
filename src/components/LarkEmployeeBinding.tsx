import {useEffect,useState} from 'react';
import type {CrmLanguage} from '../utils/crmLanguage';
export function LarkEmployeeBinding({employeeId,lang,onDraftChange,onBindingDraft,disabled=false}:{employeeId:string;lang:CrmLanguage;onDraftChange?:(dirty:boolean)=>void;onBindingDraft?:(draft:any)=>void;disabled?:boolean}){
 const t=(zh:string,en:string,id:string)=>lang==='zh'?zh:lang==='id'?id:en;
 const [method,setMethod]=useState<'mobile'|'email'>('mobile');
 const [binding,setBinding]=useState<any>(null),[email,setEmail]=useState(''),[candidate,setCandidate]=useState<any>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[removing,setRemoving]=useState(false);
 useEffect(()=>{onDraftChange?.(!!email.trim()||!!candidate||removing||busy);},[email,candidate,removing,busy,onDraftChange]);
 useEffect(()=>{onBindingDraft?.(busy?undefined:removing?{remove:true,revision:binding?.revision||0}:candidate?{...candidate,method,revision:binding?.revision||0}:undefined);},[candidate,removing,binding,method,busy,onBindingDraft]);
 const request=async(path:string,body?:any)=>{const r=await fetch('/api/admin/access/'+path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined,cache:'no-store'});const d=await r.json();if(!r.ok)throw Error(d.error);return d;};
 useEffect(()=>{let active=true;request('lark-bindings').then(d=>{if(active)setBinding(d.bindings[employeeId]||null);}).catch(()=>{if(active)setError(t('无法读取Lark绑定','Unable to load Lark binding','Gagal memuat akun Lark'));});return()=>{active=false;};},[employeeId]);
 const run=async(fn:()=>Promise<void>)=>{setBusy(true);setError('');setNotice('');try{await fn();}catch(e){const code=e instanceof Error?e.message:'';const messages:Record<string,string>={
 lark_directory_permission_missing:t('Lark缺少通过邮箱或手机号获取用户ID权限（contact:user.id:readonly）。请开通并发布应用版本。','Enable contact:user.id:readonly and publish the app version.','Aktifkan contact:user.id:readonly dan terbitkan versi aplikasi.'),
 lark_mobile_invalid:t('请输入包含国家区号的手机号，例如 +6281234567890，不含空格。','Enter a phone number with country code, e.g. +6281234567890, without spaces.','Masukkan nomor dengan kode negara, misalnya +6281234567890, tanpa spasi.'),
 lark_identity_method_invalid:t('请选择手机号或登录邮箱，并只填写对应信息。','Choose phone or login email and provide only that identifier.','Pilih nomor telepon atau email login dan isi hanya identitas tersebut.'),
 lark_app_not_configured:t('服务端尚未配置Lark App ID或App Secret。','Lark app credentials are not configured on the server.','Kredensial aplikasi Lark belum diatur di server.'),
 lark_app_auth_failed:t('Lark应用鉴权失败，请核对服务端App ID和App Secret。','Lark authentication failed. Check the server app credentials.','Autentikasi Lark gagal. Periksa kredensial aplikasi di server.'),
 lark_email_invalid:t('请输入有效的Lark登录邮箱。','Enter a valid Lark login email.','Masukkan email login Lark yang valid.'),
 lark_user_not_found:t('未找到该手机号或登录邮箱对应的可用Lark员工，请核对登录信息、企业及通讯录授权范围。','No accessible Lark user found. Check the login phone or email, organization and directory scope.','Pengguna Lark tidak ditemukan. Periksa nomor atau email login, organisasi dan cakupan direktori.'),
 lark_rate_limited:t('Lark请求过于频繁，请稍后重新查询。','Lark rate limit reached. Try the lookup later.','Batas frekuensi Lark tercapai. Coba pencarian nanti.'),
 lark_quota_exhausted:t('Lark API额度已用尽，请管理员核对账户额度。','Lark API quota is exhausted. Ask an administrator to check usage.','Kuota API Lark habis. Minta administrator memeriksa penggunaan.'),
 lark_binding_conflict:t('绑定已被其他管理员修改，请重新打开编辑窗口核对。','Binding changed. Reopen the editor to review.','Hubungan akun berubah. Buka kembali editor untuk memeriksa.'),
 lark_identity_already_bound:t('此Lark账号已绑定其他员工，不能重复绑定。','This Lark account is already bound to another employee.','Akun Lark ini sudah terhubung ke staf lain.')
 };setError(messages[code]||t('操作未完成，请核对应用配置、权限、邮箱或刷新后重试。保存结果未知时请先刷新核对。','Operation incomplete. Check app configuration, permissions and login identifier. Refresh to verify before retrying a save.','Operasi belum selesai. Periksa konfigurasi, izin dan identitas login. Muat ulang untuk memeriksa hasil sebelum menyimpan lagi.'));}finally{setBusy(false);}};
 return <section className="access-lark-binding" aria-label={t('Lark账号绑定','Lark account binding','Akun Lark')}>
 <p>{t('查询仅核对身份，点击底部“保存修改”后生效。','Lookup only verifies identity. Use Save changes below to apply.','Pencarian hanya memeriksa identitas. Gunakan Simpan perubahan di bawah untuk menerapkan.')}</p>
 <p>{binding?.openId?`${t('已绑定','Bound','Terhubung')} · ${binding.mobile||binding.email}`:t('未绑定Lark账号','Lark account not bound','Akun Lark belum terhubung')}</p>
 <label>{t('查询方式','Lookup method','Metode pencarian')}<select value={method} disabled={busy||disabled} onChange={e=>{setRemoving(false);setMethod(e.target.value as 'mobile'|'email');setEmail('');setCandidate(null);setError('');}}><option value="mobile">{t('手机号','Phone number','Nomor telepon')}</option><option value="email">{t('登录邮箱','Login email','Email login')}</option></select></label>
 <label>{method==='mobile'?t('Lark登录手机号','Lark login phone','Nomor login Lark'):t('Lark登录邮箱','Lark login email','Email login Lark')}<input type={method==='mobile'?'tel':'email'} autoComplete="off" value={email} disabled={busy||disabled} onChange={e=>{setRemoving(false);setEmail(e.target.value);setCandidate(null);setError('');}} /></label>
 <small>{method==='mobile'?t('包含国家区号，例如 +6281234567890。','Include the country code, e.g. +6281234567890.','Sertakan kode negara, misalnya +6281234567890.'):t('使用Lark登录方式中绑定的邮箱；不支持员工资料里的企业业务邮箱。','Use the email bound to Lark sign-in, not the corporate business email in the employee profile.','Gunakan email yang terhubung untuk login Lark, bukan email bisnis pada profil staf.')}</small>
 <button type="button" disabled={busy||disabled||!email.trim()} onClick={()=>void run(async()=>setCandidate(await request('lark-lookup',{method,[method]:email})))}>{t('查询账号','Find account','Cari akun')}</button>
 {candidate&&<div><p>{t('待保存绑定','Binding pending save','Hubungan menunggu disimpan')} · {candidate.mobile||candidate.email}</p><p>{candidate.openId}</p><button type="button" disabled={busy||disabled} onClick={()=>{setCandidate(null);setEmail('');}}>{t('取消绑定修改','Cancel binding change','Batalkan perubahan')}</button></div>}
 {binding?.openId&&<button type="button" disabled={busy||disabled} onClick={()=>{setCandidate(null);setEmail('');setRemoving(!removing);}}>{removing?t('撤销解除','Undo removal','Batalkan penghapusan'):t('解除绑定（保存后生效）','Unbind on save','Putuskan saat disimpan')}</button>}
 {removing&&<p role="status">{t('待解除绑定，点击底部“保存修改”后生效。','Removal pending. Use Save changes below to apply.','Pemutusan menunggu. Gunakan Simpan perubahan untuk menerapkan.')}</p>}
 {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
 </section>;
}

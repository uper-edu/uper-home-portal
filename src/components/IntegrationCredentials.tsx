import {AdminTopicHeader} from './admin/AdminTopicHeader';
import {AdminSecondaryActions} from './admin/AdminRecordActions';
import {useEffect,useLayoutEffect,useRef,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {Activity, Bot, Cloud, Database, MessagesSquare, Save} from 'lucide-react';
import type {CrmLanguage} from '../utils/crmLanguage';
import {AdminField,AdminForm,AdminRequiredNote} from './AdminForm';
import {AdminFormActions,AdminFormFeedback,AdminSavedReadError,AdminFormGrid,AdminFormSection,AdminFormSummary,AdminStaticField} from './AdminFormLayout';
import {AdminTopicFrame} from './AdminTopicFrame';
import {AdminPageHeader} from './admin/AdminPageHeader';
import {AiServicePanel} from './AiServicePanel';
import {AdminConfirmation} from './admin/AdminConfirmation';
import {AdminEditor} from './admin/AdminEditor';
import {AdminListState,AdminListTable} from './admin/AdminList';
import {AdminRecordEntry,AdminRowAction} from './admin/AdminListControl';
import {AdminRefreshAction} from './admin/AdminRefreshAction';
import {AdminPageAction} from './admin/AdminPageAction';
import {AdminStatus} from './AdminStatus';
import {formatCrmEventTime} from '../utils/crmOperatingTime';
import {mailSmtpProvider} from '../utils/enrollmentMailConfig';
import {canReplaceCurrentCredential,usesDirectCredentialSetup} from '../utils/integrationCredentialPolicy';

const endpoint='/api/admin/integration-credentials';
const translate=(lang:CrmLanguage)=>(en:string,id:string,zh:string)=>lang==='zh'?zh:lang==='id'?id:en;
async function request(path:string,body?:object) {
  const response=await fetch(path,{cache:'no-store',method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:undefined,
    ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(body?180000:15000)});
  const data=await response.json();
  if(!response.ok)throw Object.assign(Error(data.error),{status:response.status});
  return data;
}
type CredentialDiagnostic={kind:string;replyCode?:number};
type SlotStatus = {revision:number;updatedAt?:string;activeVersion?:string;source:string;keyringReady:boolean;
  context:string[];fields:string[];validation:'manual'|'provider';
  candidate?:{version:string;outcome?:'verified'|'failed';createdAt:string;validating?:boolean;diagnostic?:CredentialDiagnostic}};
type Action='set'|'stage'|'import'|'verify'|'activate'|'revoke';

export function IntegrationCredentialControl({kind,resource,lang,isLight,rowLabel,rowDetails,subject,onDismiss,onChange,renderSummary}:{
  kind:string;resource:string;lang:CrmLanguage;isLight:boolean;rowLabel?:string;rowDetails?:ReactNode;subject?:string;onDismiss?:()=>void;onChange?:()=>void;
  renderSummary?:(state:{status:ReactNode;manage:ReactNode;candidate?:string})=>ReactNode;
}){
  const t=translate(lang);
  const smtp=kind==='smtp';
  const ai=kind==='ai';
  const larkApp=canReplaceCurrentCredential(kind);
  const directSetup=usesDirectCredentialSetup(kind);
  const manualSetup=directSetup&&(kind==='lark-group'||kind==='ga');
  const path=endpoint+'/'+encodeURIComponent(kind)+'/'+encodeURIComponent(resource);
  const pendingKey='uper-credential-op:'+kind+':'+resource;
  const [data,setData]=useState<SlotStatus|null>(null),[failure,setFailure]=useState<'denied'|'error'>(),[notice,setNotice]=useState('');
  const [diagnostic,setDiagnostic]=useState<CredentialDiagnostic>();
  const [busy,setBusy]=useState(false),[editing,setEditing]=useState(false);
  const [savedReadFailed,setSavedReadFailed]=useState(false);
  const [confirm,setConfirm]=useState<Action|null>(null),[values,setValues]=useState<Record<string,string>>({});
  const [pending,setPending]=useState(()=>sessionStorage.getItem(pendingKey)||'');
  const [canResume,setCanResume]=useState(false);
  const [discard,setDiscard]=useState(false);
  const [managing,setManaging]=useState(false);
  const dialogRef=useRef<HTMLDialogElement>(null);
  const previousEditing=useRef(false);
  useLayoutEffect(()=>{
    if(previousEditing.current===editing)return;
    previousEditing.current=editing;
    dialogRef.current?.querySelector<HTMLElement>(editing?'input[type="password"]':'[data-admin-form-title]')?.focus({preventScroll:true});
  },[editing]);
  async function load(){
    try{setData(await request(path));setFailure(undefined);return true;}
    catch(error){setFailure([401,403].includes((error as {status?:number}).status??0)?'denied':'error');setData(null);return false;}
  }
  useEffect(()=>{setData(null);setValues({});setEditing(false);setNotice('');setDiagnostic(undefined);setSavedReadFailed(false);void load();},[path]);
  function close(){
    if(Object.values(values).some(Boolean))setDiscard(true);
    else clearEditor();
  }
  function clearEditor(){setValues({});setEditing(false);setDiscard(false);}
  function clearOperation(){sessionStorage.removeItem(pendingKey);sessionStorage.removeItem(pendingKey+':started');setPending('');setCanResume(false);}
  async function reloadSaved(){
    const read=await load();
    setSavedReadFailed(!read);
    if(read)onChange?.();
  }
  async function showResult(result:{outcome?:string;diagnostic?:CredentialDiagnostic}){
    clearOperation();
    const rejected=result.outcome==='failed';
    setDiagnostic(directSetup&&rejected?result.diagnostic:undefined);
    setNotice(rejected&&(directSetup||!result.diagnostic)?'verification_failed':'');
    if(rejected&&editing)return;
    clearEditor();
    if(rejected){await load();onChange?.();}
    else await reloadSaved();
  }
  async function retrySavedRead(){
    if(busy)return;
    setBusy(true);
    try{await reloadSaved();}finally{setBusy(false);}
  }
  async function change(action:Action,extra:object={}){
    if(!data||pending||busy||savedReadFailed)return;
    setConfirm(null);setBusy(true);setNotice('');setDiagnostic(undefined);
    const requestId=crypto.randomUUID();
    sessionStorage.setItem(pendingKey,requestId);
    sessionStorage.setItem(pendingKey+':started',String(Date.now()));
    setPending(requestId);
    try{
      const result=await request(path,{action,requestId,revision:data.revision,version:data.candidate?.version,...extra});
      await showResult(result);
    }catch(error){
      const failure=error as Error & {status?:number};
      if(failure.status&&failure.status<500){clearOperation();setNotice(failure.message);}
      else setNotice('unknown');
    }finally{setBusy(false);}
  }
  async function check(){
    if(!pending||busy)return;
    setBusy(true);
    try{
      const result=await request(path+'/results/'+pending);
      if(result.state==='committed'){
        await showResult(result);
      }else{
        setNotice('unknown');
        setCanResume(Date.now()-Number(sessionStorage.getItem(pendingKey+':started'))>180000);
      }
    }catch{setNotice('query_failed');}
    finally{setBusy(false);}
  }
  const unsaved=Object.values(values).some(Boolean);
  useEffect(()=>{
    if(!unsaved)return;
    const protect=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};
    window.addEventListener('beforeunload',protect);
    return ()=>window.removeEventListener('beforeunload',protect);
  },[unsaved]);
  const hasCurrent=!!data&&directSetup&&!['revoked','missing'].includes(data.source);
  const editCredential=()=>{setNotice('');setDiagnostic(undefined);setEditing(true);};
  const smtpProvider=smtp?mailSmtpProvider(data?.context[1]??''):undefined;
  const smtpPasswordLabel=smtpProvider==='gmail'?t('App Password','Sandi Aplikasi (App Password)','应用专用密码（App Password）'):
    smtpProvider==='lark'?t('Dedicated password','Kata sandi khusus','专用密码'):t('SMTP password','Kata sandi SMTP','SMTP 密码');
  const labels={
    key:ai?t('API key','Kunci API','API 密钥'):larkApp?t('App secret','Rahasia aplikasi','应用密钥'):
      kind==='ga'?'API Secret':t('Service secret','Rahasia layanan','服务密钥'),password:smtpPasswordLabel,
    webhook:t('Webhook URL','URL webhook','Webhook 地址'),signingKey:t('Signing secret','Rahasia tanda tangan','签名密钥'),
    secretId:'Secret ID',secretKey:'Secret Key',token:t('Temporary token (optional)','Token sementara (opsional)','临时 Token（选填）'),
  };
  const configured=t('Configured','Dikonfigurasi','已配置');
  const credentialStatuses:Record<string,string>={
    managed:configured,legacy:configured,
    revoked:t('Revoked','Dicabut','已撤销'),missing:t('Not configured','Belum dikonfigurasi','未配置'),
    target_changed:t('Target changed','Tujuan berubah','目标已变更'),unavailable:t('Cannot decrypt','Tidak dapat didekripsi','无法解密'),
  };
  const candidate=directSetup?undefined:data?.candidate;
  const replyCode=(directSetup?diagnostic:candidate?.diagnostic)?.replyCode;
  const diagnosticMessages:Record<string,string>={
    ai_auth_rejected:t('The provider rejected this API key or its permissions.','Penyedia menolak kunci API ini atau izinnya.','供应商拒绝了此 API 密钥或其权限。'),
    ai_rate_limited:t('The provider rate limit was reached. Try again later.','Batas permintaan penyedia tercapai. Coba lagi nanti.','供应商请求频率已达上限，请稍后重试。'),
    ai_response_invalid:t('The model did not pass the response, streaming, or extraction checks.','Model tidak lulus uji respons, streaming, atau ekstraksi.','模型未通过回复、流式或提取检查。'),
    ai_check_failed:t('The provider check could not be completed.','Pemeriksaan penyedia tidak dapat diselesaikan.','未能完成供应商核验。'),
    smtp_connection:t('Unable to connect to the SMTP server.','Tidak dapat terhubung ke server SMTP.','无法连接 SMTP 服务器。'),
    smtp_tls:t('SMTP TLS setup or certificate verification failed.','Penyiapan TLS SMTP atau verifikasi sertifikat gagal.','SMTP 加密连接或证书校验失败。'),
    smtp_timeout:t('The SMTP server did not respond in time.','Server SMTP tidak merespons tepat waktu.','SMTP 服务器响应超时。'),
    smtp_auth_rejected:t('The SMTP server rejected sign-in.','Server SMTP menolak autentikasi.','SMTP 服务器拒绝登录。')
      +(typeof replyCode==='number'&&Number.isInteger(replyCode)&&replyCode>=400&&replyCode<=599?` (SMTP ${replyCode})`:''),
    smtp_unsupported_target:t('The SMTP host or port is unsupported.','Host atau port SMTP tidak didukung.','SMTP 主机或端口不受支持。'),
    smtp_unknown:t('SMTP verification failed. No specific reason was available.','Verifikasi SMTP gagal. Penyebabnya tidak dapat dipastikan.','SMTP 核验失败，未能确定具体原因。'),
  };
  const failureReason=diagnosticMessages[(directSetup?diagnostic:candidate?.diagnostic)?.kind??''];
  const notices:Record<string,string>={
    verification_failed:directSetup&&failureReason?failureReason:smtp?t('SMTP verification failed. Check the password.',
      'Verifikasi SMTP gagal. Periksa kata sandi.','SMTP 核验失败，请核对密码。'):ai?t('API key verification failed.',
      'Verifikasi kunci API gagal.','API 密钥核验失败。'):
      larkApp?hasCurrent?t('Could not verify the new key. The current configuration is unchanged.',
        'Kunci baru tidak dapat diverifikasi. Konfigurasi saat ini tetap berlaku.','未能核验新密钥，原配置保持不变。'):
        t('Could not verify the app key. Check the App ID and key.','Kunci aplikasi tidak dapat diverifikasi. Periksa App ID dan kunci.','应用密钥核验失败，请核对 App ID 和密钥。'):
      kind==='ga'?t('The Measurement ID does not match this environment.','ID Pengukuran tidak sesuai dengan lingkungan ini.','衡量 ID 与当前环境不匹配。'):
      kind==='lark-group'?t('Check the Webhook URL and signing settings.','Periksa URL webhook dan pengaturan tanda tangan.','请核对 Webhook 地址和签名设置。'):
      t('Verification failed. Review the candidate credential.','Verifikasi gagal. Periksa kredensial calon.','验证失败，请核对候选凭证。'),
    credential_provider_checks_disabled:t('Provider checks are disabled for this environment.','Pemeriksaan penyedia dinonaktifkan di lingkungan ini.','本环境未启用供应商连接核验。'),
    credential_verification_running:t('Verification is in progress. Refresh to check the result.','Verifikasi sedang berjalan. Segarkan untuk melihat hasil.','正在核验，请刷新查看结果。'),
    credential_invalid:t('Check the credential fields.','Periksa kolom kredensial.','请核对凭证字段。'),
    credential_conflict:t('Settings changed elsewhere. Refresh to review the latest version.','Pengaturan berubah. Segarkan untuk meninjau versi terbaru.','配置已在别处更新，请刷新核对。'),
    credential_validation_required:t('Verify this credential version again before activation.','Verifikasi ulang versi ini sebelum aktivasi.','请重新验证该版本再启用。'),
    credential_revoke_current_required:t('Revoke the current credential before setting a new one.','Cabut kredensial saat ini sebelum mengatur yang baru.','请先撤销当前凭证，再设置新凭证。'),
    credential_forbidden:t('You do not have permission for this action.','Anda tidak memiliki izin untuk tindakan ini.','你没有执行此操作的权限。'),
    unknown:t('Result pending confirmation. Check this operation before retrying.','Hasil menunggu konfirmasi. Periksa tindakan ini sebelum mencoba lagi.','结果待确认，请先核对此操作。'),
    query_failed:t('Result lookup failed. The outcome remains unconfirmed.','Pencarian hasil gagal. Hasil belum terkonfirmasi.','结果查询失败，仍待确认。'),
  };
  const cancel=t('Cancel','Batal','取消');
  const label=t('Credentials','Kredensial','凭证');
  const stage=ai?t('Set API key','Atur kunci API','设置 API 密钥'):smtp?t('Set password','Atur kata sandi','设置密码'):
    larkApp?t('Set app key','Atur kunci aplikasi','设置密钥'):manualSetup?t('Set credential','Atur kredensial','设置凭证'):
    t('Enter candidate','Masukkan kredensial calon','录入候选凭证');
  const replaceKey=t('Replace key','Ganti kunci','更换密钥');
  const manage=t('Manage credentials','Kelola kredensial','管理凭证');
  const currentCredential=t('Current credential','Kredensial saat ini','当前凭证');
  const currentStatus=data&&<AdminStatus tone={['managed','legacy'].includes(data.source)?'success':'neutral'}>{credentialStatuses[data.source]}</AdminStatus>;
  const openDialog=()=>{setManaging(true);if(!savedReadFailed)void load();};
  const manageAction=failure!=='denied'&&<button type="button" className="crm-work-button" aria-haspopup="dialog" onClick={event=>{
    event.currentTarget.focus({preventScroll:true});
    openDialog();
  }}>{manage}</button>;
  const candidateStatus=!candidate?t('No candidate','Belum ada kredensial calon','暂无候选'):
    candidate.validating?t('Verifying','Memverifikasi','核验中'):
    candidate.outcome==='verified'?data?.validation==='manual'?t('Target confirmed','Tujuan dikonfirmasi','目标已核对'):
      t('Verified','Terverifikasi','已核验'):candidate.outcome==='failed'?
      failureReason||t('Verification failed','Verifikasi gagal','验证失败'):t('Awaiting verification','Menunggu verifikasi','待验证');
  const statusLabel=directSetup?currentCredential:t('Credential status','Status kredensial','凭证状态');
  const targetLabel=t('Target','Tujuan','目标');
  const dialogSubject=subject??rowLabel??resource;
  const target=data?.context.filter(Boolean).join(' · ')||'—';
  const showTarget=target!=='—'&&target!==dialogSubject;
  const feedback=busy?<AdminFormFeedback lang={lang} state="saving"/>:notice&&
    <AdminFormFeedback lang={lang} state={['unknown','query_failed'].includes(notice)?'unknown':'error'}>
      {notices[notice]||t('Credential operation failed.','Operasi kredensial gagal.','凭证操作失败。')}
    </AdminFormFeedback>;
  const operationCheck=pending&&!busy&&<AdminFormActions>
    <button type="button" onClick={()=>void check()}>{t('Check operation result','Periksa hasil operasi','核对操作结果')}</button>
    {canResume&&<button type="button" onClick={()=>{clearOperation();void load();}}>
      {t('Reload current configuration','Muat ulang konfigurasi saat ini','重新读取当前配置')}</button>}
    <small>{pending}</small>
  </AdminFormActions>;
  const management=data?<AdminFormSummary fields={[
    [statusLabel,currentStatus],
    ...(!directSetup?[[t('Candidate','Kredensial calon','候选凭证'),candidateStatus] as const]:[]),
    ...(data.updatedAt?[[t('Last change','Perubahan terakhir','最后变更'),formatCrmEventTime(data.updatedAt)] as const]:[]),
    ...(showTarget?[[targetLabel,target,'wide'] as const]:[]),
  ]}/>:savedReadFailed&&failure!=='denied'?<AdminSavedReadError lang={lang} busy={busy} onRetry={()=>void retrySavedRead()}/>:
    <AdminListState lang={lang} state={failure??'loading'} onRetry={savedReadFailed?retrySavedRead:load}/>;
  const fields=data?.fields.map(field=><AdminField key={field} required={field!=='token'}>
    {labels[field as keyof typeof labels]}<input className="admin-text-input" type="password" autoComplete="new-password" spellCheck={false}
      required={field!=='token'} maxLength={4096} value={values[field]??''} disabled={busy}
      onChange={event=>setValues({...values,[field]:event.target.value})}/>
  </AdminField>);
  const confirmAndSave=t('Confirm and save','Konfirmasi dan simpan','核对并保存');
  const saveCredential=<button type="submit" data-primary disabled={busy||!!pending}>{manualSetup?confirmAndSave:directSetup?
    t('Verify and save','Verifikasi dan simpan','核验并保存'):t('Save candidate','Simpan kredensial calon','保存候选凭证')}</button>;
  const submitCredential=(event:React.FormEvent<HTMLFormElement>)=>{
    event.preventDefault();
    if(manualSetup)setConfirm('set');
    else void change(directSetup?'set':'stage',{values});
  };
  const closeDialog=()=>{if(busy)return;if(editing)close();else if(onDismiss)onDismiss();else setManaging(false);};
  const blocked=busy||!!pending;
  const unavailable=blocked||!data?.keyringReady||!!candidate?.validating;
  const verifyCandidate=()=>{if(data?.validation==='manual')setConfirm('verify');else void change('verify');};
  const verifyLabel=data?.validation==='manual'?t('Confirm target','Konfirmasi tujuan','核对目标'):
    t('Verify candidate','Verifikasi kredensial calon','验证候选凭证');
  const verifyAgain=t('Verify again','Verifikasi ulang','重新验证');
  const nextAction=data&&!hasCurrent&&<button type="button" data-primary disabled={unavailable} onClick={()=>{
    if(!candidate)editCredential();
    else if(candidate.outcome==='verified')setConfirm('activate');
    else verifyCandidate();
  }}>{!candidate?stage:candidate.outcome==='verified'?t('Activate candidate','Aktifkan kredensial calon','启用候选凭证'):
    candidate.outcome==='failed'&&data.validation==='provider'?verifyAgain:verifyLabel}</button>;
  const importAction=!directSetup&&data?.source==='legacy'&&<button type="button" disabled={blocked||!data.keyringReady} onClick={()=>setConfirm('import')}>
    {t('Import current credential','Impor kredensial saat ini','导入当前凭证')}</button>;
  const reverify=candidate?.outcome==='verified'&&<button type="button" disabled={unavailable} onClick={verifyCandidate}>{verifyAgain}</button>;
  const revoke=!directSetup&&data&&!['revoked','missing'].includes(data.source)&&<button type="button" disabled={blocked} onClick={()=>setConfirm('revoke')}>
    {t('Revoke current credential','Cabut kredensial saat ini','撤销当前凭证')}</button>;
  const extraActions=!editing&&data&&<>
    <AdminRefreshAction label={t('Refresh','Segarkan','刷新')} loading={busy} onClick={()=>void load()}/>
    {(importAction||reverify||revoke)&&<AdminSecondaryActions label={t('More actions','Tindakan lain','更多操作')} alwaysMenu appearance="header" disabled={blocked}>
      {importAction}{reverify}{revoke}
    </AdminSecondaryActions>}
  </>;

  const dialogs=<>
    {(managing||onDismiss)&&<AdminEditor variant="modal" responsiveForm lang={lang} light={isLight} required={editing} busy={busy}
      title={manage} description={dialogSubject} headerActions={extraActions} dialogRef={dialogRef}
      onClose={closeDialog} onSubmit={editing?submitCredential:undefined}
      footer={<>
        {!editing&&candidate&&<button type="button" disabled={unavailable} onClick={editCredential}>
          {t('Replace candidate','Ganti kredensial calon','替换候选凭证')}</button>}
        <button type="button" disabled={busy} onClick={closeDialog}>{editing?cancel:t('Close','Tutup','关闭')}</button>
        {hasCurrent&&!editing&&<button type="button" disabled={blocked} onClick={()=>setConfirm('revoke')}>
          {t('Revoke current credential','Cabut kredensial saat ini','撤销当前凭证')}</button>}
        {editing?saveCredential:larkApp&&hasCurrent?<button type="button" data-primary disabled={unavailable} onClick={editCredential}>{replaceKey}</button>:nextAction}
      </>}>
      {editing?<>{(manualSetup||larkApp)&&showTarget&&<AdminFormSummary fields={[
        [kind==='ga'?t('Measurement ID','ID Pengukuran','衡量 ID'):targetLabel,target,'wide'],
      ]}/>}<div data-admin-stack>{fields}</div></>:management}
      {!editing&&data&&!data.keyringReady&&<AdminFormFeedback lang={lang} state="error">
        {t('Ask operations to provision the credential keyring.','Minta tim operasional menyiapkan keyring.','请运维配置凭证主密钥文件。')}
      </AdminFormFeedback>}
      {feedback}
      {operationCheck}
    </AdminEditor>}
    {discard&&<AdminConfirmation light={isLight} title={t('Discard unsaved changes?','Buang perubahan?','放弃未保存的更改？')}
      description={t('Values entered here will be cleared.','Nilai yang dimasukkan akan dihapus.','已输入的内容将清空。')}
      cancelLabel={t('Keep editing','Lanjutkan pengeditan','继续编辑')} confirmLabel={t('Discard','Buang','放弃')}
      onCancel={()=>setDiscard(false)} onConfirm={clearEditor}/>}
    {confirm&&<AdminConfirmation light={isLight} danger={confirm==='revoke'} title={t('Confirm credential operation','Konfirmasi operasi kredensial','确认凭证操作')}
      description={confirm==='set'&&kind==='ga'?t('Confirm the Measurement ID and API Secret belong to the same GA data stream. Saving does not send an event.',
        'Pastikan ID Pengukuran dan API Secret berasal dari aliran data GA yang sama. Penyimpanan tidak mengirim peristiwa.',
        '请确认衡量 ID 和 API Secret 属于同一个 GA 数据流。保存不会发送 GA 事件。'):
        confirm==='set'||confirm==='verify'?t('Confirm the displayed target and the credential from its provider. This check does not send a message or event.',
        'Konfirmasikan tujuan dan kredensial penyedia. Pemeriksaan ini tidak mengirim pesan atau peristiwa.','请核对显示的目标及供应商凭证。此核对不会发送消息或事件。'):
        confirm==='revoke'?ai?t('This provider will be unavailable until a new API key is verified and saved. A configured alternative may still handle requests.',
          'Penyedia ini tidak tersedia sampai kunci API baru diverifikasi dan disimpan. Penyedia alternatif yang telah dikonfigurasi masih dapat menangani permintaan.',
          '撤销后，此供应商将暂停服务，直到新的 API 密钥核验并保存。已配置的其他供应商仍可处理请求。'):
          smtp?t('This sender cannot send mail until a new password is verified and saved.',
          'Akun ini tidak dapat mengirim email sampai kata sandi baru diverifikasi dan disimpan.',
          '撤销后，此账号将暂停发信，直至新密码通过核验并保存。'):
          larkApp?t('Lark features that use the app key will be unavailable until a new key is verified and saved.',
            'Fitur Lark yang memakai kunci aplikasi tidak tersedia sampai kunci baru diverifikasi dan disimpan.',
            '撤销后，依赖应用密钥的 Lark 功能将暂停，直至新密钥核验并保存。'):
          kind==='lark-group'?t('This channel cannot deliver group messages until a new Webhook is saved.',
            'Kanal ini tidak dapat mengirim pesan grup sampai Webhook baru disimpan.','撤销后，该渠道将无法发送群消息，直至保存新 Webhook。'):
          kind==='ga'?t('Server-side GA event delivery requires a configured API Secret. The dispatch switch will stay as set.',
            'Pengiriman peristiwa GA dari server memerlukan API Secret. Pengaturan pengiriman tetap sama.','服务端 GA 外发需要配置 API Secret。撤销不会改变外发开关。'):
          t('This integration will stop using the credential, including its legacy source.','Integrasi akan berhenti menggunakan kredensial, termasuk sumber lama.','此集成将停止使用当前凭证和旧来源。'):
        t('This operation applies to the displayed target.','Operasi ini berlaku untuk tujuan yang ditampilkan.','此操作将应用于当前目标。')}
      cancelLabel={cancel} confirmLabel={confirm==='set'?t('Save','Simpan','保存'):t('Confirm','Konfirmasi','确认')} onCancel={()=>setConfirm(null)}
      onConfirm={()=>void change(confirm,confirm==='set'?{confirmed:true,values}:{confirmed:true})}/>}
  </>;
  if(rowLabel)return <>
    <tr>
      <td><strong>{rowLabel}</strong></td>
      {rowDetails&&<td>{rowDetails}</td>}
      <td>{currentStatus??<AdminListState compact lang={lang} state={failure??'loading'} onRetry={savedReadFailed?retrySavedRead:load}/>}</td>
      <td>{failure!=='denied'&&<AdminRowAction aria-haspopup="dialog" onClick={event=>{
        event.currentTarget.focus({preventScroll:true});
        openDialog();
      }}>{manage}</AdminRowAction>}</td>
    </tr>
    {managing&&createPortal(dialogs,document.body)}
  </>;
  return <>
    {!onDismiss&&(renderSummary?renderSummary({
      status:currentStatus??<AdminListState compact lang={lang} state={failure??'loading'} onRetry={savedReadFailed?retrySavedRead:load}/>,
      manage:manageAction,candidate:candidate?candidateStatus:undefined,
    }):<AdminFormSection title={label} actions={manageAction}>
      {data?<dl className="access-record-facts">
        <div><dt>{statusLabel}</dt><dd>{currentStatus}</dd></div>
        {candidate&&<div><dt>{t('Candidate','Kredensial calon','候选凭证')}</dt><dd>{candidateStatus}</dd></div>}
      </dl>:<AdminListState lang={lang} state={failure??'loading'} onRetry={savedReadFailed?retrySavedRead:load}/>}
    </AdminFormSection>)}
    {dialogs}
  </>;
}

type LarkSettingsForm={revision:number;appId:string;tenant:string;callback:string};
type LarkSettingsData={settings:LarkSettingsForm;locked:boolean;groups:{id:string;name:string;mode:string}[]};
const larkSettingsPath=endpoint+'/lark-settings';
const settingsPending='uper-lark-settings-operation';

type IntegrationDisplayProps={lang:CrmLanguage;isLight:boolean};
type IntegrationReadFailure='error'|'denied';

function readFailure(error:unknown):IntegrationReadFailure {
  return [401,403].includes((error as {status?:number})?.status??0)?'denied':'error';
}

function LarkIntegration({lang,isLight,onDraftChange,onBusyChange}:IntegrationDisplayProps&{
  onDraftChange:(dirty:boolean)=>void;onBusyChange:(busy:boolean)=>void;
}){
  const t=translate(lang);
  const [data,setData]=useState<LarkSettingsData|null>(null);
  const [draft,setDraft]=useState<Partial<Omit<LarkSettingsForm,'revision'>>>({});
  const [baseRevision,setBaseRevision]=useState<number>();
  const [loading,setLoading]=useState(true),[failure,setFailure]=useState<IntegrationReadFailure>();
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[awaitingSavedRead,setAwaitingSavedRead]=useState(false);
  const [pending,setPending]=useState(()=>sessionStorage.getItem(settingsPending)||'');
  const load=async()=>{
    setLoading(true);
    try{setData(await request(larkSettingsPath));setFailure(undefined);setAwaitingSavedRead(false);}
    catch(readError){
      const state=readFailure(readError);
      if(state==='denied'){setData(null);setDraft({});setBaseRevision(undefined);}
      setFailure(state);
    }finally{setLoading(false);}
  };
  useEffect(()=>{void load();},[]);
  const fields=[['appId','App ID'],['tenant',t('Tenant key','Kunci tenant','租户标识')],
    ['callback',t('OAuth callback URL','URL callback OAuth','OAuth 回调地址')]] as const;
  const current=data?.settings;
  const settings=current&&{...current,
    ...(!data?.locked?{appId:draft.appId??current.appId,tenant:draft.tenant??current.tenant}:{}),
    callback:draft.callback??current.callback,revision:baseRevision??current.revision,
  };
  const dirty=!!settings&&fields.some(([key])=>settings[key]!==current?.[key]);
  const conflict=dirty&&baseRevision!==current?.revision;
  useEffect(()=>{
    onDraftChange(dirty);
    return ()=>onDraftChange(false);
  },[dirty,onDraftChange]);
  useEffect(()=>{
    onBusyChange(busy);
    return ()=>onBusyChange(false);
  },[busy,onBusyChange]);

  const confirmSaved=async(updated:LarkSettingsForm)=>{
    if(!Number.isInteger(updated?.revision))throw Error('unknown');
    setData(current=>current?{...current,settings:updated}:current);
    sessionStorage.removeItem(settingsPending);setPending('');setDraft({});setBaseRevision(undefined);
    setError('');setAwaitingSavedRead(true);await load();
  };
  const save=async(event:React.FormEvent<HTMLFormElement>)=>{
    event.preventDefault();
    if(!settings||!dirty||busy||pending||loading||failure||conflict||error==='credential_conflict')return;
    const requestId=crypto.randomUUID();
    sessionStorage.setItem(settingsPending,requestId);
    setPending(requestId);setBusy(true);setError('');
    try{const result=await request(larkSettingsPath,{requestId,settings});await confirmSaved(result.settings);}
    catch(e){
      const problem=e as Error&{status?:number};
      if(problem.status&&problem.status<500){
        sessionStorage.removeItem(settingsPending);setPending('');
        if(readFailure(problem)==='denied'){setData(null);setDraft({});setBaseRevision(undefined);setFailure('denied');}
        else setError(problem.message);
      }else setError('unknown');
    }finally{setBusy(false);}
  };
  const check=async()=>{
    if(!pending||busy)return;
    setBusy(true);
    try{
      const result=await request(larkSettingsPath+'/results/'+pending);
      if(result.state==='committed')await confirmSaved(result.settings);
      else setError('unconfirmed');
    }catch(problem){
      if(readFailure(problem)==='denied'){setData(null);setDraft({});setBaseRevision(undefined);setFailure('denied');}
      else setError('unknown');
    }
    finally{setBusy(false);}
  };
  const edit=(key:'appId'|'tenant'|'callback',value:string)=>{
    setDraft(previous=>{
      const next={...(dirty?previous:{}),[key]:value};
      if(value===current?.[key])delete next[key];
      return next;
    });
    if(!dirty)setBaseRevision(current?.revision);
    if(!conflict&&error!=='credential_conflict')setError('');
  };
  const app=t('App and employee binding','Aplikasi dan penautan staf','应用与员工绑定');
  const group=t('Group notifications','Notifikasi grup','群通知');
  const notes:Record<string,string>={
    credential_lark_settings_invalid:t('Check the App ID, tenant key, and the callback URL for this environment.','Periksa App ID, kunci tenant, dan URL callback lingkungan ini.','请核对 App ID、租户标识和当前环境的回调地址。'),
    credential_lark_identity_locked:t('Existing employee bindings lock the App ID and tenant key.','Penautan staf mengunci App ID dan kunci tenant.','已有员工绑定，App ID 和租户标识已锁定。'),
    credential_revoke_current_required:t('Revoke the current app key before changing the app or tenant.','Cabut kunci aplikasi sebelum mengganti aplikasi atau tenant.','更换应用或租户前，请先撤销当前应用密钥。'),
    credential_conflict:t('Settings changed elsewhere. Refresh and review the saved values.','Pengaturan berubah. Segarkan dan tinjau nilai tersimpan.','配置已在别处更新，请刷新并核对已保存值。'),
    unknown:t('Save result is still unknown. Check the operation result first.','Hasil simpan belum diketahui. Periksa hasil operasi dahulu.','保存结果待确认，请先核对操作结果。'),
    unconfirmed:t('No save receipt yet. Check again before editing.','Tanda terima belum tersedia. Periksa lagi sebelum mengedit.','尚未查到保存回执，请再次核对。'),
  };
  const blocked=busy||loading||!!pending||!!failure;
  const label=t('Save','Simpan','保存');
  return <>
    <AdminForm lang={lang} onSubmit={save} className="integration-settings-body">
      <AdminTopicHeader isLight={isLight} title={<>Lark{data&&<AdminRequiredNote lang={lang} inline/>}</>}
        subtitle={t('Set up the Lark app, employee binding and group notifications.','Kelola aplikasi Lark, penautan akun staf, dan notifikasi grup.','配置 Lark 应用，管理员工绑定和群通知凭证。')}
        actions={failure!=='denied'&&<>
          {pending&&<button type="button" className="crm-work-button" disabled={busy} onClick={()=>void check()}>
            {t('Check operation result','Periksa hasil operasi','核对操作结果')}</button>}
          <AdminRefreshAction label={t('Refresh','Segarkan','刷新')} loading={loading} disabled={busy} onClick={()=>void load()}/>
          {data&&!pending&&<AdminPageAction type="submit" icon={Save} label={label} variant="primary"
            disabled={blocked||!dirty||conflict||error==='credential_conflict'}/>}
        </>}/>
      {awaitingSavedRead&&failure==='error'?<AdminSavedReadError lang={lang} busy={loading} onRetry={()=>void load()}/>:(!data||failure)&&<AdminListState lang={lang} state={failure??'loading'} onRetry={load}/>}
      {data&&settings&&<AdminFormSection title={app} variant="card">
        <AdminFormGrid>
          {fields.map(([key,fieldLabel])=>key!=='callback'&&data.locked?
            <AdminStaticField key={key} label={fieldLabel} value={settings[key]}/>:
            <AdminField key={key} required data-admin-full-width={key==='callback'||undefined}>{fieldLabel}
              <input className="admin-text-input" value={settings[key]} type={key==='callback'?'url':'text'}
                disabled={blocked} onChange={event=>edit(key,event.target.value)}/>
            </AdminField>)}
        </AdminFormGrid>
        {data.locked&&<p className="integration-note">{notes.credential_lark_identity_locked}</p>}
        {busy?<AdminFormFeedback lang={lang} state="saving"/>:
          (error||pending)&&<AdminFormFeedback lang={lang} state={pending?'unknown':'error'}>
            {notes[error||'unknown']??t('Could not save app settings.','Pengaturan aplikasi gagal disimpan.','无法保存应用设置。')}
          </AdminFormFeedback>}
        {pending&&error==='unconfirmed'&&<AdminFormActions><button type="button" disabled={busy} onClick={()=>{
          sessionStorage.removeItem(settingsPending);setPending('');setDraft({});setBaseRevision(undefined);setError('');void load();
        }}>{t('Reload current configuration','Muat ulang konfigurasi saat ini','重新读取当前配置')}</button></AdminFormActions>}
        {conflict&&<AdminFormSection variant="subgroup" title={t('Review saved values','Tinjau nilai tersimpan','核对已保存值')}>
          <AdminFormSummary fields={fields.map(([key,fieldLabel])=>[fieldLabel,data.settings[key]||'—',key==='callback'?'wide':undefined])}/>
          <AdminFormActions><button type="button" disabled={blocked} onClick={()=>{setBaseRevision(data.settings.revision);setError('');}}>
            {t('Keep draft after review','Pertahankan draf setelah ditinjau','核对后保留草稿')}</button></AdminFormActions>
        </AdminFormSection>}
      </AdminFormSection>}
    </AdminForm>
    {data&&<IntegrationCredentialControl key={data.settings.revision} kind="lark-app" resource="default" subject="Lark" lang={lang} isLight={isLight}
      renderSummary={({status,manage})=><AdminFormSection variant="card"
        title={t('App credential','Kredensial aplikasi','应用凭证')}>
        <div className="integration-setting-row">
          <div><strong>{t('App secret','Rahasia aplikasi','应用密钥')}</strong>{status}</div>{manage}
        </div>
      </AdminFormSection>}/>}
    {data&&<AdminFormSection title={group} variant="card" actions={<AdminRecordEntry href="/crm?tab=policy&policyTopic=notification-channels">
      {t('Notification channels','Kanal notifikasi','通知渠道')}</AdminRecordEntry>}>
      {data.groups.length?<AdminListTable label={group} headers={[t('Group','Grup','目标群'),t('Delivery mode','Mode pengiriman','投递方式'),
        t('Credential status','Status kredensial','凭证状态'),t('Actions','Tindakan','操作')]}>
        {data.groups.map(row=><IntegrationCredentialControl key={row.id} kind="lark-group" resource={row.id} rowLabel={row.name}
          rowDetails={row.mode==='live'?t('Live','Aktif','真实发送'):t('Simulation','Simulasi','模拟发送')} lang={lang} isLight={isLight}/>)}
      </AdminListTable>:<AdminListState lang={lang} state="empty"/>}
    </AdminFormSection>}
  </>;
}

type GaConfiguration={measurementId:string;dispatchEnabled:boolean;revision:number};

function GaIntegration({lang,isLight}:IntegrationDisplayProps){
  const t=translate(lang),path=endpoint+'/ga-settings';
  const [data,setData]=useState<{settings:GaConfiguration;allowedMeasurementId:string}>();
  const [confirmEnable,setConfirmEnable]=useState(false);
  const [loading,setLoading]=useState(true),[failure,setFailure]=useState<IntegrationReadFailure>();
  const [pendingSettings,setPendingSettings]=useState<GaConfiguration>();
  const [busy,setBusy]=useState(false),[notice,setNotice]=useState('');
  const load=async()=>{
    setLoading(true);
    try{
      const next=await request(path);
      setData(next);setFailure(undefined);
      if(!pendingSettings||(next.settings?.revision>pendingSettings.revision&&
        next.settings.measurementId===pendingSettings.measurementId&&next.settings.dispatchEnabled===pendingSettings.dispatchEnabled)){
        setNotice('');setPendingSettings(undefined);
      }
    }
    catch(error){
      const state=readFailure(error);
      if(state==='denied')setData(undefined);
      setFailure(state);
    }finally{setLoading(false);}
  };
  useEffect(()=>{void load();},[]);
  const reloadNeeded=notice==='unknown'||notice==='credential_conflict';
  const update=async(dispatchEnabled:boolean)=>{
    if(!data||!data.allowedMeasurementId||busy||loading||failure||reloadNeeded)return;
    setConfirmEnable(false);setBusy(true);setNotice('');
    const settings={...data.settings,measurementId:data.allowedMeasurementId,dispatchEnabled};
    try{
      const next=await request(path,{settings});
      if(next.settings?.revision!==settings.revision+1||next.settings.measurementId!==settings.measurementId||
        next.settings.dispatchEnabled!==settings.dispatchEnabled)throw Error('unknown');
      setData(next);
    }
    catch(error){
      const problem=error as Error&{status?:number};
      if(readFailure(problem)==='denied'){setData(undefined);setFailure('denied');}
      else if(problem.status&&problem.status<500)setNotice(problem.message);
      else{setPendingSettings(settings);setNotice('unknown');}
    }finally{setBusy(false);}
  };
  const messages:Record<string,string>={
    credential_ga_settings_invalid:t('Use the measurement ID assigned to this environment.','Gunakan ID pengukuran yang ditetapkan untuk lingkungan ini.','请使用当前环境分配的衡量 ID。'),
    credential_ga_key_required:t('Save the API Secret for this data stream before enabling dispatch.','Simpan API Secret untuk aliran ini sebelum mengaktifkan pengiriman.','请先保存该数据流的 API Secret，再开启外发。'),
    credential_conflict:t('Settings changed. Refresh to review the current setting.','Pengaturan berubah. Segarkan untuk meninjau pengaturan saat ini.','设置已变更，请刷新核对当前状态。'),
  };
  const needsSetup=!!data&&data.settings.measurementId!==data.allowedMeasurementId;
  const enabled=!needsSetup&&data?.settings.dispatchEnabled;
  const enable=t('Enable event delivery','Aktifkan pengiriman peristiwa','开启外发');
  const action=enabled?t('Pause event delivery','Jeda pengiriman peristiwa','暂停外发'):enable;
  const delivery=t('CRM event delivery','Pengiriman peristiwa CRM','CRM 事件外发');
  const blocked=busy||loading||!!failure||reloadNeeded||!data?.allowedMeasurementId;
  return <>
    <AdminTopicHeader isLight={isLight} title="Google Analytics"
      subtitle={t('Review the GA4 data stream and control delivery of CRM payment and refund events.','Tinjau aliran data GA4 serta atur pengiriman peristiwa pembayaran dan pengembalian dana CRM.','核对 GA4 数据流和凭证，管理 CRM 付款与退款事件外发。')} actions={failure!=='denied'&&
      <AdminRefreshAction label={t('Refresh','Segarkan','刷新')} loading={loading} disabled={busy} onClick={()=>void load()}/>}/>
    {(!data||failure)&&<AdminListState lang={lang} state={failure??'loading'} onRetry={load}/>}
    {data&&<IntegrationCredentialControl key={data.settings.measurementId} kind="ga" resource="default" lang={lang} isLight={isLight}
      subject="Google Analytics" renderSummary={({status,manage})=><AdminFormSection
        title={t('Data stream','Aliran data','数据流')} variant="card">
        <div className="integration-setting-row">
          <AdminStaticField label={t('GA4 measurement ID','ID pengukuran GA4','GA4 衡量 ID')} value={data.allowedMeasurementId}/>
          {needsSetup&&<button type="button" className="crm-work-button" disabled={blocked} onClick={()=>void update(false)}>
            {t('Use this environment’s data stream','Gunakan aliran data lingkungan ini','应用当前环境的数据流')}</button>}
        </div>
        {needsSetup&&<p className="integration-note">{t('Applying this data stream leaves CRM event delivery off.',
          'Menerapkan aliran data ini akan membiarkan pengiriman peristiwa CRM nonaktif.','应用数据流后，CRM 事件外发保持关闭。')}</p>}
        <div className="integration-setting-row"><div><strong>API Secret</strong>{status}</div>{manage}</div>
      </AdminFormSection>}/>}
    {data&&<AdminFormSection title={delivery} variant="card">
      <div className="integration-setting-row">
        <div>
          <AdminStatus tone={enabled?'success':'neutral'}>{enabled?t('Enabled','Aktif','已开启'):t('Off','Nonaktif','已关闭')}</AdminStatus>
          <p className="integration-note">{t('Applies to CRM payment and refund events only.',
            'Hanya berlaku untuk peristiwa pembayaran dan pengembalian dana CRM.','仅控制 CRM 付款和退款事件外发。')}</p>
        </div>
        {!needsSetup&&<button type="button" className="crm-work-button" aria-disabled={blocked||undefined}
          aria-haspopup={!enabled?'dialog':undefined} onClick={event=>{
            if(blocked)return;
            if(enabled)void update(false);
            else{event.currentTarget.focus({preventScroll:true});setConfirmEnable(true);}
          }}>{action}</button>}
      </div>
    </AdminFormSection>}
    {(busy||notice)&&<AdminFormFeedback lang={lang} state={busy?'saving':notice==='unknown'?'unknown':'error'}>
      {notice==='unknown'?t('The result is unconfirmed. Refresh to check the delivery status.',
        'Hasil belum terkonfirmasi. Segarkan untuk memeriksa status pengiriman.','外发设置结果待确认，请刷新核对当前状态。'):messages[notice]}
    </AdminFormFeedback>}
    {confirmEnable&&<AdminConfirmation light={isLight} title={enable}
      description={t('Eligible CRM payment and refund events will be sent to Google Analytics for this environment.',
        'Peristiwa pembayaran dan pengembalian dana CRM yang memenuhi syarat akan dikirim ke Google Analytics untuk lingkungan ini.',
        '开启后，符合条件的 CRM 付款和退款事件将发送到当前环境的 Google Analytics 数据流。')}
      cancelLabel={t('Cancel','Batal','取消')} confirmLabel={enable}
      onCancel={()=>setConfirmEnable(false)} onConfirm={()=>void update(true)}/>}
  </>;
}

const integrationTopics={
  llm:{icon:Bot,labels:['AI model services','Layanan model AI','AI 模型服务']},
  lark:{icon:MessagesSquare,labels:['Lark','Lark','Lark']},
  ga:{icon:Activity,labels:['Google Analytics','Google Analytics','Google Analytics']},
  cos:{icon:Cloud,labels:['Object storage','Penyimpanan objek','对象存储']},
  readiness:{icon:Database,labels:['Environment readiness','Kesiapan lingkungan','环境就绪状态']},
} as const;
export type IntegrationTopic=keyof typeof integrationTopics;
export function resolveIntegrationTopic(value:string|null):IntegrationTopic{
  return value&&Object.hasOwn(integrationTopics,value)?value as IntegrationTopic:'llm';
}

function IntegrationReadiness({lang,isLight}:IntegrationDisplayProps){
  const t=translate(lang);
  const [summary,setSummary]=useState<{environment:string;keyringReady:boolean;bootstrap:{database:boolean}}>();
  const [loading,setLoading]=useState(true),[failure,setFailure]=useState<IntegrationReadFailure>();
  const load=async()=>{
    setLoading(true);
    try{setSummary(await request(endpoint));setFailure(undefined);}
    catch(error){
      const state=readFailure(error);
      if(state==='denied')setSummary(undefined);
      setFailure(state);
    }finally{setLoading(false);}
  };
  useEffect(()=>{void load();},[]);
  const ready=(on:boolean)=><AdminStatus tone={on?'success':'neutral'}>
    {on?t('Ready','Siap','就绪'):t('Not ready','Belum siap','未就绪')}
  </AdminStatus>;
  return <>
    <AdminTopicHeader isLight={isLight} title={t(...integrationTopics.readiness.labels)}
      subtitle={t('Check whether the database and credential keyring are ready in this environment.','Periksa kesiapan basis data dan kumpulan kunci kredensial di lingkungan ini.','检查当前环境的数据库连接和凭证主密钥是否就绪。')} actions={failure!=='denied'&&
      <AdminRefreshAction label={t('Refresh','Segarkan','刷新')} loading={loading} onClick={()=>void load()}/>}/>
    {(!summary||failure)&&<AdminListState lang={lang} state={failure??'loading'} onRetry={load}/>}
    {summary&&<AdminFormSection variant="card" title={t('Deployment checks','Pemeriksaan penerapan','部署检查')}>
      <AdminFormSummary fields={[
        [t('Environment','Lingkungan','环境'),summary.environment],
        [t('Credential keyring','Keyring kredensial','凭证主密钥'),ready(summary.keyringReady)],
        [t('Database connection','Koneksi basis data','数据库连接'),ready(summary.bootstrap.database)],
      ]}/>
    </AdminFormSection>}
  </>;
}

export function IntegrationCredentialsOverview({lang,isLight,topic,onTopicChange,onDraftChange,onBusyChange}:IntegrationDisplayProps&{
  topic:IntegrationTopic;onTopicChange:(topic:IntegrationTopic)=>void;
  onDraftChange:(dirty:boolean)=>void;onBusyChange:(busy:boolean)=>void;
}){
  const t=translate(lang);
  const languageIndex=lang==='zh'?2:lang==='id'?1:0;
  const title=t('Integrations','Integrasi','集成配置');
  const llm=t(...integrationTopics.llm.labels),cos=t(...integrationTopics.cos.labels);
  const providerCredentials=t('Provider credentials','Kredensial penyedia','供应商凭证');
  const credentialStatus=t('Credential status','Status kredensial','凭证状态');
  const [visited,setVisited]=useState<IntegrationTopic[]>([topic]);
  const [larkDraft,setLarkDraft]=useState(false);
  const [aiDraft,setAiDraft]=useState(false);
  const [larkBusy,setLarkBusy]=useState(false);
  const [aiBusy,setAiBusy]=useState(false);
  const dirty=larkDraft||aiDraft,busy=larkBusy||aiBusy;
  useEffect(()=>{
    setVisited(previous=>previous.includes(topic)?previous:[...previous,topic]);
  },[topic]);
  useEffect(()=>{
    onDraftChange(dirty);
    return ()=>onDraftChange(false);
  },[dirty,onDraftChange]);
  useEffect(()=>{
    onBusyChange(busy);
    return ()=>onBusyChange(false);
  },[busy,onBusyChange]);
  const show=(name:IntegrationTopic)=>topic===name||visited.includes(name);
  return <section className="integration-credentials-overview crm-ops-workspace-sample" data-theme={isLight?'light':'dark'}>
    <AdminPageHeader title={title} subtitle={t('Manage connections and credentials for AI, Lark, Google Analytics and object storage.','Kelola koneksi dan kredensial untuk AI, Lark, Google Analytics, dan penyimpanan objek.','管理 AI、Lark、Google Analytics 和对象存储的连接设置与凭证。')}/>
    <AdminTopicFrame label={title} selection={topic} navigation={
      <nav className="crm-ops-nav" aria-label={title}>
        {(Object.entries(integrationTopics) as [IntegrationTopic,(typeof integrationTopics)[IntegrationTopic]][]).map(([id,{icon:Icon,labels}])=>
          <button key={id} type="button" aria-current={id===topic?'page':undefined} onClick={()=>onTopicChange(id)}>
            <Icon size={16} aria-hidden="true"/>{labels[languageIndex]}
            {(id==='lark'&&larkDraft||id==='llm'&&aiDraft)&&<span aria-label={t('Unsaved changes','Perubahan belum disimpan','有未保存修改')}> ●</span>}
          </button>)}
      </nav>
    }>
      {show('llm')&&<div hidden={topic!=='llm'} className="integration-settings-body">
        <AiServicePanel lang={lang} isLight={isLight} onDraftChange={setAiDraft} onBusyChange={setAiBusy}
          renderHeading={(actions,required)=><AdminTopicHeader isLight={isLight} actions={actions}
            subtitle={t('Choose primary and fallback models, verify provider credentials and review call history.','Pilih model utama dan cadangan, periksa kredensial penyedia, dan tinjau riwayat panggilan.','设置主备模型和推理强度，核对供应商凭证及调用记录。')}
            title={<>{llm}{required&&<AdminRequiredNote lang={lang} inline/>}</>}/>}>
          <AdminFormSection title={providerCredentials} variant="card">
            <AdminListTable className="llm-credentials-table" label={providerCredentials}
              headers={[t('Provider','Penyedia','供应商'),credentialStatus,t('Actions','Tindakan','操作')]}>
              <IntegrationCredentialControl kind="ai" resource="openai" rowLabel="OpenAI" lang={lang} isLight={isLight}/>
              <IntegrationCredentialControl kind="ai" resource="deepseek" rowLabel="DeepSeek" lang={lang} isLight={isLight}/>
              <IntegrationCredentialControl kind="ai" resource="anthropic" rowLabel="Anthropic (Claude)" lang={lang} isLight={isLight}/>
            </AdminListTable>
          </AdminFormSection>
        </AiServicePanel>
      </div>}
      {show('lark')&&<div hidden={topic!=='lark'} className="integration-settings-body">
        <LarkIntegration lang={lang} isLight={isLight} onDraftChange={setLarkDraft} onBusyChange={setLarkBusy}/>
      </div>}
      {show('ga')&&<div hidden={topic!=='ga'} className="integration-settings-body">
        <GaIntegration lang={lang} isLight={isLight}/>
      </div>}
      {show('cos')&&<div hidden={topic!=='cos'} className="integration-settings-body">
        <AdminTopicHeader isLight={isLight} title={cos}
          subtitle={t('Manage the credentials used to access CMS media storage.','Kelola kredensial untuk mengakses penyimpanan media CMS.','管理 CMS 媒体存储的访问凭证，查看配置和核验状态。')}/>
        <IntegrationCredentialControl kind="cos" resource="default" lang={lang} isLight={isLight} subject={cos}
          renderSummary={({status,manage,candidate})=><AdminFormSection title={t('Access credentials','Kredensial akses','访问凭证')} variant="card">
            <div className="integration-setting-row"><div><strong>{credentialStatus}</strong>{status}</div>{manage}</div>
            {candidate&&<AdminFormSummary fields={[[t('Candidate','Kredensial calon','候选凭证'),candidate]]}/>}
          </AdminFormSection>}/>
      </div>}
      {show('readiness')&&<div hidden={topic!=='readiness'} className="integration-settings-body">
        <IntegrationReadiness lang={lang} isLight={isLight}/>
      </div>}
    </AdminTopicFrame>
  </section>;
}

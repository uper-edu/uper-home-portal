import {AdminSecondaryActions} from './admin/AdminRecordActions';
import {useEffect,useLayoutEffect,useRef,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import type {CrmLanguage} from '../utils/crmLanguage';
import {AdminField} from './AdminForm';
import {AdminFormActions,AdminFormFeedback,AdminFormGrid,AdminFormSection,AdminFormSummary,AdminStaticField} from './AdminFormLayout';
import {AdminConfirmation} from './admin/AdminConfirmation';
import {AdminEditor} from './admin/AdminEditor';
import {AdminListState,AdminListTable} from './admin/AdminList';
import {AdminRecordEntry,AdminRowAction} from './admin/AdminListControl';
import {AdminRefreshAction} from './admin/AdminRefreshAction';
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
  renderSummary?:(state:{status:ReactNode;manage:ReactNode})=>ReactNode;
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
    try{setData(await request(path));setFailure(undefined);}
    catch(error){setFailure([401,403].includes((error as {status?:number}).status??0)?'denied':'error');setData(null);}
  }
  useEffect(()=>{setData(null);setValues({});setEditing(false);setNotice('');setDiagnostic(undefined);void load();},[path]);
  function close(){
    if(Object.values(values).some(Boolean))setDiscard(true);
    else clearEditor();
  }
  function clearEditor(){setValues({});setEditing(false);setDiscard(false);}
  function clearOperation(){sessionStorage.removeItem(pendingKey);sessionStorage.removeItem(pendingKey+':started');setPending('');setCanResume(false);}
  function showResult(result:{outcome?:string;diagnostic?:CredentialDiagnostic}){
    clearOperation();
    clearEditor();
    setDiagnostic(directSetup&&result.outcome==='failed'?result.diagnostic:undefined);
    setNotice(result.outcome==='failed'?(directSetup||!result.diagnostic?'verification_failed':''):'saved');
  }
  async function change(action:Action,extra:object={}){
    if(!data||pending||busy)return;
    setConfirm(null);setBusy(true);setNotice('');setDiagnostic(undefined);
    const requestId=crypto.randomUUID();
    sessionStorage.setItem(pendingKey,requestId);
    sessionStorage.setItem(pendingKey+':started',String(Date.now()));
    setPending(requestId);
    try{
      const result=await request(path,{action,requestId,revision:data.revision,version:data.candidate?.version,...extra});
      showResult(result);
      await load();onChange?.();
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
        showResult(result);
        await load();onChange?.();
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
    saved:t('Change recorded.','Perubahan tercatat.','操作已记录。'),
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
  const openDialog=()=>{setManaging(true);void load();};
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
    <AdminFormFeedback lang={lang} state={notice==='saved'?'saved':['unknown','query_failed'].includes(notice)?'unknown':'error'}>
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
  ]}/>:<AdminListState lang={lang} state={failure??'loading'} onRetry={load}/>;
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
      <td>{currentStatus??<AdminListState compact lang={lang} state={failure??'loading'} onRetry={load}/>}</td>
      <td>{failure!=='denied'&&<AdminRowAction aria-haspopup="dialog" onClick={event=>{
        event.currentTarget.focus({preventScroll:true});
        openDialog();
      }}>{manage}</AdminRowAction>}</td>
    </tr>
    {managing&&createPortal(dialogs,document.body)}
  </>;
  return <>
    {!onDismiss&&(renderSummary?renderSummary({
      status:currentStatus??<AdminListState compact lang={lang} state={failure??'loading'} onRetry={load}/>,
      manage:manageAction,
    }):<AdminFormSection title={label} actions={manageAction}>
      {data?<dl className="access-record-facts">
        <div><dt>{statusLabel}</dt><dd>{currentStatus}</dd></div>
        {candidate&&<div><dt>{t('Candidate','Kredensial calon','候选凭证')}</dt><dd>{candidateStatus}</dd></div>}
      </dl>:<AdminListState lang={lang} state={failure??'loading'} onRetry={load}/>}
    </AdminFormSection>)}
    {dialogs}
  </>;
}

type LarkSettingsForm={revision:number;appId:string;tenant:string;callback:string};
type LarkSettingsData={settings:LarkSettingsForm;locked:boolean;groups:{id:string;name:string;mode:string}[]};
const larkSettingsPath=endpoint+'/lark-settings';
const settingsPending='uper-lark-settings-operation';

function LarkIntegration({lang,isLight}:{lang:CrmLanguage;isLight:boolean}){
  const t=translate(lang),[data,setData]=useState<LarkSettingsData|null>(null);
  const [draft,setDraft]=useState<LarkSettingsForm|null>(null),[discard,setDiscard]=useState(false);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false);
  const [loadError,setLoadError]=useState(false);
  const [pending,setPending]=useState(()=>sessionStorage.getItem(settingsPending)||'');
  const load=async()=>{
    try{setData(await request(larkSettingsPath));setLoadError(false);}
    catch{setLoadError(true);}
  };
  useEffect(()=>{void load();},[]);
  const dirty=!!draft&&JSON.stringify(draft)!==JSON.stringify(data?.settings);
  useEffect(()=>{
    if(!dirty)return;
    const protect=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};
    window.addEventListener('beforeunload',protect);
    return ()=>window.removeEventListener('beforeunload',protect);
  },[dirty]);
  const close=()=>{
    if(pending||busy)return;
    if(dirty)setDiscard(true);
    else setDraft(null);
  };
  const confirmSaved=async()=>{
    sessionStorage.removeItem(settingsPending);setPending('');setDraft(null);setError('');setSaved(true);await load();
  };
  const save=async(event:React.FormEvent<HTMLFormElement>)=>{
    event.preventDefault();
    if(!draft||!dirty||busy||pending)return;
    const requestId=crypto.randomUUID();
    sessionStorage.setItem(settingsPending,requestId);
    setPending(requestId);setBusy(true);setError('');
    try{await request(larkSettingsPath,{requestId,settings:draft});await confirmSaved();}
    catch(e){
      const failure=e as Error&{status?:number};
      if(failure.status&&failure.status<500){sessionStorage.removeItem(settingsPending);setPending('');setError(failure.message);}
      else setError('unknown');
    }finally{setBusy(false);}
  };
  const check=async()=>{
    setBusy(true);
    try{
      const result=await request(larkSettingsPath+'/results/'+pending);
      if(result.state==='committed')await confirmSaved();
      else setError('unconfirmed');
    }catch{setError('unknown');}
    finally{setBusy(false);}
  };
  const fields=[['appId','App ID'],['tenant',t('Tenant key','Kunci tenant','租户标识')],
    ['callback',t('OAuth callback URL','URL callback OAuth','OAuth 回调地址')]] as const;
  const app=t('App and employee binding','Aplikasi dan penautan staf','应用与员工绑定');
  const group=t('Group notifications','Notifikasi grup','群通知');
  const edit=t('Edit app settings','Edit pengaturan aplikasi','编辑应用设置');
  const cancel=t('Cancel','Batal','取消');
  const notes:Record<string,string>={
    credential_lark_settings_invalid:t('Check the App ID, tenant key, and the callback URL for this environment.','Periksa App ID, kunci tenant, dan URL callback lingkungan ini.','请核对 App ID、租户标识和当前环境的回调地址。'),
    credential_lark_identity_locked:t('Existing employee bindings lock the App ID and tenant key.','Penautan staf mengunci App ID dan kunci tenant.','已有员工绑定，App ID 和租户标识已锁定。'),
    credential_revoke_current_required:t('Revoke the current app key before changing the app or tenant.','Cabut kunci aplikasi sebelum mengganti aplikasi atau tenant.','更换应用或租户前，请先撤销当前应用密钥。'),
    credential_conflict:t('Configuration changed. Reload and review before saving again.','Konfigurasi berubah. Muat ulang sebelum menyimpan lagi.','配置已更新，请重新打开并核对后保存。'),
    unknown:t('Save result is still unknown. Check the operation result first.','Hasil simpan belum diketahui. Periksa hasil operasi dahulu.','保存结果待确认，请先核对操作结果。'),
    unconfirmed:t('No save receipt yet. Check again before editing.','Tanda terima belum tersedia. Periksa lagi sebelum mengedit.','尚未查到保存回执，请再次核对。'),
  };
  const feedback=<>
    {error&&<AdminFormFeedback lang={lang} state={pending?'unknown':'error'}>{notes[error]??t('Could not save app settings.','Pengaturan aplikasi gagal disimpan.','无法保存应用设置。')}</AdminFormFeedback>}
    {pending&&<AdminFormActions><button type="button" disabled={busy} onClick={()=>void check()}>
      {t('Check operation result','Periksa hasil operasi','核对操作结果')}</button>
      {error==='unconfirmed'&&<button type="button" disabled={busy} onClick={()=>{
        sessionStorage.removeItem(settingsPending);setPending('');setDraft(null);setError('');void load();
      }}>{t('Reload current configuration','Muat ulang konfigurasi saat ini','重新读取当前配置')}</button>}
    </AdminFormActions>}
  </>;
  return <AdminFormSection title={<><img src="/images/lark-mark.png" alt="" width={20} height={20}/>Lark</>} variant="card" className="lark-integration">
    {!data||loadError?<AdminListState lang={lang} state={loadError?'error':'loading'} onRetry={load}/>:<>
      <IntegrationCredentialControl key={data.settings.revision} kind="lark-app" resource="default" subject={app} lang={lang} isLight={isLight}
        renderSummary={({status,manage})=><AdminFormSection variant="subgroup" title={app} actions={<div className="lark-app-actions">
        <button type="button" className="crm-work-button" aria-haspopup="dialog" disabled={!!pending} onClick={()=>{
        setDraft(data.settings);setError('');setSaved(false);
        }}>{edit}</button>{manage}
      </div>}>
        <AdminFormSummary fields={[
          [fields[0][1],data.settings.appId||'—'],
          [fields[1][1],data.settings.tenant||'—'],
          [t('Current credential','Kredensial saat ini','当前凭证'),status],
          [fields[2][1],data.settings.callback||'—','wide'],
        ]}/>
        {data.locked&&<p className="integration-note">{notes.credential_lark_identity_locked}</p>}
        {saved&&<AdminFormFeedback lang={lang} state="saved"/>}
        {!draft&&feedback}
      </AdminFormSection>}/>
      <AdminFormSection variant="subgroup" title={group} className="lark-group-section" actions={<AdminRecordEntry href="/crm?tab=policy&policyTopic=notification-channels">
        {t('Notification channels','Kanal notifikasi','通知渠道')}</AdminRecordEntry>}>
        {data.groups.length?<AdminListTable label={group} headers={[t('Group','Grup','目标群'),t('Delivery mode','Mode pengiriman','投递方式'),
          t('Current credential','Kredensial saat ini','当前凭证'),t('Actions','Tindakan','操作')]}>
          {data.groups.map(row=><IntegrationCredentialControl key={row.id} kind="lark-group" resource={row.id} rowLabel={row.name}
            rowDetails={row.mode==='live'?t('Live','Aktif','真实发送'):t('Simulation','Simulasi','模拟发送')} lang={lang} isLight={isLight}/>)}
        </AdminListTable>:<AdminListState lang={lang} state="empty"/>}
      </AdminFormSection>
    </>}
    {draft&&<AdminEditor variant="drawer" responsiveForm lang={lang} light={isLight} title={edit} required busy={busy} closeDisabled={!!pending}
      onClose={close} onSubmit={save} footer={<><button type="button" disabled={busy||!!pending} onClick={close}>{cancel}</button>
        <button type="submit" data-primary disabled={busy||!!pending||!dirty}>{t('Save','Simpan','保存')}</button></>}>
      <div data-admin-stack>
        <AdminFormGrid>
          {fields.map(([key,label])=>key!=='callback'&&data?.locked?
            <AdminStaticField key={key} label={label} value={draft[key]}/>:
            <AdminField key={key} required data-admin-full-width={key==='callback'||undefined}>{label}
              <input className="admin-text-input" value={draft[key]}
                type={key==='callback'?'url':'text'} disabled={busy||!!pending} onChange={event=>setDraft({...draft,[key]:event.target.value})}/>
            </AdminField>)}
        </AdminFormGrid>
        {data?.locked&&<p className="integration-note">{notes.credential_lark_identity_locked}</p>}
        {feedback}
      </div>
    </AdminEditor>}
    {discard&&<AdminConfirmation light={isLight} title={t('Discard unsaved changes?','Buang perubahan?','放弃未保存的更改？')}
      description={t('The stored app settings will stay as they are.','Pengaturan aplikasi yang tersimpan tetap berlaku.','已保存的应用设置保持原样。')}
      cancelLabel={cancel} confirmLabel={t('Discard','Buang','放弃')} onCancel={()=>setDiscard(false)}
      onConfirm={()=>{setDraft(null);setDiscard(false);}}/>}
  </AdminFormSection>;
}

export function IntegrationCredentialsOverview({lang,isLight}:{lang:CrmLanguage;isLight:boolean}){
  const t=translate(lang);
  const llmCredentials=t('LLM credentials','Kredensial LLM','LLM 凭证');
  const [summary,setSummary]=useState<{environment:string;keyringReady:boolean;bootstrap:{database:boolean;recovery:boolean};gaEnabled:boolean}|null>(null);
  const [busy,setBusy]=useState(true);
  const load=async()=>{setBusy(true);try{setSummary(await request(endpoint));}catch{setSummary(null);}finally{setBusy(false);}};
  useEffect(()=>{void load();},[]);
  const ready=(on:boolean)=>on?t('Ready','Siap','就绪'):t('Not ready','Belum siap','未就绪');
  return <div className="integration-credentials-overview">
    <header className="admin-page-toolbar"><h1>{t('Integration credentials','Kredensial integrasi','集成凭证')}</h1>
      <div className="integration-toolbar-actions">
        <nav aria-label={t('Credentials by workspace','Kredensial per ruang kerja','业务配置入口')}>
          <AdminRecordEntry href="/system?tab=ai">{t('AI services','Layanan AI','AI 服务配置')}</AdminRecordEntry>
          <AdminRecordEntry href="/system?tab=mail">{t('Email configuration','Konfigurasi email','邮件配置')}</AdminRecordEntry>
        </nav>
        <AdminRefreshAction label={t('Refresh','Segarkan','刷新')} loading={busy} onClick={()=>void load()}/>
      </div>
    </header>
    <AdminFormSection variant="subgroup" title={t('Environment readiness','Kesiapan lingkungan','环境就绪状态')}>
      {summary?<AdminFormSummary fields={[
        [t('Environment','Lingkungan','环境'),summary.environment],
        [t('Credential keyring','Keyring kredensial','凭证主密钥'),ready(summary.keyringReady)],
        [t('Database connection','Koneksi basis data','数据库连接'),ready(summary.bootstrap.database)],
        [t('Recovery signing','Tanda tangan pemulihan','恢复签名'),ready(summary.bootstrap.recovery)],
        [t('GA event dispatch','Pengiriman peristiwa GA','GA 外发'),summary.gaEnabled?t('Enabled','Aktif','已启用'):t('Off','Nonaktif','关闭')],
      ]}/>:<AdminListState lang={lang} state={busy?'loading':'error'}/>}
    </AdminFormSection>
    <AdminFormSection title={llmCredentials} variant="card">
      <AdminListTable className="llm-credentials-table" label={llmCredentials}
        headers={[t('Provider','Penyedia','供应商'),t('Current credential','Kredensial saat ini','当前凭证'),t('Actions','Tindakan','操作')]}>
        <IntegrationCredentialControl kind="ai" resource="openai" rowLabel="OpenAI" lang={lang} isLight={isLight}/>
        <IntegrationCredentialControl kind="ai" resource="deepseek" rowLabel="DeepSeek" lang={lang} isLight={isLight}/>
      </AdminListTable>
    </AdminFormSection>
    <LarkIntegration lang={lang} isLight={isLight}/>
    {([['ga','Google Analytics','Google Analytics','Google Analytics'],
      ['cos','Object storage','Penyimpanan objek','对象存储']] as const).map(([kind,en,id,zh])=>
      <AdminFormSection key={kind} title={t(en,id,zh)} variant="card">
        <IntegrationCredentialControl kind={kind} resource="default" lang={lang} isLight={isLight}
          subject={t(en,id,zh)}/>
      </AdminFormSection>)}
  </div>;
}

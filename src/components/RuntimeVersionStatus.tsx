import {useEffect,useId,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import type {CrmLanguage} from '../utils/crmLanguage';
declare const __UPER_BUILD__: {buildId:string;dirty:boolean;environment:string} | null;
const build=typeof __UPER_BUILD__==='undefined'?null:__UPER_BUILD__;
const words=(lang:CrmLanguage,en:string,id:string,zh:string)=>lang==='zh'?zh:lang==='id'?id:en;
const validCommit=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{40}$/.test(value);
export function versionTime(value:unknown,lang:CrmLanguage,compact=false){
 if(typeof value!=='string'||!Number.isFinite(Date.parse(value)))return words(lang,'Not recorded','Belum dicatat','未记录');
 return new Date(value).toISOString().slice(0,compact?16:19).replace('T',' ')+' UTC';
}
function environmentLabel(version:any,lang:CrmLanguage){return version?.environment==='dev'?words(lang,'Local','Lokal','本地'):version?.environment==='test'?words(lang,'Test','Uji','测试'):version?.environment==='prod'?words(lang,'Production','Produksi','生产'):words(lang,'Unknown','Tidak diketahui','未确认');}
function sourceState(version:any,lang:CrmLanguage){
 const t=(en:string,id:string,zh:string)=>words(lang,en,id,zh),source=version?.mode==='source';
 if(version?.backend?.dirty===false)return source?t('No uncommitted changes at startup','Tanpa perubahan yang belum dikomit saat mulai','启动时无未提交改动'):t('No uncommitted changes at build','Tanpa perubahan yang belum dikomit saat build','构建时无未提交改动');
 if(version?.backend?.dirty===true)return source?t('Uncommitted changes at startup','Perubahan yang belum dikomit saat mulai','启动时含未提交改动'):t('Uncommitted changes at build','Perubahan yang belum dikomit saat build','构建时含未提交改动');
 return t('Unknown','Tidak diketahui','未确认');
}
export function VersionDetails({lang,version,failed=false,frontend=build,onCopy}:{lang:CrmLanguage;version:any;failed?:boolean;frontend?:typeof build;onCopy?:(kind:'Code'|'Build',value:string)=>void}){
 const t=(en:string,id:string,zh:string)=>words(lang,en,id,zh),commit=version?.backend?.gitCommit,buildId=version?.backend?.buildId;
 const mismatch=frontend&&buildId&&frontend.buildId!==buildId;
 const copy=(kind:'Code'|'Build',value:string)=><button type="button" className="runtime-copy" disabled={!onCopy} aria-label={t('Copy full '+kind,'Salin '+kind+' lengkap','复制完整'+kind)} onClick={()=>onCopy?.(kind,value)}>{t('Copy','Salin','复制')}</button>;
 return <div className="runtime-dialog-content">
  <p className="runtime-environment">{t('Environment','Lingkungan','环境')}：{environmentLabel(version,lang)}</p>
  <section className="runtime-version-section" aria-label="Code">
   <h3>Code</h3><dl>
    <dt>{t('Commit','Commit','提交号')}</dt><dd className="runtime-value-actions">{validCommit(commit)?<><a className="runtime-code-link" href={'https://github.com/uper-edu/uper-home-portal/commit/'+commit} target="_blank" rel="noopener noreferrer" aria-label={t('View GitHub commit','Lihat commit GitHub','查看GitHub提交')+' '+commit}><code>{commit}</code><span aria-hidden="true"> ↗</span></a>{copy('Code',commit)}</>:t('Unavailable','Tidak tersedia','暂无信息')}</dd>
    <dt>{t('Commit time','Waktu commit','提交时间')}</dt><dd>{versionTime(version?.backend?.gitCommittedAt,lang)}</dd>
    <dt>{t('Source state','Status kode','源码状态')}</dt><dd>{sourceState(version,lang)}</dd>
   </dl>
  </section>
  <section className="runtime-version-section" aria-label="Build">
   <h3>Build</h3><dl>
    <dt>{t('Build ID','ID build','构建标识')}</dt><dd className="runtime-value-actions">{buildId?<><code>{buildId}</code>{copy('Build',buildId)}</>:version?t('Source mode','Mode sumber','源码运行'):t('Unavailable','Tidak tersedia','暂无信息')}</dd>
    <dt>{t('Build time','Waktu build','构建时间')}</dt><dd>{versionTime(version?.backend?.builtAt,lang)}</dd>
   </dl>
  </section>
  <p className="runtime-version-note">{t('Code identifies the Git commit; Build identifies the package for this environment. Source state is captured at build time (or startup in source mode), not checked live. Times use UTC.','Code menunjukkan commit Git; Build menunjukkan paket untuk lingkungan ini. Status kode dicatat saat build (atau saat mulai dalam mode sumber), bukan diperiksa secara langsung. Waktu menggunakan UTC.','Code标识Git提交，Build标识对应环境的运行包。源码状态记录于构建时（源码模式为启动时），不是实时检查结果。时间统一使用UTC。')}</p>
  {failed&&<p role="status">{t('Version unavailable.','Versi tidak tersedia.','版本信息暂不可用。')}</p>}
  {mismatch&&<p role="alert">{t('Page and server versions differ. Save your work before refreshing.','Versi halaman dan server berbeda. Simpan pekerjaan sebelum memuat ulang.','页面与服务版本不同，请先保存工作再刷新。')}</p>}
 </div>;
}
export function RuntimeVersionStatus({lang,isLight=true}:{lang:CrmLanguage;isLight?:boolean}){
 const t=(en:string,id:string,zh:string)=>words(lang,en,id,zh);
 const [version,setVersion]=useState<any>(null),[failed,setFailed]=useState(false),[open,setOpen]=useState(false),[feedback,setFeedback]=useState('');
 const dialog=useRef<HTMLDialogElement>(null),returnFocus=useRef<HTMLElement|null>(null),title=useId();
 useEffect(()=>{const controller=new AbortController();fetch('/api/version',{cache:'no-store',signal:controller.signal}).then(r=>{if(!r.ok)throw Error();return r.json();}).then(setVersion).catch(()=>{if(!controller.signal.aborted)setFailed(true);});return()=>controller.abort();},[]);
 useEffect(()=>{if(!open)return;const element=dialog.current;if(!element)return;const previous=document.body.style.overflow;document.body.style.overflow='hidden';element.showModal();return()=>{if(element.open)element.close();document.body.style.overflow=previous;};},[open]);
 const close=()=>{setOpen(false);requestAnimationFrame(()=>returnFocus.current?.focus());};
 const copy=async(kind:'Code'|'Build',value:string)=>{try{await navigator.clipboard.writeText(value);setFeedback(t(kind+' copied.',''+kind+' disalin.',kind+'已复制。'));}catch{setFeedback(t('Copy failed. Select the value and copy it manually.','Gagal menyalin. Pilih nilainya lalu salin secara manual.','复制失败，请选中文字手动复制。'));}};
 const buildId=version?.backend?.buildId;
 return <>
  <button type="button" className="admin-runtime-trigger" aria-haspopup="dialog" aria-label={t('Version and environment','Versi dan lingkungan','版本与环境')} onClick={event=>{const menu=event.currentTarget.closest('details');returnFocus.current=menu?.querySelector('summary')||event.currentTarget;menu?.removeAttribute('open');setFeedback('');setOpen(true);}}>
   <span className="admin-runtime-trigger-text"><span>{environmentLabel(version,lang)} · {buildId?'Build …'+buildId.slice(-4):version?t('Source mode','Mode sumber','源码运行'):failed?t('Unavailable','Tidak tersedia','暂无信息'):t('Loading…','Memuat…','加载中…')}</span><small>{versionTime(version?.backend?.builtAt,lang,true)}</small></span><span aria-hidden="true">›</span>
  </button>
  {open&&typeof document!=='undefined'&&createPortal(<dialog ref={dialog} className="runtime-version-dialog" data-theme={isLight?'light':'dark'} aria-labelledby={title} onKeyDown={event=>{
   if(event.key!=='Tab')return;
   const items=Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]')).filter(item=>item.getClientRects().length>0);
   const first=items[0],last=items[items.length-1];
   if(!first)return;
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  }} onCancel={event=>{event.preventDefault();close();}} onClick={event=>{if(event.target===event.currentTarget){const r=event.currentTarget.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)close();}}}>
   <div className="runtime-dialog-header"><h2 id={title}>{t('Version and environment','Versi dan lingkungan','版本与环境')}</h2><button type="button" className="runtime-dialog-close" autoFocus onClick={close} aria-label={t('Close version details','Tutup detail versi','关闭版本详情')}>×</button></div>
   <VersionDetails lang={lang} version={version} failed={failed} onCopy={copy}/>
   <p className="runtime-copy-feedback" role="status" aria-live="polite">{feedback}</p>
  </dialog>,document.body)}
 </>;
}

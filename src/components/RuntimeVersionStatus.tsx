import {useEffect,useState} from 'react';
import type {CrmLanguage} from '../utils/crmLanguage';
declare const __UPER_BUILD__: {buildId:string;dirty:boolean;environment:string} | null;
const build=typeof __UPER_BUILD__==='undefined'?null:__UPER_BUILD__;
export function VersionDetails({lang,version,failed=false,frontend=build}:{lang:CrmLanguage;version:any;failed?:boolean;frontend?:typeof build}){
 const t=(en:string,id:string,zh:string)=>lang==='zh'?zh:lang==='id'?id:en;
 const environment=version?.environment==='dev'?t('Local','Lokal','本地'):version?.environment==='test'?t('Test','Uji','测试'):version?.environment==='prod'?t('Production','Produksi','生产'):t('Unknown environment','Lingkungan tidak diketahui','环境未确认');
 const mismatch=frontend&&version?.backend?.buildId&&frontend.buildId!==version.backend.buildId;
 return <div className="admin-runtime-version" aria-label={t('Runtime version','Versi berjalan','运行版本')}>
  <span>{environment} · {t('Version','Versi','版本')}</span>
  <code>{version?.backend?.buildId||(version?t('Source mode','Mode sumber','源码运行'):failed?'—':t('Loading…','Memuat…','加载中…'))}</code>
  {version?.backend?.dirty&&<span>{t('Includes uncommitted changes','Memuat perubahan yang belum dikomit','含未提交改动')}</span>}
  {failed&&<span role="status">{t('Version unavailable.','Versi tidak tersedia.','版本信息暂不可用。')}</span>}
  {mismatch&&<span role="alert">{t('Page and server versions differ. Save your work before refreshing.','Versi halaman dan server berbeda. Simpan pekerjaan sebelum memuat ulang.','页面与服务版本不同，请先保存工作再刷新。')}</span>}
 </div>;
}
export function RuntimeVersionStatus({lang}:{lang:CrmLanguage}){
 const [version,setVersion]=useState<any>(null),[failed,setFailed]=useState(false);
 useEffect(()=>{const controller=new AbortController();fetch('/api/version',{cache:'no-store',signal:controller.signal}).then(r=>{if(!r.ok)throw Error();return r.json();}).then(setVersion).catch(()=>{if(!controller.signal.aborted)setFailed(true);});return()=>controller.abort();},[]);
 return <VersionDetails lang={lang} version={version} failed={failed}/>;
}

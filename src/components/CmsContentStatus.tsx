import {useEffect,useState} from 'react';
import {useTranslation} from 'react-i18next';
const failures=new Set<string>();
export function contentStatus(query:string,failed:boolean){if(failed)failures.add(query);else failures.delete(query);window.dispatchEvent(new Event('cms-content-status'));}
export default function CmsContentStatus(){
 const [unavailable,setUnavailable]=useState(false);const {i18n}=useTranslation();
 useEffect(()=>{const update=()=>setUnavailable(failures.size>0);update();window.addEventListener('cms-content-status',update);return ()=>window.removeEventListener('cms-content-status',update);},[]);
 if(!unavailable)return null;
 const language=i18n.language.startsWith('zh')?'zh':i18n.language.startsWith('id')?'id':'en';
 const message={en:'Some website content is temporarily unavailable. Please reload to retry.',id:'Sebagian konten situs sementara tidak tersedia. Muat ulang untuk mencoba lagi.',zh:'部分网站内容暂不可用，请重新加载后重试。'}[language];
 return <div role="alert" className="fixed bottom-4 left-4 right-4 md:right-auto z-[70] max-w-lg rounded-xl border border-red-200 bg-red-50 text-red-900 p-4 shadow-lg"><p>{message}</p><button type="button" className="mt-2 font-semibold underline" onClick={()=>window.location.reload()}>{language==='zh'?'重新加载':language==='id'?'Muat ulang':'Reload'}</button></div>;
}

import React from 'react';
import {BookOpen,ChevronDown} from 'lucide-react';
import {contactPreparationReferences} from '../../utils/crmContactPreparation';
export function CrmContactReference({lang,disabled,onPrepare}:{lang:string;disabled?:boolean;onPrepare:(purpose:string)=>void}){
 const index=lang==='zh'?2:lang==='id'?1:0,t=(en:string,id:string,zh:string)=>[en,id,zh][index];
 return <details className="crm-contact-reference"><summary><BookOpen size={16} aria-hidden="true"/>{t('Common reference','Referensi umum','常用参考')}<span>{t('Internal sales checks','Panduan internal sales','销售内部检查项')}</span><ChevronDown size={16} aria-hidden="true"/></summary><div className="crm-contact-reference-items">{contactPreparationReferences.map(item=><article key={item.id}><h4>{item.title[index]}</h4><p>{item.check[index]}</p><button type="button" className="crm-work-link" disabled={disabled} onClick={()=>onPrepare(item.purpose)}>{t('Prepare a message','Siapkan pesan','准备此类消息')}</button></article>)}</div></details>;
}

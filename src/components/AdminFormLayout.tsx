import {useId,type ReactNode,type ComponentPropsWithoutRef} from 'react';
import type {CrmLanguage} from '../utils/crmLanguage';

/** Presentation only. Caller retains state, permissions, validation and transaction boundaries. */
export function AdminFormSection({title,titleId,actions,description,children,className='',bodyClassName='',variant='plain'}:{title:ReactNode;titleId?:string;actions?:ReactNode;description?:ReactNode;children:ReactNode;className?:string;bodyClassName?:string;variant?:'plain'|'card'|'subgroup'}){
 const uid=useId(),id=titleId||'admin-section-'+uid;
 return <section className={`admin-form-section ${className}`.trim()} data-admin-section={variant} aria-labelledby={id}>
  <header className="admin-form-section-heading"><div><h3 data-admin-section-title id={id}>{title}</h3>{description&&<p>{description}</p>}</div>{actions&&<div className="admin-form-section-tools">{actions}</div>}</header>
  <div className={`admin-form-section-body ${bodyClassName}`.trim()}>{children}</div>
 </section>;
}
export function AdminFormActions({children,className='',...props}:ComponentPropsWithoutRef<'div'>){return <div {...props} className={`admin-form-actions ${className}`.trim()}>{children}</div>;}
export type AdminFeedbackState='dirty'|'saving'|'saved'|'error'|'unknown';
const messages={
 dirty:['Unsaved changes','Perubahan belum disimpan','有未保存修改'],
 saving:['Saving…','Menyimpan…','正在保存…'],
 saved:['Changes saved.','Perubahan disimpan.','修改已保存。'],
 error:['Save failed. Your input is retained.','Gagal menyimpan. Isian tetap disimpan.','保存失败，输入已保留。'],
 unknown:['Save outcome unknown. Check the result before submitting again.','Hasil simpan belum pasti. Periksa sebelum mengirim lagi.','保存结果尚未确认，请先查询再提交。'],
} as const;
export function AdminFormFeedback({state,lang='en',children,className='',...props}:Omit<ComponentPropsWithoutRef<'p'>,'children'> & {state:AdminFeedbackState;lang?:CrmLanguage;children?:ReactNode}){
 const tone=({dirty:'neutral',saving:'info',saved:'success',error:'danger',unknown:'warning'}as const)[state];
 return <p {...props} className={`admin-form-feedback ${className}`.trim()} data-state={state} data-tone={tone} role={props.role||(state==='error'||state==='unknown'?'alert':'status')} aria-atomic="true">{children||messages[state][lang==='zh'?2:lang==='id'?1:0]}</p>;
}

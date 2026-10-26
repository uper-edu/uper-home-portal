import React,{Children,cloneElement,createContext,isValidElement,useContext,useId,useState,type ReactNode,type ElementType} from 'react';
type FieldInfo={id:string;required:boolean};
const FieldContext=createContext<FieldInfo|null>(null);
export const useAdminField=()=>useContext(FieldContext);
/** Only interface label suffixes are normalized; user-entered content is never processed. */
export function adminFieldName(text:string){return text.replace(/\s*[（(](?:必填|选填|可选|required|optional|wajib|opsional)[）)]/gi,'').replace(/\s*[·・]\s*(?:optional|opsional|选填|可选)\s*$/gi,'').replace(/\s*[*＊]\s*$/,'').trim();}
function textOf(node:ReactNode):string{return Children.toArray(node).map(v=>typeof v==='string'||typeof v==='number'?String(v):isValidElement(v)?textOf((v.props as any).children):'').join('');}
function marked(text:string){return /[（(](?:必填|required|wajib)[）)]|[*＊]\s*$/i.test(text.trim());}
function clean(node:ReactNode):ReactNode{return Children.map(node,v=>typeof v==='string'?adminFieldName(v):isValidElement(v)&&v.type===AdminFieldLabel?clean((v.props as any).children):isValidElement(v)&&typeof v.type==='string'?cloneElement(v as any,{},clean((v.props as any).children)):v);}
export function AdminFieldLabel({children,required}: {children:ReactNode;required?:boolean}){return <span className="admin-field-label">{clean(children)}{(required??marked(textOf(children)))&&<span className="admin-required-star" aria-hidden="true"> *</span>}</span>;}
export function AdminRequiredNote({lang='zh'}:{lang?:string}){return <p className="admin-required-note"><span>*</span>{lang==='en'?' Required fields':lang==='id'?' Kolom wajib diisi':' 为必填项'}</p>;}
function nativeField(v:any){return isValidElement(v)&&typeof v.type==='string'&&['input','select','textarea'].includes(v.type)&&!['hidden','button','submit','reset'].includes((v.props as any)?.type);}
function fields(node:ReactNode):any[]{return Children.toArray(node).flatMap(v=>nativeField(v)?[v]:isValidElement(v)&&typeof v.type==='string'?fields((v.props as any).children):[]);}
/** Retains the original label/div and controls. Validation values, writes and handlers remain owned by callers. */
export function AdminField({children,required,as:Tag='label',...props}: {children:ReactNode;required?:boolean;as?:ElementType;[key:string]:any}){
 const uid=useId(),controls=fields(children),primary=controls[0],label=Tag==='label'?Children.toArray(children).find(v=>typeof v==='string'&&v.trim()||isValidElement(v)&&(['span','strong'].includes(v.type as string))||isValidElement(v)&&typeof v.type!=='string'):(Children.toArray(children).find(v=>isValidElement(v)&&v.type==='label') as any)?.props?.children;
 const needed=required??Boolean(primary?.props?.required!==undefined?primary.props.required:primary?.props?.['aria-required']??marked(textOf(label))),id=primary?.props?.id||props.htmlFor||'admin-field-'+uid;
 let labeled=false,first=true;
 const walk=(nodes:ReactNode,insideLabel=false):ReactNode=>Children.map(nodes,node=>{
  if(!isValidElement(node)){if(Tag==='label'&&!labeled&&typeof node==='string'&&node.trim()){labeled=true;return <AdminFieldLabel required={needed}>{node}</AdminFieldLabel>;}return node;}
  const p:any=node.props;
  if(nativeField(node)){
   const main=first;first=false;const req=main?needed:!!p.required;
   return cloneElement(node as any,{...(main?{id}:{}),...(main?{'aria-required':req||undefined,required:req}:req?{'aria-required':true,required:true}:{}),...(p['aria-label']?{'aria-label':adminFieldName(p['aria-label'])}:{})});
  }
  if(node.type==='label'&&Tag!=='label')return cloneElement(node as any,{htmlFor:id},<AdminFieldLabel required={needed}>{p.children}</AdminFieldLabel>);
  if(Tag==='label'&&!labeled&&['span','strong'].includes(node.type as string)){labeled=true;return cloneElement(node as any,{},<AdminFieldLabel required={needed}>{p.children}</AdminFieldLabel>);}
  if(Tag==='label'&&!labeled&&typeof node.type!=='string'){labeled=true;return <AdminFieldLabel required={needed}>{node}</AdminFieldLabel>;}
  return typeof node.type==='string'?cloneElement(node as any,{},walk(p.children,insideLabel)):node;
 });
 return <FieldContext.Provider value={{id,required:needed}}><Tag {...props} {...(Tag==='label'?{htmlFor:id}:{})}>{walk(children)}</Tag></FieldContext.Provider>;
}

export function firstMissingAdminField(root:HTMLElement){
 const fields=Array.from(root.querySelectorAll<HTMLInputElement>('input[required],textarea[required],select[required],[role="combobox"][aria-required="true"]'));
 return fields.find(field=>!field.matches(':disabled')&&!field.readOnly&&field.getClientRects().length>0&&(field.getAttribute('role')==='combobox'?field.dataset.adminHasValue==='false':!field.checkValidity()));
}
/** Validation is a preflight only: callers keep the same submit, idempotency and result-query mechanism. */
export function AdminForm({children,lang='zh',...props}:any){
 const[error,setError]=useState('');
 return <form {...props} noValidate onSubmitCapture={e=>{props.onSubmitCapture?.(e);if(e.defaultPrevented)return;const field=firstMissingAdminField(e.currentTarget);if(field){e.preventDefault();e.stopPropagation();field.focus();const label=field.getAttribute('aria-label')||field.labels?.[0]?.textContent||'';setError(lang==='zh'?'请填写必填项：'+adminFieldName(label):lang==='id'?'Lengkapi kolom wajib: '+adminFieldName(label):'Complete the required field: '+adminFieldName(label));field.setAttribute('aria-invalid','true');field.setAttribute('data-admin-invalid','true');}else setError('');}} onInputCapture={e=>{props.onInputCapture?.(e);const field=e.target as HTMLElement;if(field.dataset.adminInvalid){field.removeAttribute('aria-invalid');field.removeAttribute('data-admin-invalid');}setError('');}}>{error&&<p role="alert" className="admin-required-error">{error}</p>}{children}</form>;
}

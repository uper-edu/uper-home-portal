import {useId,type FormEventHandler,type ReactNode,type RefObject} from 'react';
import {X} from 'lucide-react';
import {AdminForm,AdminRequiredNote} from '../AdminForm';
import {AdminFormActions} from '../AdminFormLayout';
import {AdminDialog} from './AdminDialog';
import type {CrmLanguage} from '../../utils/crmLanguage';

export function AdminEditor({
  children,footer,title,description,lang,light,onClose,onSubmit,busy=false,closeDisabled=false,
  required=false,variant='modal',className='',bodyClassName='',dialogRef,
}:{
  children:ReactNode;footer:ReactNode;title:ReactNode;description?:ReactNode;lang:CrmLanguage;light:boolean;
  onClose:()=>void;onSubmit?:FormEventHandler<HTMLFormElement>;busy?:boolean;closeDisabled?:boolean;
  required?:boolean;variant?:'modal'|'drawer';className?:string;bodyClassName?:string;
  dialogRef?:RefObject<HTMLDialogElement|null>;
}){
  const titleId=useId();
  const closeLabel=lang==='zh'?'关闭':lang==='id'?'Tutup':'Close';
  const layout=(validationFeedback?:ReactNode)=><>
    <header className="admin-editor-heading">
      <div className="admin-editor-title">
        <div className="admin-editor-title-line">
          <h2 data-admin-form-title id={titleId} tabIndex={-1}>{title}</h2>
          {required&&<AdminRequiredNote lang={lang} inline/>}
        </div>
        {description&&<div className="admin-editor-description">{description}</div>}
      </div>
      <button type="button" className="admin-editor-close" disabled={busy||closeDisabled} aria-label={closeLabel} onClick={onClose}><X size={20} aria-hidden="true"/></button>
    </header>
    <div className={`admin-editor-body ${bodyClassName}`.trim()}>{validationFeedback}{children}</div>
    <AdminFormActions className="admin-editor-footer">{footer}</AdminFormActions>
  </>;
  return <AdminDialog aria-labelledby={titleId} light={light} busy={busy} onRequestClose={onClose} dialogRef={dialogRef}
    className={`admin-editor-dialog ${className}`.trim()} data-editor={variant} data-admin-form="">
    {onSubmit?<AdminForm lang={lang} className="admin-editor-layout admin-editor-form" onSubmit={onSubmit}>{layout}</AdminForm>
      :<div className="admin-editor-layout">{layout()}</div>}
  </AdminDialog>;
}

import {useId,type ReactNode} from 'react';
import {AdminFormActions} from '../AdminFormLayout';
import {AdminDialog} from './AdminDialog';

export function AdminConfirmation({title,description,children,cancelLabel,confirmLabel,onCancel,onConfirm,
  light,busy=false,danger=false,announceDescription=false,closeOnBackdrop=false}:{
  title:ReactNode;description:ReactNode;children?:ReactNode;cancelLabel:ReactNode;confirmLabel?:ReactNode;
  onCancel:()=>void;onConfirm?:()=>void;light:boolean;busy?:boolean;danger?:boolean;
  announceDescription?:boolean;closeOnBackdrop?:boolean;
}){
  const id=useId();
  return <AdminDialog className="admin-confirmation" role="alertdialog" data-tone={danger?'danger':undefined}
    light={light} busy={busy} closeOnBackdrop={closeOnBackdrop} initialFocus="first" onRequestClose={onCancel}
    aria-labelledby={id} aria-describedby={id+'-description'} data-admin-form="">
    <h2 id={id}>{title}</h2>
    <p id={id+'-description'} aria-live={announceDescription?'polite':undefined}>{description}</p>
    {children}
    <AdminFormActions className="admin-confirmation-actions">
      <button type="button" autoFocus disabled={busy} onClick={onCancel}>{cancelLabel}</button>
      {onConfirm&&<button type="button" data-confirm="" disabled={busy} onClick={onConfirm}>{confirmLabel}</button>}
    </AdminFormActions>
  </AdminDialog>;
}

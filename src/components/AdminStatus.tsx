import type {ReactNode} from 'react';

type AdminStatusTone='neutral'|'success'|'info'|'warning'|'danger';

/** Colour follows an explicit business state; the visible label always remains. */
export function AdminStatus({active,tone=active?'success':'neutral',children}:{active?:boolean;tone?:AdminStatusTone;children:ReactNode}){
  return <span className="admin-status" data-tone={tone}>
    {tone!=='neutral'&&<span className="admin-status-dot" aria-hidden="true"/>}{children}
  </span>;
}

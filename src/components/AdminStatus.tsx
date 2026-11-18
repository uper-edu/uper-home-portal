import type {ReactNode} from 'react';

type AdminStatusTone='neutral'|'success'|'info'|'warning'|'danger';

/** Colour follows an explicit business state; the visible label always remains. */
export function AdminStatus({active,tone=active?'success':'neutral',showDot=true,children}:{active?:boolean;tone?:AdminStatusTone;showDot?:boolean;children:ReactNode}){
  return <span className="admin-status" data-tone={tone}>
    {showDot&&tone!=='neutral'&&<span className="admin-status-dot" aria-hidden="true"/>}{children}
  </span>;
}

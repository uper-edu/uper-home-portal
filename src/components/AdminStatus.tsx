import type {ReactNode} from 'react';
/** Colour follows an explicit business state; the visible label always remains. */
export function AdminStatus({active,children}:{active:boolean;children:ReactNode}){return <span className="admin-status" data-tone={active?'success':'neutral'}>{active&&<span className="admin-status-dot" aria-hidden="true"/>}{children}</span>;}

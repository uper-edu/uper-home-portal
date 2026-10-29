import {createContext} from 'react';
export type HistoryOpenRequest={id?:string;quote?:string;fields?:string[]};
/** Read-only evidence access; the owning workspace supplies the authorized current customer. */
export const CrmHistoryAccess=createContext<((request:HistoryOpenRequest)=>void)|null>(null);

import {useEffect,useRef,useState} from 'react';
/** Read-only projection. No acknowledgement, task or notification writes. */
export function useCrmExtractions(leadId:string,sourceRevision:any,recentSourceId:string|undefined,onRefresh:any){
 const [rows,setRows]=useState<any[]>([]),[error,setError]=useState(false),[loading,setLoading]=useState(true),[revision,setRevision]=useState(0);const refresh=useRef(onRefresh),done=useRef(new Set<string>());refresh.current=onRefresh;
 useEffect(()=>{let cancelled=false,timer:ReturnType<typeof setTimeout>;setRows([]);setLoading(true);setError(false);const load=async()=>{try{const r=await fetch(`/api/crm/leads/${leadId}/extractions`);if(!r.ok)throw Error();const data=await r.json();if(cancelled)return;setRows(data.rows);setLoading(false);setError(false);const completed=data.rows.find((v:any)=>v.source_id===recentSourceId&&v.status==='completed');if(completed&&!done.current.has(completed.id)){done.current.add(completed.id);refresh.current?.();}if(data.rows.some((v:any)=>['pending','processing','retry'].includes(v.status)))timer=setTimeout(load,5000);}catch{if(!cancelled){setError(true);setLoading(false);}}};void load();return()=>{cancelled=true;clearTimeout(timer)};},[leadId,sourceRevision,recentSourceId,revision]);
 return {rows,error,loading,reload:()=>setRevision(v=>v+1)};
}

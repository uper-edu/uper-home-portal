/** Result colour describes an observed contact outcome, never a task priority. */
export function contactResultTone(result?:string){return result==='Connected'?'connected':result==='No Response'?'unanswered':result==='Wrong Number'?'invalid':'neutral';}
export function CrmContactResult({result,children}:{result?:string;children:React.ReactNode}){return <span className="crm-contact-result" data-contact-result={contactResultTone(result)}>{children}</span>;}

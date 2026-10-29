export const CMS_REQUEST_TIMEOUT_MS=20000;
export async function cmsImageFingerprint(data:string){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(data));return Array.from(new Uint8Array(bytes),v=>v.toString(16).padStart(2,'0')).join('');}
export function cmsSaveRequest(operation:any){return {item:operation.draft,requestId:operation.requestId};}
export function canRetryCms(operation:any,actor:string,notFound:boolean){return !!operation&&operation.actor===actor&&notFound;}

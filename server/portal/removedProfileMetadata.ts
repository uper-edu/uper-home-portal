/** Reject removed internal metadata instead of silently storing it in evidence or cached results. */
const removed = new Set(['nameNote','expectedNameNote']);
export function containsRemovedProfileMetadata(value:unknown):boolean {
 if(Array.isArray(value))return value.some(containsRemovedProfileMetadata);
 if(!value||typeof value!=='object')return false;
 if(removed.has((value as any).field))return true;
 return Object.entries(value).some(([key,v])=>removed.has(key)||containsRemovedProfileMetadata(v));
}
export function removeRetiredProfileMetadata(value:any):any {
 if(Array.isArray(value))return value.filter(v=>!v||typeof v!=='object'||!removed.has(v.field)).map(removeRetiredProfileMetadata);
 if(!value||typeof value!=='object')return value;
 if(removed.has(value.field))return null;
 return Object.fromEntries(Object.entries(value).filter(([key])=>!removed.has(key)).map(([key,v])=>[key,removeRetiredProfileMetadata(v)]));
}

/** Shared structural password policy; no password values are logged or persisted here. */
export function validStaffPassword(value:unknown,loginId:string,previous?:string){
 return typeof value==='string'&&value.length>=12&&value.length<=200&&/[a-z]/.test(value)&&/[A-Z]/.test(value)&&/[0-9]/.test(value)&&value.toLowerCase()!==loginId.toLowerCase()&&value!==previous;
}

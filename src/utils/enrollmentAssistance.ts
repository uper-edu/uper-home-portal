export function enrollmentAssistancePath(id:string,lang:string){
  return '/enrollment/assist?'+new URLSearchParams({lang})+'#a='+encodeURIComponent(id);
}

export type EnrollmentAssistanceMail={
  id:string;
  state:'simulated'|'failed'|'accepted'|'queued'|'unknown'|'cancelled';
  recordedAt:string;
};
export const canRetryEnrollmentAssistanceMail=(mail?:EnrollmentAssistanceMail)=>mail?.state==='failed';
export const enrollmentPreviewOrigin='http://localhost:3000';

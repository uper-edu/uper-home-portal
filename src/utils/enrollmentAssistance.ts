export function enrollmentAssistancePath(id:string,lang:string){
  return '/enrollment/assist?'+new URLSearchParams({lang})+'#a='+encodeURIComponent(id);
}

export type EnrollmentAssistanceMail={id:string;state:'simulated'|'failed';recordedAt:string};
export const enrollmentPreviewOrigin='http://localhost:3000';

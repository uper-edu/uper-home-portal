export type EnrollmentPreload = {url:string; response:Promise<unknown>; receivedAt?:number; cancel:()=>void};
export type EnrollmentLanding = {pathname:string; application?:boolean; hasOrder?:boolean; appointmentId?:string; classes?:EnrollmentPreload; availability?:EnrollmentPreload};

declare global {
  interface Window {
    __uperEnrollmentLanding?: EnrollmentLanding;
  }
}

export function enrollmentLandingAppointmentId(url:Pick<Location,'pathname'|'search'>) {
  if (!/^\/enrollment\/(?:help\/one-on-one|interest)\/?$/.test(url.pathname)) return;
  const id=new URLSearchParams(url.search).get('appointment');
  if (id && /^[a-zA-Z0-9-]{1,64}$/.test(id)) return id;
}

export function matchesEnrollmentLanding(landing:EnrollmentLanding,url:Pick<Location,'pathname'|'search'>) {
  if(landing.pathname!==url.pathname)return false;
  const params=new URLSearchParams(url.search);
  return !params.has('learnerPreview')&&params.get('view')!=='rules'&&
    Boolean(landing.application)===(params.get('apply')==='1') &&
    Boolean(landing.hasOrder)===Boolean(params.get('order')) &&
    landing.appointmentId===enrollmentLandingAppointmentId(url);
}

export function cancelEnrollmentPreload() {
  const landing=window.__uperEnrollmentLanding;
  if(!landing)return;
  delete window.__uperEnrollmentLanding;
  landing.classes?.cancel();
  landing.availability?.cancel();
}

export function cancelUnmatchedEnrollmentPreload() {
  const landing=window.__uperEnrollmentLanding;
  if(landing&&!matchesEnrollmentLanding(landing,window.location))cancelEnrollmentPreload();
}

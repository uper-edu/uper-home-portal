import {enrollmentClassLookupLimit,type PublicEnrollmentClass} from '../utils/enrollmentCatalog';
import {cancelEnrollmentPreload,enrollmentLandingAppointmentId,matchesEnrollmentLanding,type EnrollmentPreload} from './enrollmentLandingState';

export const intakeReadinessUrl='/api/enrollment/availability';
export const servicingReadinessUrl=intakeReadinessUrl+'?scope=servicing';
export const enrollmentCatalogUrl='/api/enrollment/classes?view=summary';
export const enrollmentLandingTimeoutMs=15000;
const preloadLifetimeMs=8000;
export const enrollmentAppointmentUrl=(appointmentId:string)=>'/api/enrollment/classes?'+new URLSearchParams({appointmentId});

function startEnrollmentPreload(url:string):EnrollmentPreload {
  const controller=new AbortController();
  const entry:EnrollmentPreload={url,cancel:()=>controller.abort(),response:fetch(url,{
    cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(enrollmentLandingTimeoutMs)]),
  }).then(response=>response.ok ? response.json() : null).catch(()=>null).then(data=>{
    if(data!==null)entry.receivedAt=performance.now();
    return data;
  })};
  return entry;
}

export function preloadEnrollmentNavigation(url:URL,appointmentSnapshot?:{id:string;data:ReturnType<typeof parseEnrollmentCatalog>;receivedAt:number}) {
  if(url.origin!==window.location.origin || url.searchParams.get('view')==='rules' || url.searchParams.has('learnerPreview'))return;
  const appointmentId=enrollmentLandingAppointmentId(url);
  const target=/^\/enrollment(?:\/([a-zA-Z0-9-]{1,64}))?\/?$/.exec(url.pathname);
  const record=/^\/enrollment\/mine\/(?:waitlist|demands)\/[^/]+\/?$/.test(url.pathname);
  if(!target&&!record&&!appointmentId)return;
  const classId=target?.[1];
  const coursePreference=classId==='interest';
  if(classId && !coursePreference && /^(interest|assist)$/i.test(classId))return;
  const servicing=record || classId==='mine' || classId==='payment' ||
    Boolean(classId&&!coursePreference&&url.searchParams.get('order'));
  const catalogUrl=appointmentId ? enrollmentAppointmentUrl(appointmentId)
    : servicing||coursePreference ? undefined
    : classId ? '/api/enrollment/classes?'+new URLSearchParams({classId}) : enrollmentCatalogUrl;
  const availabilityUrl=appointmentId ? (coursePreference ? servicingReadinessUrl : undefined)
    : servicing ? servicingReadinessUrl : intakeReadinessUrl;
  const application=url.searchParams.get('apply')==='1';
  const previous=window.__uperEnrollmentLanding;
  // Repeated clicks can arrive before the destination starts consuming the requests.
  if(previous&&matchesEnrollmentLanding(previous,url)&&
    previous.classes?.url===catalogUrl&&previous.availability?.url===availabilityUrl)return;
  cancelEnrollmentPreload();
  if(navigator.onLine===false)return;
  const reuseAppointment=catalogUrl&&appointmentSnapshot&&appointmentSnapshot.id===appointmentId&&
    performance.now()-appointmentSnapshot.receivedAt<preloadLifetimeMs;
  window.__uperEnrollmentLanding={
    pathname:url.pathname,
    application,
    hasOrder:Boolean(url.searchParams.get('order')),
    appointmentId,
    classes:catalogUrl?(reuseAppointment?{
      url:catalogUrl,response:Promise.resolve(appointmentSnapshot.data),
      receivedAt:appointmentSnapshot.receivedAt,cancel:()=>{},
    }:startEnrollmentPreload(catalogUrl)):undefined,
    availability:availabilityUrl?startEnrollmentPreload(availabilityUrl):undefined,
  };
}

export async function readEnrollmentLandingData<T>(
  url:string, signal:AbortSignal, parse:(data:unknown)=>T, preload?:'classes'|'availability',
):Promise<T> {
  signal.throwIfAborted();
  const landing=window.__uperEnrollmentLanding;
  if (preload && landing && matchesEnrollmentLanding(landing,window.location)) {
    const entry=landing[preload];
    if (entry?.url===url) {
      // Keep the request available to an effect re-created on the same page.
      let rejectAbort!:(reason:unknown)=>void;
      const aborted=new Promise<never>((_,reject)=>{
        rejectAbort=reject;
      });
      const stopWaiting=()=>{
        rejectAbort(signal.reason);
        if ((!matchesEnrollmentLanding(landing,window.location) || signal.reason?.name==='TimeoutError') && landing[preload]===entry) {
          delete landing[preload];
          entry.cancel();
        }
      };
      signal.addEventListener('abort',stopWaiting,{once:true});
      try {
        const data=await Promise.race([entry.response,aborted]);
        signal.throwIfAborted();
        if(!matchesEnrollmentLanding(landing,window.location))throw new DOMException('Enrollment navigation changed','AbortError');
        delete landing[preload];
        // Reuse fresh data after slow script startup, subject to the same validation as a normal read.
        if (data!==null && entry.receivedAt!==undefined && performance.now()-entry.receivedAt<preloadLifetimeMs) {
          try { return parse(data); } catch { /* Try one normal read if the preload is unusable. */ }
        }
      } finally {
        signal.removeEventListener('abort',stopWaiting);
      }
    }
  }
  if(navigator.onLine===false)throw Error('Enrollment data cannot be loaded while offline');
  const response=await fetch(url,{signal,cache:'no-store'});
  if (!response.ok) throw Error('Enrollment data could not be loaded');
  const data=await response.json();
  signal.throwIfAborted();
  return parse(data);
}

export type PublicEnrollmentAppointment = {
  id: string;
  level: string;
  course: string;
  teacherType: 'local' | 'foreign';
  lessons: number;
  minutes: number;
  price: number;
  standardPrice: number;
  introduction?: PublicEnrollmentClass['introduction'];
  material?: string;
};

const classTextFields = ['format','period','firstLesson','teacherType','schedule','learningOutcomes','material','resources','teacher'] as const;
const classNumberFields = ['batchNumber','minutes','sessions','standardPrice'] as const;

function isClassSummary(row: unknown): row is PublicEnrollmentClass {
  const summary = row as Partial<PublicEnrollmentClass> | null;
  const size=summary?.classSize;
  return typeof summary?.id === 'string' && typeof summary.level === 'string' && Number.isFinite(summary.price) &&
    classTextFields.every(field => summary[field] === undefined || typeof summary[field] === 'string') &&
    classNumberFields.every(field => summary[field] === undefined || Number.isFinite(summary[field])) &&
    (size===undefined || Number.isFinite(size?.maximum) &&
      (size.usualMinimum===undefined || Number.isFinite(size.usualMinimum))) &&
    (summary.availability === undefined || summary.availability === 'full' ||
      summary.availability === 'limited' || summary.availability === 'available');
}

export function parseEnrollmentCatalog(data: unknown) {
  const catalog = data as { classes?: PublicEnrollmentClass[]; appointments?: PublicEnrollmentAppointment[] } | null;
  if (!Array.isArray(catalog?.classes) || !catalog.classes.every(isClassSummary)) throw Error('Invalid enrollment classes');

  const appointments = catalog.appointments === undefined ? [] : catalog.appointments;
  if (!Array.isArray(appointments) || appointments.some(item =>
    typeof item?.id !== 'string' || typeof item.level !== 'string' || typeof item.course !== 'string' ||
    !Number.isFinite(item.price) || !Number.isFinite(item.minutes) || !Number.isFinite(item.lessons) ||
    (item.standardPrice!==undefined && !Number.isFinite(item.standardPrice)) ||
    (item.teacherType!==undefined && typeof item.teacherType!=='string')
  )) throw Error('Invalid enrollment appointments');

  return { classes: catalog.classes, appointments };
}

export function parseEnrollmentReadiness(data: unknown) {
  const availability = data as { accepting?: boolean; servicing?: boolean; reasons?: string[] } | null;
  if (typeof availability?.accepting !== 'boolean' ||
    (availability.servicing !== undefined && typeof availability.servicing !== 'boolean') ||
    (availability.reasons !== undefined && (!Array.isArray(availability.reasons) ||
      availability.reasons.some(reason => typeof reason !== 'string')))
  ) throw Error('Invalid enrollment readiness');

  return {
    accepting: availability.accepting,
    servicing: availability.servicing ?? availability.accepting,
    reasons: availability.reasons ?? ['check_failed'],
  };
}

export async function readEnrollmentClassDetails(
  ids: readonly string[], signal: AbortSignal,
  { includeAvailability = true, onBatch, onTemporaryFailure }: {
    includeAvailability?: boolean;
    onBatch?: (rows: PublicEnrollmentClass[]) => void;
    onTemporaryFailure?: (ids: readonly string[]) => void;
  } = {},
):Promise<PublicEnrollmentClass[]> {
  async function readBatch(ids: string[]) {
    const query = new URLSearchParams(ids.map(id => ['classId', id]));
    if (!includeAvailability) query.set('availability', '0');
    const requested = new Set(ids);
    let expectsJson=false;
    try {
      const response = await fetch('/api/enrollment/classes?' + query, { cache: 'no-store', signal });
      if (!response.ok) {
        if(!signal.aborted&&(response.status===408||response.status>=500))onTemporaryFailure?.(ids);
        return [];
      }
      expectsJson=/^application\/json(?:\s*;|$)/i.test(response.headers.get('Content-Type')??'');
      const data = await response.json();
      if(signal.aborted){
        if(signal.reason?.name==='TimeoutError')onTemporaryFailure?.(ids);
        return [];
      }
      if(!Array.isArray(data?.classes)){
        onTemporaryFailure?.(ids);
        return [];
      }
      const rows = new Map<string, PublicEnrollmentClass>();
      for (const row of data.classes) {
        if (isClassSummary(row) && requested.has(row.id)) rows.set(row.id, row);
      }
      // Keep valid siblings. A corrupt row for a requested class is different
      // from a valid response that omitted classes which are no longer public.
      const malformed = new Set<string>();
      for (const row of data.classes) {
        if (requested.has(row?.id) && !rows.has(row.id)) malformed.add(row.id);
      }
      if (malformed.size) onTemporaryFailure?.([...malformed]);
      return [...rows.values()];
    } catch(error) {
      if(signal.reason?.name==='TimeoutError'||
        !signal.aborted&&(error instanceof TypeError||expectsJson&&error instanceof SyntaxError))onTemporaryFailure?.(ids);
      return [];
    }
  }

  const requests: Promise<PublicEnrollmentClass[]>[] = [];
  const unique = [...new Set(ids)];
  for (let index = 0; index < unique.length; index += enrollmentClassLookupLimit) {
    requests.push(readBatch(unique.slice(index, index + enrollmentClassLookupLimit)).then(rows => {
      if (rows.length && !signal.aborted) onBatch?.(rows);
      return rows;
    }));
  }
  return (await Promise.all(requests)).flat();
}

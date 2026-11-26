import type {Interests} from './enrollmentInterests';

export function enrollmentRecordClassLookup(
  orders: readonly {classId:string}[] | undefined,
  interests: Interests | undefined,
  record?: {kind:'waitlist'|'demands';id:string},
): string {
  if (record?.kind==='waitlist') {
    return interests?.waitlist.find(row=>row.id===record.id)?.classId ?? '';
  }
  if (record?.kind==='demands') {
    const demand=interests?.demands.find(row=>row.id===record.id);
    return demand?.state==='active' ? [...new Set(demand.matches.map(match=>match.id))].sort().join(',') : '';
  }
  // The list shows match availability for preferences. Only the detail uses the matched classes.
  return [...new Set([
    ...(orders ?? []).map(row=>row.classId),
    ...(interests?.waitlist ?? []).map(row=>row.classId),
  ])].sort().join(',');
}

type RecordPriority={key:string;needsAction:boolean;updatedAt?:string|null};

/** All timestamps here are ISO UTC, with the same fractional precision. */
export const sortEnrollmentRecords=<T extends RecordPriority>(records:T[])=>[...records].sort((a,b)=>
  Number(b.needsAction)-Number(a.needsAction)||
  (b.updatedAt??'').localeCompare(a.updatedAt??'')||
  a.key.localeCompare(b.key),
);

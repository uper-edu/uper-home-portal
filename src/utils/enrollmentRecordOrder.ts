type RecordPriority={key:string;needsAction:boolean;updatedAt?:string};

/** All timestamps here are ISO UTC, with the same fractional precision. */
export const sortEnrollmentRecords=<T extends RecordPriority>(records:T[])=>[...records].sort((a,b)=>
  Number(b.needsAction)-Number(a.needsAction)||
  (b.updatedAt??'').localeCompare(a.updatedAt??'')||
  a.key.localeCompare(b.key),
);

/** Candidate count is not a cross-contact conflict. Empty fields never create evidence. */
export function identityCrossConflict(rows:any[]){
 const emails=new Set(rows.filter(r=>r.basis.includes('email')).map(r=>r.id));
 const phones=new Set(rows.filter(r=>r.basis.includes('phone')).map(r=>r.id));
 return emails.size>0&&phones.size>0&&![...emails].some(id=>phones.has(id));
}

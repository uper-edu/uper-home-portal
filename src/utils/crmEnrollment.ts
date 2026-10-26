/** Enrollment is a confirmed business fact; current sales stage is a separate projection. */
export function confirmedEnrollmentFacts(facts:any[]){return facts.filter(f=>f.kind==='stage.changed'&&f.data?.schema===2&&f.data.after==='progress:enrolled'&&f.data.enrollmentConfirmed===true).map(f=>({id:f.id,effectiveAt:f.data.effectiveAt??null,recordedAt:f.created_at??null}));}
export function hasConfirmedEnrollment(lead:any){return Boolean(lead.enrollmentEvidence?.confirmations?.length)||lead.currentStage==='Enrolled'||['Enrolled','Paid'].includes(lead.outcome);}

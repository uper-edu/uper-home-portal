/** Enrollment is a confirmed business fact; current sales stage is a separate projection. */
export const isEnrollmentConfirmation=(f:any)=>f?.kind==='stage.changed'&&f.data?.schema===2&&f.data.after==='progress:enrolled'&&f.data.enrollmentConfirmed===true;
/** Only explicit, customer-scoped void facts invalidate a confirmation. Stage rollback and AI text do not. */
export function enrollmentVoids(facts:any[]){return new Map<string,any>(facts.filter(f=>f.kind==='enrollment.confirmation_voided'&&typeof f.data?.targetFactId==='string').map(f=>[f.data.targetFactId,f]));}
export function effectiveEnrollmentFacts(facts:any[]){const voids=enrollmentVoids(facts);return facts.filter(f=>isEnrollmentConfirmation(f)&&!voids.has(f.id));}
export function confirmedEnrollmentFacts(facts:any[]){return effectiveEnrollmentFacts(facts).map(f=>({id:f.id,effectiveAt:f.data.effectiveAt??null,recordedAt:f.created_at??null}));}
export function hasConfirmedEnrollment(lead:any){return Boolean(lead.enrollmentEvidence?.confirmations?.length)||lead.currentStage==='Enrolled'||['Enrolled','Paid'].includes(lead.outcome);}

/** Operational requests come from validated AI evidence, never keyword routing of free text. */
export const requestActions:Record<string,'handoff'|'booking'|'enrollment'>={advisor_request:'handoff',trial_request:'booking',enrollment_request:'enrollment'};
export function naturalRequestActions(observations:any[]){
 return [...new Set(observations.filter(o=>o.kind==='signal'&&o.subject==='customer'&&o.temporality==='current'&&o.value===true&&requestActions[o.field]&&!observations.some(v=>v.kind==='signal'&&v.field===o.field&&v.subject==='customer'&&['negated','uncertain','conditional'].includes(v.temporality))).map(o=>requestActions[o.field]))];
}
/** An explicit request is stronger than interest from the SAME original message only. */
export function weakerIntent(value:string){return value==='Booking requested'?'Trial interest':value==='Ready to enroll'?'Enrollment interest':null;}

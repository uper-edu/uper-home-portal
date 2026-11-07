import {sameProfileValue} from './crmFieldValues';

export const goalRelations=['equivalent','compatible','conflict','uncertain'] as const;
export type GoalRelation=typeof goalRelations[number];
export type GoalReview={snapshot:string;relations:GoalRelation[]};
/** A version-bound, read-only comparison input. No customer identity or contact details. */
export function goalReviewInput(lead:any){
 const current=lead.goal;
 const candidates=(lead.profileFieldMeta?.goal?.pendingDifferences||[]).filter((d:any)=>d.effective!==false&&!d.supersededBy&&!sameProfileValue('goal',current,d.value));
 const snapshot=JSON.stringify([lead.id,current??null,lead.profileFieldMeta?.goal?.revision??0,candidates.map((d:any)=>[d.value,d.sourceFactId??null,d.recordedAt??null])]);
 return {current,candidates,snapshot};
}
export function goalRelation(lead:any,difference:any,review?:GoalReview|null):GoalRelation{
 if(sameProfileValue('goal',lead.goal,difference.value))return 'equivalent';
 const input=goalReviewInput(lead);
 if(review?.snapshot!==input.snapshot)return 'uncertain';
 const index=input.candidates.findIndex((d:any)=>d===difference||d.sourceFactId===difference.sourceFactId&&sameProfileValue('goal',d.value,difference.value)&&d.recordedAt===difference.recordedAt);
 return review.relations[index]||'uncertain';
}
export function compatibleGoalRecord(lead:any,difference:any,review?:GoalReview|null){
 return ['equivalent','compatible'].includes(goalRelation(lead,difference,review));
}

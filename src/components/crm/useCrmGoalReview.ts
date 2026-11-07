import {useEffect,useState} from 'react';
import {goalReviewInput,goalRelations,type GoalReview} from '../../utils/crmGoalReview';

export function useCrmGoalReview(lead:any,enabled=true){
 const input=goalReviewInput(lead),snapshot=input.snapshot;
 const [result,setResult]=useState<GoalReview|null>(null);
 useEffect(()=>{
  if(!enabled||!input.candidates.length)return;
  const controller=new AbortController();
  void fetch(`/api/crm/leads/${encodeURIComponent(lead.id)}/goal-review`,{signal:controller.signal}).then(async r=>{
   if(!r.ok)throw Error();const body=await r.json();
   if(body.snapshot!==snapshot||!Array.isArray(body.relations)||body.relations.length!==input.candidates.length||body.relations.some((v:any)=>!goalRelations.includes(v)))throw Error();
   if(!controller.signal.aborted)setResult(body);
  }).catch(()=>{/* Unknown stays visibly unconfirmed; no client-side language guesses. */});
  return()=>controller.abort();
 },[snapshot,enabled]);
 return enabled&&result?.snapshot===snapshot?result:null;
}

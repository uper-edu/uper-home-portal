import {createHash} from 'node:crypto';import {determineLevelState} from '../../src/types/leadSystem.ts';
export function initialTierProvenance(p:any,sourceId:string,at:string){
 const input={buyingSignal:p.buyingSignal||'None yet',currentStatus:p.currentStatus||'Other',goal:p.goal||null,levelState:determineLevelState(p.reportedLevel),city:p.city||'Other',mode:p.mode||'Not sure'};
 const rule=!p.goal||!p.reportedLevel?'incomplete':input.buyingSignal!=='None yet'?'R1':input.currentStatus==='Teacher or school staff'?'R3':'R4';
 return {tierSource:'initial_registration',tierUpdatedAt:at,initialTierDecision:{tier:p.tier,ruleId:rule,ruleVersion:'initial-registration-v1',input,sourceFactIds:[sourceId],at,inputHash:createHash('sha256').update(JSON.stringify(input)).digest('hex')}};
}

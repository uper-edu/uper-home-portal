import {assertAiProfileDimension,dimensionFieldLabels,systemDimension} from './crmDimensionCatalog';
/** Compatibility exports derive from the unified catalog. Unknown core fields remain unwritable. */
export const AI_PROFILE_POLICY='ai-profile-v1';
export const aiProfileFieldLabels=Object.freeze(dimensionFieldLabels('profile'));
export const aiProtectedFieldLabels=Object.freeze(dimensionFieldLabels('protected'));
export const isAiListField=(field:string)=>systemDimension(field)?.valueType==='text_list';
export function assertAiProfileUpdates(updates:Record<string,unknown>){
 for(const field of Object.keys(updates))assertAiProfileDimension(field);
}
/** Operations are explicit model output; no keyword interpretation or fuzzy list-item matching. */
export function aiListValue(field:string,current:any,observation:any){
 if(!isAiListField(field))return observation.value;
 const before=Array.isArray(current)?current:[],values=observation.value||[];
 if(observation.operation==='replace')return values;
 if(observation.operation==='remove')return before.filter((v:string)=>!values.includes(v));
 return [...new Set([...before,...values])];
}

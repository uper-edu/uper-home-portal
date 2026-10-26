import type {CrmPolicyConfig} from '../types/crmPolicyConfig';
import {mergePolicyConfig} from './crmPolicyConfigValidation';
export const policyTopicKeys={
 permissions:['identityReviewManagerOnly','ownerAssignmentManagerOnly','sourceAttributionManagerOnly'],
 schedule:['businessHours'],first_response:['firstResponseSla'],retry:['noResponseCadence'],watchdog:['inactivityWatchdog'],milestone:['milestones'],reactivation:['reactivation'],
} as const;
export type PolicyTopic=keyof typeof policyTopicKeys;
export type TopicPatch=Partial<CrmPolicyConfig>;
export interface PolicyTopicRequest{topic:PolicyTopic;base:TopicPatch;patch:TopicPatch}
export const isPolicyTopic=(topic:string):topic is PolicyTopic=>Object.hasOwn(policyTopicKeys,topic);
function stable(value:any):any{return Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])])):value;}
export const policyEqual=(a:unknown,b:unknown)=>JSON.stringify(stable(a))===JSON.stringify(stable(b));
export function topicPatch(value:CrmPolicyConfig,topic:PolicyTopic):TopicPatch{return Object.fromEntries(policyTopicKeys[topic].map(k=>[k,value[k]]));}
export const topicDirty=(draft:CrmPolicyConfig,base:CrmPolicyConfig,topic:PolicyTopic)=>!policyEqual(topicPatch(draft,topic),topicPatch(base,topic));
export function topicChangeFields(draft:CrmPolicyConfig,base:CrmPolicyConfig,topic:PolicyTopic){
 const result:string[]=[];
 const compare=(a:any,b:any,path:string)=>{if(policyEqual(a,b))return;if(a&&b&&typeof a==='object'&&Object.hasOwn(a,'value')&&Object.hasOwn(a,'unit')){result.push(path);return;}if(a&&b&&typeof a==='object'&&typeof b==='object'&&!Array.isArray(a)&&!Array.isArray(b)){for(const k of new Set([...Object.keys(a),...Object.keys(b)]))compare(a[k],b[k],path+'.'+k);}else result.push(path);};
 for(const k of policyTopicKeys[topic])compare(draft[k],base[k],k);return result;
}
/** Refresh clean topics only. A save acknowledgement advances only that topic's base. */
export function reconcilePolicyDraft(draft:CrmPolicyConfig,base:CrmPolicyConfig,server:CrmPolicyConfig,accepted?:{topic:PolicyTopic;submitted:CrmPolicyConfig}){
 let nextDraft={...draft,version:server.version,updatedAt:server.updatedAt},nextBase={...base,version:server.version,updatedAt:server.updatedAt};
 for(const topic of Object.keys(policyTopicKeys) as PolicyTopic[]){
  if(accepted?.topic===topic){nextBase={...nextBase,...topicPatch(server,topic)};if(!topicDirty(draft,accepted.submitted,topic))nextDraft={...nextDraft,...topicPatch(server,topic)};}
  else if(!topicDirty(draft,base,topic)){nextBase={...nextBase,...topicPatch(server,topic)};nextDraft={...nextDraft,...topicPatch(server,topic)};}
 }
 return {draft:nextDraft,base:nextBase};
}
/** Called under the existing MySQL policy-row lock; unrelated topics are never patched. */
export function mergePolicyTopic(current:CrmPolicyConfig,topic:string,body:any){
 if(!isPolicyTopic(topic)||!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!['base','patch'].includes(k)))return {kind:'invalid' as const};
 const exact=(v:any)=>v&&typeof v==='object'&&!Array.isArray(v)&&policyEqual(Object.keys(v).sort(),[...policyTopicKeys[topic]].sort());
 if(!exact(body.base)||!exact(body.patch))return {kind:'invalid' as const};
 // Full topic shape is required, including unchanged leaves; metadata is never accepted.
 const proposed=mergePolicyConfig(current,body.patch);
 if(Object.keys(proposed.errors).length)return {kind:'validation' as const,errors:proposed.errors};
 if(!policyEqual(topicPatch(proposed.value,topic),body.patch))return {kind:'invalid' as const};
 if(policyEqual(topicPatch(current,topic),body.patch))return {kind:'unchanged' as const,value:current};
 if(!policyEqual(topicPatch(current,topic),body.base))return {kind:'conflict' as const,current};
 return {kind:'saved' as const,value:proposed.value};
}

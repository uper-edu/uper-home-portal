import type {CrmPolicyConfig} from '../types/crmPolicyConfig';
import {topicPatch,policyEqual,type PolicyTopicRequest} from './crmPolicyTopics';
import {PolicySaveError,policySaveResponseError} from './crmPolicyValidation';
/** One write; reconcile a lost response by reading, never automatically write again. */
export async function savePolicyTopic(request:PolicyTopicRequest,fetcher:typeof fetch=fetch):Promise<CrmPolicyConfig>{
 try{
  const response=await fetcher('/api/crm/policy-config/topics/'+encodeURIComponent(request.topic),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({base:request.base,patch:request.patch}),signal:AbortSignal.timeout(15000)});
  const body=await response.json();if(!response.ok)throw policySaveResponseError(response.status,body);
  if(body?.success===true&&body.policy&&policyEqual(topicPatch(body.policy,request.topic),request.patch))return body.policy;
 }catch(error){if(error instanceof PolicySaveError)throw error;}
 try{
  const response=await fetcher('/api/crm/policy-config',{signal:AbortSignal.timeout(15000)});
  if(response.ok){const saved=await response.json();if(policyEqual(topicPatch(saved,request.topic),request.patch))return saved;}
 }catch{/* Unknown is not proof of rejection. Keep the draft and require a manual retry. */}
 throw new PolicySaveError('policy_topic_unknown');
}

export async function readSavedPolicy(fetcher:typeof fetch=fetch):Promise<CrmPolicyConfig>{
 try{const response=await fetcher('/api/crm/policy-config',{signal:AbortSignal.timeout(15000)});if(!response.ok)throw policySaveResponseError(response.status,await response.json().catch(()=>null));const saved=await response.json();if(saved&&saved.businessHours&&saved.firstResponseSla)return saved;}catch(error){if(error instanceof PolicySaveError)throw error;}
 throw new PolicySaveError('policy_topic_unknown');
}

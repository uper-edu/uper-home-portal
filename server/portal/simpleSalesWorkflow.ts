import {profileFieldResults} from '../../src/utils/crmProfileSaveResult.ts';
import {observedStageFacts} from '../../src/utils/crmSalesFacts.ts';
import {queueExtraction} from './aiExtraction.ts';
import {recordProfileUpdates} from './dynamicProfile.ts';
import {contactOccurrence} from '../../src/utils/crmInteractionTimeline.ts';
import {randomUUID} from 'node:crypto';
import {firstContactOutcome,validateCommitment} from '../../src/utils/crmSimpleFollowup.ts';
import {appendBuyingSignals,observedBuyingSignals,buyingSignalOptions} from '../../src/utils/crmBuyingSignals.ts';
import {stageFact,fact} from './trustWorkflow.ts';
const bad=(s:string,status=400):never=>{throw Object.assign(Error(s),{status});};
/** Called inside the existing transaction; authorization is rechecked under the lead lock. */
export async function saveSimpleSalesWorkflow(c:any,leadId:string,actor:string,b:any,canWrite:(p:any)=>boolean,clock=new Date()){
 const p=(await c.query('SELECT profile FROM portal_leads WHERE id=:p1 FOR UPDATE',[leadId])).rows[0]?.profile;
 if(!p||!canWrite(p))bad('Lead not found',404);
 if(typeof b.requestId!=='string'||!b.requestId||b.requestId.length>100)bad('Request ID required');
 const prior=(p.followUpLogs||[]).find((l:any)=>l.requestId===b.requestId);
 if(prior){if(prior.actor!==actor||prior.input!==JSON.stringify(b))bad('Follow-up request conflict',409);return {lead:p,...prior.result,replayed:true};}
 if(b.workflowVersion!==3)bad('Refresh CRM to use the simplified follow-up form');
 if(b.expectedRevision!==(p.simpleRevision||0))bad('Customer changed; refresh and review',409);
 if(typeof b.summary!=='string'||!b.summary.trim()||b.summary.length>10000)bad('Follow-up summary required');
 if(!['contact','internal'].includes(b.recordKind))bad('Choose a record type');
 if(b.recordKind==='contact'&&!['WhatsApp','Phone Call','Campus Visit','Email','Other'].includes(b.channel))bad('Choose a contact channel');
 if(b.buyingSignalsDetected!==undefined&&(!Array.isArray(b.buyingSignalsDetected)||b.buyingSignalsDetected.some((s:any)=>!buyingSignalOptions.includes(s))))bad('Invalid buying signal');
 const checked=<T>(fn:()=>T):T=>{try{return fn();}catch(e){return bad((e as Error).message);}};
 const stages=checked(()=>observedStageFacts(b));
 const outcome=checked(()=>firstContactOutcome({kind:b.recordKind,result:b.connectStatus,channel:b.channel,summary:b.summary,exceptionReason:b.exceptionReason}));
 if(b.exceptionReason&&(b.recordKind!=='internal'||typeof b.exceptionReason!=='string'||!b.exceptionReason.trim()))bad('Exception reason required');
 if(b.contactState!==undefined&&!['active','stopped'].includes(b.contactState))bad('Invalid contact arrangement');
 if(b.contactState&&(!b.contactReason||typeof b.contactReason!=='string'||!b.contactReason.trim()))bad('Contact arrangement reason required');
 if(b.newStage)bad('请到客户资料页明确调整销售阶段并关联依据');
 if(b.newStage&&!['New','Contacted','Assessment Booked','Assessment Done','Trial Booked','Trial Attended','Enrolled','Lost'].includes(b.newStage))bad('Invalid sales stage');
 if((b.answeredRequests||[]).length&&(b.recordKind!=='contact'||b.connectStatus!=='Connected'))bad('Only actual replies can resolve customer requests');
 let occurrence:any;try{occurrence=contactOccurrence(b,clock);}catch(e){bad((e as Error).message);}
 const at=clock.toISOString(),commitments=[...(p.commitments||[])];
 if(b.commitment){const v=b.commitment;if(typeof v.action!=='string'||v.action.length>2000)bad('Commitment evidence required');const item=checked(()=>validateCommitment({id:randomUUID(),action:v.action,status:'active',at:v.at||undefined,date:v.date||undefined,timezone:v.timezone,sourceId:b.requestId}));commitments.push({...item,actor,recordedAt:at});}
 if(b.commitmentChange){const change=b.commitmentChange,index=commitments.findIndex((v:any)=>v.id===change.id&&v.status==='active');if(index<0||!['fulfilled','cancelled','rescheduled'].includes(change.status)||typeof change.reason!=='string'||!change.reason.trim())bad('Commitment changed; review the record',409);if(change.status==='rescheduled'&&!b.commitment)bad('Replacement commitment required');commitments[index]={...commitments[index],status:change.status,updatedAt:at,updatedBy:actor,reason:change.reason};}
 if(b.answeredRequests!==undefined&&(!Array.isArray(b.answeredRequests)||b.answeredRequests.some((id:any)=>typeof id!=='string')||new Set(b.answeredRequests).size!==b.answeredRequests.length))bad('Invalid request');
 if((b.answeredRequests||[]).length)bad('请刷新页面：提示不再需要逐项销单，请记录实际回应原文');
 const handled:string[]=[];
 await stageFact(c,leadId,actor,p,b,b.summary);
 let cancelledNotifications=0,firstDueAt:string|undefined;const completed:string[]=[];if(outcome){const rows=(await c.query("SELECT * FROM followup_tasks WHERE lead_id=:p1 AND kind='consultation' AND status IN ('open','overdue') FOR UPDATE",[leadId])).rows;for(const task of rows){firstDueAt=task.original_due_at||task.due_at;if(typeof firstDueAt==='string'&&!/(Z|[+-]\d\d:\d\d)$/.test(firstDueAt))firstDueAt=firstDueAt.replace(' ','T')+'Z';await c.query("UPDATE followup_tasks SET status='completed',revision=revision+1,details=JSON_SET(details,'$.firstOutcome',:p2) WHERE id=:p1",[task.id,outcome]);cancelledNotifications+=(await c.query("UPDATE notification_jobs SET state='cancelled',result='First follow-up processed',completed_at=UTC_TIMESTAMP(6) WHERE state='pending' AND JSON_UNQUOTE(JSON_EXTRACT(snapshot,'$.payload.taskId'))=:p1",[task.id])).rowCount;completed.push(task.id);}}
 const result:any={logId:randomUUID(),completedTaskIds:completed,cancelledTaskIds:[],handledRequestIds:handled,createdTaskId:null,cancelledNotifications,firstOutcome:outcome,recordOnly:!outcome,contactPlanChange:b.contactState?(b.contactState==='stopped'?'stopped':'restored'):null};
 const actorRow=(await c.query('SELECT display_name FROM crm_users WHERE id=:p1',[actor])).rows[0];
 const log={...b,...occurrence,id:result.logId,actor,staffName:actorRow?.display_name||actor,at,timestamp:at,recordKind:b.recordKind==='internal'?'closure':'contact',input:JSON.stringify(b),result};
 let next:any={...p,...appendBuyingSignals(p,observedBuyingSignals(b)),commitments,simpleRevision:(p.simpleRevision||0)+1,followUpLogs:[...(p.followUpLogs||[]),log],...(b.recordKind==='contact'?{touchCount:(p.touchCount||0)+1,lastContactedAt:at,connectStatus:b.connectStatus}:{}),...(completed.length?{firstFollowup:{outcome,at,actor,logId:result.logId,dueAt:firstDueAt}}:{}),...(b.newStage?{currentStage:b.newStage,stageUpdatedAt:at,stageRevision:(p.stageRevision||0)+1}:{}),...(b.contactState?{contactArrangement:{state:b.contactState,reason:b.contactReason,at,actor,version:(p.contactArrangement?.version||0)+1}}:{})};

 if(b.profileUpdates&&Object.keys(b.profileUpdates).length){if(!b.profileVersions)bad('缺少画像字段版本');const updated=await recordProfileUpdates(c,next,b.profileUpdates,b.profileVersions,{actor,sourceType:b.recordKind==='contact'?'sales_contact':'sales_edit',sourceRecordId:result.logId,occurredAt:occurrence?.occurredAt||null,recordedAt:at,reason:b.summary,correction:b.profileCorrection===true});next=updated.profile;result.profileFieldResults=profileFieldResults(b.profileUpdates,updated.changes,next);}

 for(const stage of stages)await fact(c,leadId,'sales.stage_observed',actor,{stage,sourceLogId:result.logId,summary:b.summary,occurredAt:occurrence?.occurredAt||null,recordedAt:at});
 await fact(c,leadId,'followup.recorded',actor,{...b,...occurrence,result});await c.query('UPDATE portal_leads SET profile=:p2 WHERE id=:p1',[leadId,next]);await queueExtraction(c,leadId,'sales_record',result.logId,b.summary,occurrence?.occurredAt||null,actor,Object.keys(b.profileUpdates||{}));await c.query("INSERT INTO portal_audit(actor,action,data) VALUES(:p1,'followup.save',:p2)",[actor,{leadId,...result}]);return {lead:next,...result};
}

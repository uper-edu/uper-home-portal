/** Caller must authorize the customer first. Every source lookup remains customer-scoped. */
export async function resolveNotificationTarget(db:any,leadId:string,kind:string,ref:string){
 const own="(lead_id=:p2 OR lead_id IN (SELECT id FROM portal_leads WHERE profile->>'$.identityMergedInto'=:p2))";
 const row=async(sql:string)=>(await db.query(sql,[ref,leadId])).rows[0];
 if(kind==='assessment'){const r=await row('SELECT id FROM hsk_attempts WHERE id=:p1 AND '+own);return r?{tab:'assessment',assessmentId:r.id}:null;}
 if(kind==='task'){const r=await row('SELECT id FROM followup_tasks WHERE id=:p1 AND '+own);return r?{tab:'activities',taskId:r.id}:null;}
 if(kind==='fact'){const r=await row('SELECT id FROM crm_facts WHERE id=:p1 AND '+own);return r?{tab:'profile',historyId:r.id}:null;}
 if(kind==='submission'){const r=await row('SELECT id,payload,created_at FROM site_submissions WHERE id=:p1 AND '+own);return r?{tab:'profile',submission:{id:r.id,original:typeof r.payload?.message==='string'?r.payload.message:'',recordedAt:r.created_at}}:null;}
 if(kind==='conversation'){const r=await row('SELECT id FROM conversations WHERE id=:p1 AND '+own);return r?{tab:'chat',conversationId:r.id}:null;}
 if(kind==='message'){const r=(await db.query("SELECT m.id,m.conversation_id FROM messages m JOIN conversations c ON c.id=m.conversation_id WHERE m.id=:p1 AND (c.lead_id=:p2 OR c.lead_id IN (SELECT id FROM portal_leads WHERE profile->>'$.identityMergedInto'=:p2))",[ref,leadId])).rows[0];return r?{tab:'chat',conversationId:r.conversation_id,messageId:r.id}:null;}
 if(kind==='request'){
  const r=await row("SELECT id,data,source_id FROM crm_engagements WHERE id=:p1 AND kind='task_request' AND "+own);if(!r)return null;
  if(r.data?.sourceType==='sales_record'){const f=(await db.query("SELECT id FROM crm_facts WHERE data->>'$.result.logId'=:p1 AND "+own,[r.source_id,leadId])).rows[0];return f?{tab:'activities',historyId:f.id}:null;}
  if(!r.data?.conversationId||!r.data?.messageId)return null;
  const m=(await db.query("SELECT m.id,m.conversation_id FROM messages m JOIN conversations c ON c.id=m.conversation_id WHERE m.conversation_id=:p1 AND (m.id=:p2 OR m.request_id=:p2) AND m.role='user' AND (c.lead_id=:p3 OR c.lead_id IN (SELECT id FROM portal_leads WHERE profile->>'$.identityMergedInto'=:p3)) ORDER BY m.created_at LIMIT 1",[r.data.conversationId,r.data.messageId,leadId])).rows[0];return m?{tab:'activities',historyId:'message:'+m.id,conversationId:m.conversation_id,messageId:m.id}:null;
 }
 if(kind==='agreement'){const r=(await db.query('SELECT profile FROM portal_leads WHERE id=:p1',[leadId])).rows[0];return r?.profile?.commitments?.some((c:any)=>c.id===ref)?{tab:'activities',agreementId:ref}:null;}
 return null;
}
/** Scope of the saved aggregate, not today's modified rule. Caller applies customer visibility first. */
export async function digestTargetScope(db:any,jobId:string){
 const r=(await db.query('SELECT snapshot FROM notification_jobs WHERE id=:p1',[jobId])).rows[0],s=r?.snapshot;if(s?.event!=='daily.digest')return null;
 const scope=s.payload?.scope||{date:s.payload?.date,timezone:s.calendar?.timezone||s.rule?.timezone,tiers:s.rule?.tiers||[],states:s.rule?.states||[],sources:s.rule?.sources||[]};
 if(!/^\d{4}-\d{2}-\d{2}$/.test(scope.date)||!['tiers','states','sources'].every(k=>Array.isArray(scope[k])&&scope[k].every((v:any)=>typeof v==='string')))return null;
 try{new Intl.DateTimeFormat('en',{timeZone:scope.timezone});}catch{return null;}
 if(!scope.timezone)return null;return scope;
}
export function matchesDigestTarget(profile:any,createdAt:any,scope:any){if(!createdAt)return false;const d=createdAt instanceof Date?createdAt:new Date(typeof createdAt==='string'&&!/(Z|[+-]\d\d:\d\d)$/.test(createdAt)?createdAt.replace(' ','T')+'Z':createdAt);if(!Number.isFinite(d.getTime()))return false;const date=new Intl.DateTimeFormat('en-CA',{timeZone:scope.timezone}).format(d);return date===scope.date&&(!scope.tiers.length||scope.tiers.includes(profile.tier))&&(!scope.states.length||scope.states.includes(profile.currentStage))&&(!scope.sources.length||scope.sources.includes(profile.entryPoint));}

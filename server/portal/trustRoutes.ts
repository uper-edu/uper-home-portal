import {restoreMistakenFulfilment} from './agreementRestore.ts';
import {attachIdentityContactHolds,activateIdentityLead,mergeIdentityLead,lockIdentityRegistry} from './identityConsolidation.ts';
import {salesProgressContext,validateSalesProgress} from './salesProgress.ts';
import {voidEnrollmentConfirmation} from './enrollmentCorrection.ts';
import {saveProfileUpdates} from './dynamicProfile.ts';
import {appendRecordAmendment} from './recordAmendments.ts';
import {projectFactLedger} from '../../src/utils/crmFactLedger.ts';
import {taskRequests,requestDeadline} from './taskManagement.ts';
import {contactRestriction} from '../../src/utils/crmContact.ts';
import {pendingIdentity,attachIdentity,identityMatch,identityComparison,identityControls} from './identityReview.ts';
import {outreachPolicy,isCrmManager,canReviewIdentityRole} from '../../src/utils/crmOutreach.ts';
import { permittedRecord } from "../../src/utils/accessControl.ts";
import { allowed } from "./identity.ts";
import {customerDimensionCatalog} from './customerInsights.ts';
import {CRM_DIMENSION_CATALOG_VERSION} from '../../src/utils/crmDimensionCatalog.ts';
import {
  fact,
  operation,
  lockLead,
  taskCommand,
  invalid,
  stageFact,
} from "./trustWorkflow.ts";
export function mountTrustRoutes(
  app: any,
  { wrap, leadAccess, requestAllowed, staff }: any,
) {
  app.get('/api/crm/dimensions',wrap(async(req:any,res:any)=>{
    const e=await staff(req);
    if(!e.permissions?.includes('crm.read'))invalid('CRM_READ_PERMISSION_REQUIRED',403);
    const {pool}=await import('./store.ts');
    res.set('Cache-Control','no-store').json({version:CRM_DIMENSION_CATALOG_VERSION,dimensions:await customerDimensionCatalog(pool)});
  }));
  app.get('/api/crm/leads/:id/extractions',wrap(async(req:any,res:any)=>{
    const {l}=await leadAccess(req,'crm.read');const {pool}=await import('./store.ts');
    const rows=(await pool.query(`SELECT id,source_type,source_id,status,output,error_code,attempts,input,created_at,completed_at FROM crm_ai_extractions WHERE (lead_id=:p1 OR lead_id IN (SELECT id FROM portal_leads WHERE profile->>'$.identityMergedInto'=:p1)) ORDER BY created_at DESC,id DESC LIMIT 50`,[l.id])).rows;
    res.set('Cache-Control','no-store').json({leadId:l.id,rows:rows.map((r:any)=>({...r,input:{text:r.input.text,occurredAt:r.input.occurredAt,sourceRoot:r.input.sourceRoot,amendment:r.input.amendment,explicitFields:r.input.explicitFields}}))});
  }));
  app.post('/api/crm/leads/:id/profile-fields',wrap(async(req:any,res:any)=>{
    const {l,e}=await leadAccess(req,'crm.write');const {tx}=await import('./store.ts');
    res.json(await tx((c:any)=>saveProfileUpdates(c,l.id,e.id,req.body,(p:any)=>requestAllowed(e,p,req))));
  }));
  app.get('/api/crm/leads/:id/facts',wrap(async(req:any,res:any)=>{
    const {l}=await leadAccess(req);const {pool}=await import('./store.ts');
    const facts=(await pool.query(`SELECT * FROM crm_facts WHERE (lead_id=:p1 OR lead_id IN (SELECT id FROM portal_leads WHERE profile->>'$.identityMergedInto'=:p1)) ORDER BY created_at DESC,id DESC`,[l.id])).rows;
    const messages=(await pool.query("SELECT m.* FROM messages m JOIN conversations c ON c.id=m.conversation_id WHERE (c.lead_id=:p1 OR c.lead_id IN (SELECT id FROM portal_leads WHERE profile->>'$.identityMergedInto'=:p1)) AND m.role='user' ORDER BY m.created_at DESC,m.id",[l.id])).rows;
    const attempts=(await pool.query(`SELECT id,result,created_at FROM hsk_attempts WHERE (lead_id=:p1 OR lead_id IN (SELECT id FROM portal_leads WHERE profile->>'$.identityMergedInto'=:p1))`,[l.id])).rows;
    res.json({leadId:l.id,events:projectFactLedger(l.id,facts,messages,attempts,l.profile),scope:'facts_not_intent_or_tasks'});
  }));
  app.post('/api/crm/leads/:id/facts/:factId/corrections',wrap(async(req:any,res:any)=>{
    await leadAccess(req,'crm.read');invalid('撤回入口已停用，请刷新并追加补充／修正记录',410);
  }));
  app.post('/api/crm/leads/:id/amendments',wrap(async(req:any,res:any)=>{
    const {l,e}=await leadAccess(req,'crm.read');const {tx}=await import('./store.ts');
    res.json(await tx((c:any)=>appendRecordAmendment(c,l.id,e.id,req.body,(p:any,permission:string)=>e.permissions.includes(permission)&&requestAllowed(e,p,req,permission))));
  }));
  app.get('/api/crm/identity-reviews', wrap(async(req:any,res:any)=>{
    const e=await staff(req);
    const {pool}=await import('./store.ts');
    const controls=await identityControls(pool);
    if(!canReviewIdentityRole(e,controls))invalid(controls.identityReviewManagerOnly?'IDENTITY_MANAGER_REQUIRED':'IDENTITY_REVIEW_PERMISSION_REQUIRED',403);
    const seen=new Set<string>();
    const reviews=(await pendingIdentity(pool)).filter((r:any)=>{
      const key=[r.lead_id,r.candidate_id].sort().join(':');
      if(seen.has(key)||!requestAllowed(e,r.source_profile,req,'crm.read')||!requestAllowed(e,r.candidate_profile,req,'crm.read')||!permittedRecord(e,r.source_profile,'crm.followup')||!permittedRecord(e,r.candidate_profile,'crm.followup'))return false;
      seen.add(key);return true;
    }).map((r:any)=>({leadId:r.lead_id,candidateId:r.candidate_id,name:r.source_profile.fullName||r.lead_id,candidateName:r.candidate_profile.fullName||r.candidate_id,basis:identityMatch(r.source_profile,r.candidate_profile)}));
    res.json({reviews});
  }));
  app.get('/api/crm/leads/:id/identity-comparison',wrap(async(req:any,res:any)=>{
    const {l,e}=await leadAccess(req);
    const {tx}=await import('./store.ts');
    res.json(await tx(async(c:any)=>{
      const controls=await identityControls(c);
      if(!canReviewIdentityRole(e,controls))invalid(controls.identityReviewManagerOnly?'IDENTITY_MANAGER_REQUIRED':'IDENTITY_REVIEW_PERMISSION_REQUIRED',403);
      const data=await identityComparison(c,l.id,typeof req.query.candidateId==='string'?req.query.candidateId:undefined,(p:any)=>requestAllowed(e,p,req,'crm.read'));
      await attachIdentity(c,e,[data.left.profile,data.right.profile]);
      return {...data,canConfirm:data.pending&&!data.crossConflict&&permittedRecord(e,data.left.profile,'crm.followup')&&permittedRecord(e,data.right.profile,'crm.followup')};
    }));
  }));
  app.get('/api/crm/leads/:id/contact-evidence',wrap(async(req:any,res:any)=>{
    const {l,e}=await leadAccess(req);
    if(!permittedRecord(e,l.profile,'crm.followup'))invalid('CONTACT_PERMISSION_DENIED',403);
    const {pool}=await import('./store.ts');
    const candidates=(await pendingIdentity(pool,l.id)).map((r:any)=>({id:r.lead_id===l.id?r.candidate_id:r.lead_id,profile:r.lead_id===l.id?r.candidate_profile:r.source_profile})).filter((r:any)=>requestAllowed(e,r.profile,req,'crm.read')&&permittedRecord(e,r.profile,'crm.followup')).map((r:any)=>({id:r.id,name:r.profile.fullName||r.id}));
    const answered=new Set((l.profile.followUpLogs||[]).filter((v:any)=>v.sourceMessageAnswered===true).map((v:any)=>v.sourceMessageId));
    const messages=(await pool.query("SELECT m.id,m.content,m.created_at,m.conversation_id FROM messages m JOIN conversations v ON v.id=m.conversation_id WHERE (v.lead_id=:p1 OR v.lead_id IN (SELECT id FROM portal_leads WHERE profile->>'$.identityMergedInto'=:p1)) AND m.role='user' ORDER BY m.created_at DESC,m.id DESC LIMIT 30",[l.id])).rows.filter((m:any)=>!answered.has(m.id));
    res.json({candidates,messages});
  }));
  app.post('/api/crm/leads/:id/contact-authorization',wrap(async(req:any,res:any)=>{
    const {l,e}=await leadAccess(req);
    const {tx}=await import('./store.ts');
    res.json(await tx(async(c:any)=>{
      const current=await lockLead(c,l.id,(p:any)=>requestAllowed(e,p,req,'crm.read'),true);
      await attachIdentity(c,e,[current],true);
      await attachIdentityContactHolds(c,[current]);
      if(current.identityContactHold?.includes('phone'))invalid('IDENTITY_CONTACT_HOLD',403);
      const b=req.body,purpose=b.purpose;
      if(!['sales_followup','identity_verification','customer_reply'].includes(purpose))invalid('CONTACT_EVIDENCE_REQUIRED');
      const denied=outreachPolicy(e,current,purpose);
      if(denied)invalid(denied,403);
      if((current.owner||null)!==(b.expectedOwner||null))invalid('CONTACT_OWNER_CHANGED',409);
      if(b.expectedArrangementVersion!==(current.contactArrangement?.version||0))invalid('CONTACT_CONTEXT_CHANGED',409);
      const assisted=isCrmManager(e)&&current.owner!==e.id;
      const exceptional=purpose==='identity_verification'||(purpose==='customer_reply'&&contactRestriction(current));
      if(exceptional&&(typeof b.reason!=='string'||!b.reason.trim()||b.reason.length>2000))invalid('CONTACT_REASON_REQUIRED');
      if(purpose==='identity_verification'){
        const pair=(await pendingIdentity(c,current.id,true)).find((r:any)=>r.lead_id===b.candidateId||r.candidate_id===b.candidateId);
        const peer=pair&&(pair.lead_id===current.id?pair.candidate_profile:pair.source_profile);
        if(!peer||!requestAllowed(e,peer,req,'crm.read')||!permittedRecord(e,peer,'crm.followup'))invalid('CONTACT_EVIDENCE_REQUIRED',403);
      }
      if(purpose==='customer_reply'){
        const row=(await c.query("SELECT m.id,m.role,m.created_at FROM messages m JOIN conversations v ON v.id=m.conversation_id WHERE m.id=:p1 AND (v.lead_id=:p2 OR v.lead_id IN (SELECT id FROM portal_leads WHERE profile->>'$.identityMergedInto'=:p2))",[b.sourceMessageId||'',current.id])).rows[0];
        const time=(v:any)=>Date.parse(typeof v==='string'&&!/[Zz]|[+-]\d\d:\d\d$/.test(v)?v.replace(' ','T')+'Z':v);
        const after=current.contactReview?.at||current.contactArrangement?.at;
        if(!row||row.role!=='user'||b.replyConfirmedUnanswered!==true||(current.followUpLogs||[]).some((v:any)=>v.sourceMessageId===row.id&&v.sourceMessageAnswered===true)||(contactRestriction(current)&&(!after||!Number.isFinite(time(row.created_at))||time(row.created_at)<=time(after))))invalid('CONTACT_EVIDENCE_REQUIRED');
      }
      if(!['phone','whatsapp','copy'].includes(b.action))invalid('Invalid contact action');
      return operation(c,e.id,b,{leadId:l.id,kind:'contact-authorization'},async()=>{
        await fact(c,l.id,'contact.intent',e.id,{action:b.action,purpose,reason:exceptional?b.reason.trim():null,assisted,owner:current.owner||null,candidateId:purpose==='identity_verification'?b.candidateId:undefined,sourceMessageId:purpose==='customer_reply'?b.sourceMessageId:undefined,replyConfirmedUnanswered:purpose==='customer_reply'?true:undefined,identityVerification:purpose==='identity_verification',scope:'authorized_intent_not_confirmed_sent_or_contacted'});
        return {authorized:true,leadId:l.id};
      });
    }));
  }));
  // Uses the same per-record CRM read authorization as all customer detail tabs.
  app.get('/api/crm/leads/:id/assessments',wrap(async(req:any,res:any)=>{
    const {l}=await leadAccess(req);
    const {pool}=await import('./store.ts');
    const attempts=(await pool.query("SELECT id,result,created_at FROM hsk_attempts WHERE (lead_id=:p1 OR lead_id IN (SELECT id FROM portal_leads WHERE profile->>'$.identityMergedInto'=:p1)) ORDER BY created_at DESC,id DESC",[l.id])).rows;
    const p=l.profile;
    res.json({leadId:l.id,attempts:attempts.map((r:any)=>({id:r.id,result:r.result,recordedAt:typeof r.created_at==='string'?r.created_at.replace(' ','T').replace(/Z$/,'')+'Z':r.created_at})),current:{levelSource:p.levelSource,levelConfirmed:p.levelConfirmed,latestAssessment:p.latestAssessment,reportedLevel:p.reportedLevel,quizScore:p.quizScore,quizMaxScore:p.quizMaxScore,quizResultSummary:p.quizResultSummary,quizBreakdown:p.quizBreakdown}});
  }));
  app.get(
    "/api/crm/leads/:id/trust",
    wrap(async (req: any, res: any) => {
      const { l, e } = await leadAccess(req);
      const { pool } = await import("./store.ts");
      const facts = (
        await pool.query(
          "SELECT * FROM crm_facts WHERE (lead_id=:p1 OR lead_id IN (SELECT id FROM portal_leads WHERE profile->>'$.identityMergedInto'=:p1)) ORDER BY created_at DESC,id DESC",
          [l.id],
        )
      ).rows;
      const tasks = (
        await pool.query(
          "SELECT * FROM followup_tasks WHERE (lead_id=:p1 OR lead_id IN (SELECT id FROM portal_leads WHERE profile->>'$.identityMergedInto'=:p1)) ORDER BY due_at,id",
          [l.id],
        )
      ).rows;
      const engagements = (
        await pool.query(
          "SELECT e.* FROM crm_engagements e LEFT JOIN conversations c ON c.id=JSON_UNQUOTE(JSON_EXTRACT(e.data,'$.conversationId')) AND c.lead_id=e.lead_id WHERE (e.lead_id=:p1 OR e.lead_id IN (SELECT id FROM portal_leads WHERE profile->>'$.identityMergedInto'=:p1)) AND (NULLIF(JSON_UNQUOTE(JSON_EXTRACT(e.data,'$.conversationId')),'') IS NULL OR c.id IS NOT NULL) ORDER BY e.created_at DESC",
          [l.id],
        )
      ).rows;
      await attachIdentity(pool,e,[l.profile]);
      const candidates=(await pendingIdentity(pool,l.id)).map((r:any)=>{
        const profile=r.lead_id===l.id?r.candidate_profile:r.source_profile;
        return {...r,candidate_id:r.lead_id===l.id?r.candidate_id:r.lead_id,profile};
      }).filter((r:any)=>requestAllowed(e,r.profile,req,'crm.read')).map((r:any)=>({candidate_id:r.candidate_id,decision:'pending',name:r.profile.fullName||r.profile.name,email:r.profile.email,whatsapp:r.profile.whatsapp,basis:identityMatch(l.profile,r.profile),canConfirm:Boolean(l.profile.identityReview.canReview&&permittedRecord(e,l.profile,"crm.followup")&&permittedRecord(e,r.profile,"crm.followup"))}));
      const requests=engagements.filter((r:any)=>r.kind==='task_request');
      res.json({ facts, tasks:tasks.map((t:any)=>({...t,requestDueAt:requestDeadline(t,requests)})), engagements:engagements.filter((r:any)=>r.kind!=='task_request'), requests, candidates, identityReview:l.profile.identityReview });
    }),
  );
  app.get(
    "/api/crm/leads/:id/operations/:requestId",
    wrap(async (req: any, res: any) => {
      const { l, e } = await leadAccess(req);
      const { pool } = await import("./store.ts");
      const prior = (
        await pool.query(
          "SELECT result FROM crm_operations WHERE actor=:p1 AND request_id=:p2",
          [e.id, req.params.requestId],
        )
      ).rows[0];
      if (prior?.result.leadId === l.id) return res.json(prior.result);
      const log = (l.profile.followUpLogs || []).find(
        (v: any) => v.requestId === req.params.requestId && v.actor === e.id,
      );
      if (log) return res.json({ saved: true, leadId: l.id, ...log.result });
      invalid("Operation not found", 404);
    }),
  );
  app.post(
    "/api/crm/leads/:id/task-actions",
    wrap(async (req: any, res: any) => {
      const { l, e } = await leadAccess(req, "crm.write");
      invalid('General tasks are retired; refresh CRM',410);
      const { tx } = await import("./store.ts");
      const result = await tx((c: any) =>
        taskCommand(c, l.id, e.id, req.body, (p: any) =>
          requestAllowed(e, p, req),
        ),
      );
      res.json(result);
    }),
  );
  app.get('/api/crm/leads/:id/stage-context',wrap(async(req:any,res:any)=>{
    const {l}=await leadAccess(req,'crm.read');const {pool}=await import('./store.ts');
    res.set('Cache-Control','no-store').json({leadId:l.id,...await salesProgressContext(pool,l.id,l.profile)});
  }));
  app.post('/api/crm/leads/:id/agreement-restore',wrap(async(req:any,res:any)=>{const {l,e}=await leadAccess(req,'crm.followup');const {tx}=await import('./store.ts');res.json(await tx((c:any)=>restoreMistakenFulfilment(c,l.id,e.id,req.body,(p:any)=>requestAllowed(e,p,req))));}));
  app.post('/api/crm/leads/:id/enrollment-void',wrap(async(req:any,res:any)=>{
    const {l,e}=await leadAccess(req,'crm.write');const {tx}=await import('./store.ts');
    res.json(await tx((c:any)=>voidEnrollmentConfirmation(c,l.id,e.id,req.body,(p:any)=>requestAllowed(e,p,req))));
  }));
  app.post('/api/crm/leads/:id/stage',wrap(async(req:any,res:any)=>{
    const {l,e}=await leadAccess(req,'crm.write');const {tx}=await import('./store.ts');
    res.json(await tx(async(c:any)=>{
      const current=await lockLead(c,l.id,(p:any)=>requestAllowed(e,p,req));
      return operation(c,e.id,req.body,{leadId:l.id,kind:'stage'},async()=>{
        const decision=await validateSalesProgress(c,l.id,current,req.body);
        if(req.body.newStage===current.currentStage)invalid('阶段没有变化，请勿重复保存');
        await fact(c,l.id,'stage.changed',e.id,decision);
        const lead={...current,currentStage:req.body.newStage,stageRevision:(current.stageRevision||0)+1,stageUpdatedAt:decision.recordedAt,stageEffectiveAt:decision.effectiveAt,stagePolicyVersion:2};
        await c.query('UPDATE portal_leads SET profile=:p2 WHERE id=:p1',[l.id,lead]);
        await c.query("INSERT INTO portal_audit(actor,action,data) VALUES(:p1,'lead.stage',:p2)",[e.id,{leadId:l.id,...decision}]);
        return {saved:true,leadId:l.id,lead};
      });
    }));
  }));
  app.post(
    "/api/crm/leads/:id/information",
    wrap(async (req: any, res: any) => {
      const { l, e } = await leadAccess(req, "crm.write");
      const { tx } = await import("./store.ts");
      res.json(
        await tx(async (c: any) => {
          await lockLead(c, l.id, (p: any) => requestAllowed(e, p, req));
          return operation(c, e.id, req.body, { leadId: l.id, kind: "information" }, async () => {
            if (
              typeof req.body.summary !== "string" ||
              !req.body.summary.trim() ||
              req.body.summary.length > 20000
            )
              invalid("Information text required");
            const id = crypto.randomUUID();
            await fact(c, l.id, "information.recorded", e.id, {
              id,
              summary: req.body.summary.trim(),
            });
            return { saved: true, leadId: l.id, informationId: id };
          });
        }),
      );
    }),
  );
  app.post(
    "/api/crm/leads/:id/engagement-actions",
    wrap(async (req: any, res: any) => {
      const { l, e } = await leadAccess(req, "crm.write");
      const { tx } = await import("./store.ts");
      res.json(
        await tx(async (c: any) => {
          await lockLead(c, l.id, (p: any) => requestAllowed(e, p, req));
          return operation(c, e.id, req.body, { leadId: l.id, kind: "engagement-actions" }, async () => {
            const b = req.body;
            const selected = b.engagements || [
              { id: b.engagementId, version: b.version },
            ];
            if (
              !Array.isArray(selected) ||
              !selected.length ||
              selected.length > 1000 ||
              new Set(selected.map((v: any) => v.id)).size !== selected.length
            )
              invalid("Information changed; refresh and review", 409);
            if (!b.reason?.trim() || !["dismiss", "link"].includes(b.command))
              invalid("Action and reason required");
            if (
              b.command === "link" &&
              !(
                await c.query(
                  "SELECT id FROM followup_tasks WHERE id=:p1 AND (lead_id=:p2 OR lead_id IN (SELECT id FROM portal_leads WHERE profile->>'$.identityMergedInto'=:p2)) AND status IN ('open','overdue')",
                  [b.taskId, l.id],
                )
              ).rows.length
            )
              invalid("Task not found", 404);
            for (const selection of selected) {
              const row = (
                await c.query(
                  "SELECT * FROM crm_engagements WHERE id=:p1 AND (lead_id=:p2 OR lead_id IN (SELECT id FROM portal_leads WHERE profile->>'$.identityMergedInto'=:p2)) FOR UPDATE",
                  [selection.id, l.id],
                )
              ).rows[0];
              if (
                !row || row.kind === "task_request" ||
                row.state !== "pending" ||
                row.version !== selection.version
              )
                invalid("Information changed; refresh and review", 409);
              await c.query(
                "UPDATE crm_engagements SET state=:p2,task_id=:p3,version=version+1 WHERE id=:p1",
                [
                  row.id,
                  b.command === "link" ? "linked" : "dismissed",
                  b.command === "link" ? b.taskId : null,
                ],
              );
              await fact(c, l.id, "engagement." + b.command, e.id, {
                engagementId: row.id,
                taskId: b.taskId,
                reason: b.reason,
              });
            }
            return { saved: true, leadId: l.id };
          });
        }),
      );
    }),
  );
  app.post(
    "/api/crm/leads/:id/identity-actions",
    wrap(async (req: any, res: any) => {
      const { l, e } = await leadAccess(req, "crm.write");

      const { tx } = await import("./store.ts");
      res.json(
        await tx(async (c: any) => {
          await lockIdentityRegistry(c);
          const controls=await identityControls(c);
          if(!canReviewIdentityRole(e,controls))invalid(controls.identityReviewManagerOnly?'IDENTITY_MANAGER_REQUIRED':'IDENTITY_REVIEW_PERMISSION_REQUIRED',403);
          if(typeof req.body.candidateId!=="string"||req.body.candidateId===l.id)invalid("Identity decision and reason required");
          for(const key of [l.id,req.body.candidateId].sort())await lockLead(c,key,(p:any)=>requestAllowed(e,p,req),true);
          return operation(c, e.id, req.body, {
            leadId: l.id, kind: "identity-actions",
            // Both records must remain accessible, including on a cached retry.
            authorize: () => lockLead(c, req.body.candidateId, (p: any) => requestAllowed(e, p, req),true),
          }, async () => {
            const b = req.body;
            if(typeof b.expectedComparisonRevision!=='string'||!b.expectedComparisonRevision)invalid('Identity evidence changed; refresh and review',409);
            if(b.expectedComparisonRevision){
              const comparison=await identityComparison(c,l.id,b.candidateId,(p:any)=>requestAllowed(e,p,req,'crm.read'));
              if(comparison.revision!==b.expectedComparisonRevision)invalid('Identity evidence changed; refresh and review',409);
            }
            if (
              !b.reason?.trim() ||
              !["same", "different", "shared"].includes(b.decision)
            )
              invalid("Identity decision and reason required");
            const found = (
              await c.query(
                "SELECT * FROM identity_candidates WHERE ((lead_id=:p1 AND candidate_id=:p2) OR (lead_id=:p2 AND candidate_id=:p1)) AND decision='pending' FOR UPDATE",
                [l.id, b.candidateId],
              )
            ).rows;
            if (!found.length || !(await pendingIdentity(c)).some((r:any)=>(r.lead_id===l.id&&r.candidate_id===b.candidateId)||(r.lead_id===b.candidateId&&r.candidate_id===l.id)))
              invalid("Identity candidate changed; refresh and review", 409);
            const subjectId=found[0].lead_id,targetId=found[0].candidate_id;
            const allPending=await pendingIdentity(c,subjectId);
            for(const candidate of [...new Set<string>(allPending.map((r:any)=>r.candidate_id))].sort())await lockLead(c,candidate,(p:any)=>requestAllowed(e,p,req,'crm.followup'),true);
            const currentComparison=await identityComparison(c,l.id,b.candidateId,(p:any)=>requestAllowed(e,p,req,'crm.read'));
            if(currentComparison.revision!==b.expectedComparisonRevision)invalid('Identity evidence changed; refresh and review',409);
            if(currentComparison.crossConflict)invalid('IDENTITY_CROSS_CONFLICT_REQUIRED');
            if(allPending.some((r:any)=>!permittedRecord(e,r.source_profile,'crm.followup')||!permittedRecord(e,r.candidate_profile,'crm.followup')||!requestAllowed(e,r.candidate_profile,req,'crm.followup')))invalid('Identity review requires access to all candidates',403);
            // A same-person conclusion can exclude other candidates only through explicit prior decisions.
            if(b.decision==='same'){
              for(const other of allPending.filter((r:any)=>r.candidate_id!==targetId)){
                const prior=(await c.query("SELECT * FROM identity_candidates WHERE ((lead_id=:p1 AND candidate_id=:p2) OR (lead_id=:p2 AND candidate_id=:p1)) AND decision IN ('different','shared')",[targetId,other.candidate_id])).rows;
                if(!prior.length)invalid('Identity review remaining candidates before consolidation',409);
                await c.query("UPDATE identity_candidates SET decision='different',decided_by=:p3,reason=:p4,decided_at=UTC_TIMESTAMP(6) WHERE lead_id=:p1 AND candidate_id=:p2 AND decision='pending'",[subjectId,other.candidate_id,e.id,b.reason.trim()]);
                await fact(c,subjectId,'identity.different',e.id,{candidateId:other.candidate_id,reason:b.reason.trim(),derivedFrom:{sameTargetId:targetId,priorRelations:prior.map((r:any)=>({visitorId:r.visitor_id,leadId:r.lead_id,candidateId:r.candidate_id,decision:r.decision,reason:r.reason,decidedBy:r.decided_by}))}});
              }
            }
            const subject=await lockLead(c,subjectId,(p:any)=>requestAllowed(e,p,req),true);
            const primary=await lockLead(c,targetId,(p:any)=>requestAllowed(e,p,req),true);
            let resolution:any={canonicalLeadId:subjectId,merged:false};
            if(b.decision==='same')resolution=await mergeIdentityLead(c,subject,primary,e.id,b.reason.trim());
            await c.query(
              "UPDATE identity_candidates SET decision=:p3,decided_by=:p4,reason=:p5,decided_at=UTC_TIMESTAMP(6) WHERE ((lead_id=:p1 AND candidate_id=:p2) OR (lead_id=:p2 AND candidate_id=:p1)) AND decision='pending'",
              [l.id, b.candidateId, b.decision, e.id, b.reason],
            );
            await fact(c, l.id, "identity." + b.decision, e.id, {
              candidateId: b.candidateId,
              reason: b.reason,
              scope: b.decision==='same'?"logical_association_originals_preserved":"independent_identity_release",
              ...resolution,
            });
            const remaining=await pendingIdentity(c,subjectId);
            if(b.decision!=='same'&&!remaining.length){
              const released={...subject,identityLifecycle:'independent',identityDecidedAt:new Date().toISOString()};
              await c.query('UPDATE portal_leads SET profile=:p2 WHERE id=:p1',[subjectId,released]);
              await activateIdentityLead(c,released,e.id);
            }
            return { saved: true, leadId: l.id,remainingCandidates:remaining.length,nextCandidateId:remaining[0]?.candidate_id,...resolution };
          });
        }),
      );
    }),
  );
}

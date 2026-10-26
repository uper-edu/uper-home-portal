import {attachEnrollmentEvidence} from './enrollmentEvidence.ts';
import {campaignScheduleError} from "../../src/utils/campaignWorkspace.ts";
import {sourceKey, campaignAliasTarget} from './campaignSources.ts';
import {assertEditableCampaign,canonicalCampaignId,organicCampaignRecord} from '../../src/utils/organicCampaign.ts';
import {campaignsContext} from '../../cloud/mysql/campaign-context.mjs';
import {pool,tx} from '../portal/store.ts';
import {platform,allowed} from '../portal/identity.ts';
import {campaignMetrics} from '../../src/utils/crmCampaignMetrics.ts';
import {matchesCampaign} from '../../src/utils/crmCampaignLink.ts';
import { createHash } from "node:crypto";
import { allocateCampaignCode } from "./campaignCodeAllocation.ts";
import { CAMPAIGN_LINK_PLACEHOLDER, resolveCampaignLinks } from "../../src/utils/campaignCode.ts";
import { campaignChatLink } from "../../src/utils/crmCampaignLink.ts";
import { validCampaignBudget, CAMPAIGN_BUDGET_ERROR } from "../../src/utils/campaignBudget.ts";
export function loadCampaigns(){return campaignsContext.getStore() || [];}
export async function getCurrentCampaigns(employee?:any){const campaigns=loadCampaigns(),profiles=(await pool.query("SELECT profile FROM portal_leads")).rows.map((r:any)=>r.profile).filter((p:any)=>!employee||allowed(employee,p));await attachEnrollmentEvidence(pool,profiles);const reviews=(await pool.query("SELECT * FROM campaign_source_reviews")).rows;for(const p of profiles){const review=reviews.find((r:any)=>r.id===sourceKey(String(p.campaignId||p.campaign||'').trim()));if(review){p.campaignSourceStatus=review.status;if(review.status==='linked')p.attributionCampaignId=review.campaign_id;}}const resolved=profiles.filter((p:any)=>campaigns.filter((c:any)=>matchesCampaign(p,c)).length<=1);return campaigns.map((c:any)=>({...c,stats:{...c.stats,...campaignMetrics(resolved,c),roi:null}}));}
type CampaignSaveOperation = { kind: "create" } | { kind: "update"; id: string };
const campaignError = (message: string, status: number) =>
  Object.assign(Error(message), { status });
function stableCampaignPayload(value: any): any {
  if (Array.isArray(value)) return value.map(stableCampaignPayload);
  if (value && typeof value === "object")
    return Object.fromEntries(Object.keys(value).sort().filter(k => value[k] !== undefined).map(k => [k, stableCampaignPayload(value[k])]));
  return value;
}
export async function saveCampaign(input: any, operation: CampaignSaveOperation) {
  if (!operation || !["create", "update"].includes(operation.kind))
    throw campaignError("Explicit campaign operation required", 400);
  if (typeof input.name !== "string" || !input.name.trim() || input.name.length > 200)
    throw campaignError("Campaign name is required", 400);
  if (input.stats !== undefined && (
    !input.stats || typeof input.stats !== "object" || Array.isArray(input.stats) ||
    (Object.hasOwn(input.stats, "budgetCost") && !validCampaignBudget(input.stats.budgetCost))
  )) throw campaignError(CAMPAIGN_BUDGET_ERROR, 400);
  if (operation.kind === "create") {
    if (input.code !== undefined) throw campaignError("campaign_code_generated", 400);
    if (typeof input.requestId !== "string" || !/^[-a-zA-Z0-9]{8,100}$/.test(input.requestId))
      throw campaignError("campaign_request_required", 400);
  }
  if (operation.kind === "create" && input.savePhase !== "basics") {
    if (!["campus_seminar","enterprise_roadshow","webinar_class","social_paid_ad","community_referral","education_fair","other"].includes(input.type)) throw campaignError("campaign_type_required",400);
    if (!["offline","online","hybrid"].includes(input.locationType)) throw campaignError("campaign_medium_required",400);
  }
  const fields = { ...input };
  const basicCreation = operation.kind === "create" && input.savePhase === "basics";
  for (const key of ["__actor", "id", "code", "requestId", "savePhase", "promotionLinks", "promotionModel"]) delete fields[key];
  const fingerprint = createHash("sha256").update(JSON.stringify(stableCampaignPayload({ ...fields, ...(basicCreation ? { savePhase: "basics" } : {}) }))).digest("hex");
  const actor = input.__actor || "unknown";
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await tx(async (db: any) => {
        await db.query("SELECT GET_LOCK(:p1,5) AS acquired", ["trial-campaigns"]);
        let old: any;
        if (operation.kind === "update") {
          old = (await db.query("SELECT config AS record FROM trial_campaigns WHERE id=:p1 FOR UPDATE", [operation.id])).rows[0]?.record;
          if (!old) throw campaignError("campaign_not_found", 404);
          assertEditableCampaign({ ...old, id: operation.id });
          if (input.code !== undefined && String(input.code).trim() !== old.code)
            throw campaignError("campaign_code_readonly", 400);
        }
        if(input.requestId){
          const prior = (await db.query(
            "SELECT data FROM portal_audit WHERE action='campaign.save' AND actor=:p1 AND JSON_UNQUOTE(JSON_EXTRACT(data,'$.requestId'))=:p2 ORDER BY id DESC LIMIT 1",
            [actor, input.requestId],
          )).rows[0]?.data;
          if(prior){
            if(prior.fingerprint!==fingerprint||prior.operation!==operation.kind||(operation.kind==='update'&&prior.id!==operation.id))throw campaignError('campaign_request_conflict',409);
            return prior.result;
          }
        }
        const at = new Date();
        const code = old?.code || await allocateCampaignCode(db, input.type || "other", input.locationType || "online", at);
        const campaignId = operation.kind === "update" ? operation.id : code;
        const now = at.toISOString();
        const assets = { posterHeading: "", posterSubheading: "", socialCopy: "", whatsappInvitation: "", chatWelcomeGreeting: "", presentationOutline: "", deskTentBullets: [] };
        const record = {
          nameEn: "", nameId: "", type: "other", organizer: "",
          startDate: "", endDate: "", startTime: "", endTime: "", city: "", venue: "", locationType: "online", address: "",
          targetAudience: [], keyTopics: [], speakers: [],
          ...old, ...fields, id: campaignId, code, name: input.name.trim(),
          status: basicCreation ? "planning" : fields.status ?? old?.status ?? "planning",
          boundUtm: { utm_source: "", utm_medium: "", defaultLang: "id", defaultHook: "hsk_assessment", defaultContext: "website", ...old?.boundUtm, ...fields.boundUtm, utm_campaign: old?.boundUtm?.utm_campaign ?? code },
          aiAssets: { ...assets, ...old?.aiAssets, ...input.aiAssets,
            ...(input.aiAssets?.templateDrafts ? {templateDrafts:{...old?.aiAssets?.templateDrafts,...input.aiAssets.templateDrafts}} : {}) },
          stats: { ...(old?.stats || { impressions: 0, budgetCost: null }),
            ...(input.stats && Object.hasOwn(input.stats,"budgetCost") ? {budgetCost: input.stats.budgetCost} : {}) },
          ...(basicCreation ? {promotionModel: "multiple", promotionLinks: [], locationType: input.locationType || "", type: input.type || ""} : {}),
          createdAt: old?.createdAt || now, updatedAt: now,
        };
        if (["startDate","endDate","startTime","endTime"].some(k=>Object.hasOwn(fields,k)) && campaignScheduleError(record))
          throw campaignError("campaign_schedule_invalid",400);
        if (fields.boundUtm && (["defaultHook","defaultLang"].some(k=>Object.hasOwn(fields.boundUtm,k)) || operation.kind === "create")) {
          if (!["hsk_assessment","trial_class","consultation","scholarship_materials","webinar"].includes(record.boundUtm.defaultHook)
            || !["en","id","zh"].includes(record.boundUtm.defaultLang)) throw campaignError("campaign_entry_invalid",400);
        }
        if (operation.kind === "create") {
          record.aiAssets = resolveCampaignLinks(record.aiAssets, campaignChatLink(code, process.env.APP_URL || "http://localhost:3000"));
          try {
            await db.query("INSERT INTO trial_campaigns(id,code,config) VALUES(:p1,:p2,:p3)", [campaignId, code, record]);
          } catch (error: any) {
            if (error.code === "ER_DUP_ENTRY" || error.errno === 1062) throw campaignError("campaign_code_retry", 503);
            throw error;
          }
        } else {
          await db.query("UPDATE trial_campaigns SET config=:p2 WHERE id=:p1", [campaignId, record]);
        }
        const audit = { id: campaignId, operation: operation.kind, ...(input.requestId ? { requestId: input.requestId, fingerprint, result: record } : {}) };
        await db.query("INSERT INTO portal_audit(actor,action,data) VALUES(:p1,'campaign.save',:p2)", [actor, audit]);
        const current = loadCampaigns();
        const index = current.findIndex(c => c.id === campaignId);
        if (index >= 0) current[index] = record;
        else current.unshift(record);
        return record;
      });
    } catch (error: any) {
      if (error.message !== "campaign_code_retry" || attempt === 2) throw error;
    }
  }
  throw campaignError("campaign_code_retry", 503);
}
export async function deleteCampaign(id: string) {
  assertEditableCampaign({ id });
  return tx(async (db: any) => {
    const saved = (await db.query(
      "SELECT code,config FROM trial_campaigns WHERE id=:p1 FOR UPDATE", [id],
    )).rows[0];
    if (!saved) return false;
    // Historical records can have a non-reserved ID and a reserved source code.
    assertEditableCampaign({ ...saved.config, id });
    assertEditableCampaign({ id, code: saved.code });
    if (saved.config?.promotionLinks?.length)
      throw campaignError("Campaign has promotion links; archive it to preserve existing links and attribution", 409);
    if ((await db.query("SELECT id FROM campaign_source_reviews WHERE campaign_id=:p1 LIMIT 1", [id])).rows.length)
      throw campaignError("Campaign has verified source links; preserve its attribution history", 409);
    const result = await db.query("DELETE FROM trial_campaigns WHERE id=:p1", [id]);
    return result.rowCount > 0;
  });
}
export async function trackCampaignImpression(code:string){code=canonicalCampaignId(code);return tx(async(db:any)=>{const target=await campaignAliasTarget(code,db);const old=(await db.query("SELECT id,config AS record FROM trial_campaigns WHERE LOWER(id)=LOWER(:p1) OR LOWER(code)=LOWER(:p1) FOR UPDATE",[target || code])).rows[0];if(!old)return false;old.record.stats.impressions=(old.record.stats.impressions||0)+1;await db.query("UPDATE trial_campaigns SET config=:p2 WHERE id=:p1",[old.id,old.record]);return true;});}
export function getEnrichedCampaigns(leads:any[]=[]){const campaigns=loadCampaigns();const resolved=leads.filter(p=>campaigns.filter(c=>matchesCampaign(p,c)).length<=1);return campaigns.map(c=>({...c,stats:{...c.stats,...campaignMetrics(resolved,c),roi:null}}));}
export async function getCampaignByIdOrCode(input:string){const canonical=canonicalCampaignId(input);const key=(await campaignAliasTarget(canonical) || canonical).toLowerCase();return loadCampaigns().find(c=>[c.id,c.code,c.name,c.nameEn].some(v=>v?.toLowerCase()===key));}
export function synthesizeCampaignAiAssets(data:any){const title=data.name;const details=[data.startDate,data.startTime,data.venue,data.city].filter(Boolean).join(' · ');const link=data.code?campaignChatLink(data.code,process.env.APP_URL||'http://localhost:3000'):CAMPAIGN_LINK_PLACEHOLDER;const assets={posterHeading:title,posterSubheading:details,socialCopy:[title,details,link.toString()].join('\n'),whatsappInvitation:[title,details,link.toString()].join('\n'),chatWelcomeGreeting:title,presentationOutline:(data.keyTopics||[]).join('\n'),deskTentBullets:data.keyTopics||[]};return {...assets,idAssets:assets,enAssets:assets};}

export async function ensureOrganicCampaign(){const record=organicCampaignRecord();await pool.query("INSERT INTO trial_campaigns(id,code,config) VALUES(:p1,:p1,:p2) ON DUPLICATE KEY UPDATE id=id",[record.id,record]);const existing=(await pool.query("SELECT config FROM trial_campaigns WHERE id=:p1 AND code=:p1",[record.id])).rows[0]?.config;if(!existing?.systemManaged)throw Error("Reserved organic campaign conflicts with an existing record; review without rewriting history");}

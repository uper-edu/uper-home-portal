import crypto from "node:crypto";
import { pool, tx } from "./store.ts";
import { allowed } from "./identity.ts";
import { matchesCampaign } from "../../src/utils/crmCampaignLink.ts";
import { canonicalCampaignId } from "../../src/utils/organicCampaign.ts";
export const sourceKey = (code: string) =>
  crypto.createHash("sha256").update(code.trim().toLowerCase()).digest("hex");
const fail = (status: number, message: string) => {
  throw Object.assign(Error(message), { status });
};
/** Called only inside the saved-lead transaction. A URL visit alone never reaches here. */
export async function recordCampaignSource(c: any, profile: any) {
  const raw = String(profile.campaignId || profile.campaign || "").trim();
  const code = canonicalCampaignId(raw);
  if (code === "organic") return;
  const key = sourceKey(code);
  const review = (
    await c.query(
      "SELECT * FROM campaign_source_reviews WHERE id=:p1 FOR UPDATE",
      [key],
    )
  ).rows[0];
  if (review) {
    if (review.status === "linked") {
      profile.attributionCampaignId = review.campaign_id;
    }
    profile.campaignSourceStatus = review.status;
    return;
  }
  const campaigns = (
    await c.query("SELECT config FROM trial_campaigns")
  ).rows.map((r: any) => r.config);
  if (campaigns.some((v: any) => matchesCampaign(profile, v))) return;
  await c.query(
    "INSERT INTO campaign_source_reviews(id,raw_code,status,revision,config) VALUES(:p1,:p2,'pending',1,:p3) ON DUPLICATE KEY UPDATE id=id",
    [key, raw, { firstSeen: profile.submittedAt || new Date().toISOString() }],
  );
  profile.campaignSourceStatus = "pending";
}
export async function listCampaignSources(employee: any) {
  const rows = (
    await pool.query(
      "SELECT * FROM campaign_source_reviews ORDER BY updated_at DESC",
    )
  ).rows;
  const profiles = (
    await pool.query("SELECT id,profile FROM portal_leads")
  ).rows.filter((r: any) => allowed(employee, r.profile));
  return rows
    .map((r: any) => {
      const leads = profiles.filter(
        (p: any) =>
          sourceKey(
            String(p.profile.campaignId || p.profile.campaign || "").trim(),
          ) === r.id,
      );
      const times = leads
        .map((p: any) => p.profile.submittedAt)
        .filter((v: any) => Number.isFinite(Date.parse(v)))
        .sort();
      return {
        id: r.id,
        rawCode: r.raw_code,
        status: r.status,
        revision: Number(r.revision),
        campaignId: r.campaign_id,
        firstSeen: times[0] || null,
        lastSeen: times.at(-1) || null,
        reason: r.config.reason || "",
        actor: r.config.actor || null,
        leadCount: leads.length,
        leads: leads.map((p: any) => ({
          id: p.id,
          name: p.profile.fullName || p.profile.name || p.id,
          rawCode: p.profile.campaignId || p.profile.campaign,
        })),
      };
    })
    .filter((r: any) => r.leadCount > 0);
}
export async function reviewCampaignSource(id: string, b: any, employee: any) {
  if (
    !/^[a-f0-9]{64}$/.test(id) ||
    !["link", "create", "invalid"].includes(b.action) ||
    typeof b.reason !== "string" ||
    !b.reason.trim() ||
    b.reason.length > 1000 ||
    typeof b.requestId !== "string" ||
    !/^[-a-zA-Z0-9]{8,100}$/.test(b.requestId)
  )
    fail(400, "source_invalid_input");
  const fingerprint = crypto
    .createHash("sha256")
    .update(
      JSON.stringify([
        b.action,
        b.reason,
        b.campaignId,
        b.name,
        b.type,
        b.revision,
      ]),
    )
    .digest("hex");
  return tx(async (c: any) => {
    const row = (
      await c.query(
        "SELECT * FROM campaign_source_reviews WHERE id=:p1 FOR UPDATE",
        [id],
      )
    ).rows[0];
    if (!row) fail(404, "source_missing");
    if (row.config.requestId === b.requestId) {
      if (
        row.config.fingerprint !== fingerprint ||
        row.config.actor !== employee.id
      )
        fail(409, "source_conflict");
      return row.config.result;
    }
    if (Number(row.revision) !== b.revision || row.status !== "pending")
      fail(409, "source_conflict");
    const leads = (
      await c.query("SELECT id,profile FROM portal_leads FOR UPDATE")
    ).rows.filter(
      (r: any) =>
        sourceKey(
          String(r.profile.campaignId || r.profile.campaign || "").trim(),
        ) === id,
    );
    if (!leads.length) fail(409, "source_no_leads");
    if (leads.some((r: any) => !allowed(employee, r.profile)))
      fail(403, "source_forbidden");
    let campaignId: string | null = null;
    if (b.action === "link") {
      const target = (
        await c.query(
          "SELECT id FROM trial_campaigns WHERE id=:p1 FOR UPDATE",
          [String(b.campaignId || "")],
        )
      ).rows[0];
      if (!target) fail(400, "source_target_missing");
      campaignId = target.id;
    }
    if (b.action === "create") {
      if (
        typeof b.name !== "string" ||
        !b.name.trim() ||
        b.name.length > 200 ||
        ![
          "campus_seminar",
          "enterprise_roadshow",
          "webinar_class",
          "education_fair",
          "other",
        ].includes(b.type)
      )
        fail(400, "source_invalid_campaign");
      campaignId = crypto.randomUUID();
      const at = new Date().toISOString();
      const record = {
        id: campaignId,
        code: "verified-" + campaignId,
        name: b.name.trim(),
        nameEn: b.name.trim(),
        nameId: b.name.trim(),
        type: b.type,
        status: "planning",
        createdAt: at,
        updatedAt: at,
        boundUtm: {},
        organizer: "",
        startDate: "",
        endDate: "",
        startTime: "",
        endTime: "",
        city: "",
        venue: "",
        address: "",
        stats: { impressions: 0, budgetCost: 0 },
        targetAudience: [],
        keyTopics: [],
        speakers: [],
        aiAssets: {
          posterHeading: "",
          posterSubheading: "",
          socialCopy: "",
          whatsappInvitation: "",
          chatWelcomeGreeting: "",
          presentationOutline: "",
          deskTentBullets: [],
        },
      };
      await c.query(
        "INSERT INTO trial_campaigns(id,code,config) VALUES(:p1,:p2,:p3)",
        [campaignId, record.code, record],
      );
    }
    const status = b.action === "invalid" ? "invalid" : "linked";
    for (const l of leads) {
      l.profile.campaignSourceStatus = status;
      if (campaignId) l.profile.attributionCampaignId = campaignId;
      else delete l.profile.attributionCampaignId;
      await c.query("UPDATE portal_leads SET profile=:p2 WHERE id=:p1", [
        l.id,
        l.profile,
      ]);
    }
    const result = {
      status,
      campaignId,
      affectedLeads: leads.length,
      revision: Number(row.revision) + 1,
    };
    await c.query(
      "UPDATE campaign_source_reviews SET status=:p2,campaign_id=:p3,revision=revision+1,config=:p4,updated_at=UTC_TIMESTAMP(6) WHERE id=:p1",
      [
        id,
        status,
        campaignId,
        {
          ...row.config,
          actor: employee.id,
          reason: b.reason.trim(),
          requestId: b.requestId,
          fingerprint,
          result,
        },
      ],
    );
    await c.query(
      "INSERT INTO portal_audit(actor,action,data) VALUES(:p1,'campaign.source.review',:p2)",
      [
        employee.id,
        {
          sourceId: id,
          rawCode: row.raw_code,
          before: "pending",
          after: status,
          campaignId,
          reason: b.reason.trim(),
          leadIds: leads.map((l: any) => l.id),
          requestId: b.requestId,
        },
      ],
    );
    return result;
  });
}

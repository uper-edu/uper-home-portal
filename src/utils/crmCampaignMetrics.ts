import type {CrmCampaignRecord} from '../types/crmCampaign';
import {promotionKindForMedium, type PromotionKind} from './promotionNavigation';
import {hasConfirmedEnrollment} from './crmEnrollment';
import { matchesCampaign } from "./crmCampaignLink.ts";
export function campaignMetrics(leads: any[], campaign: any) {
  const unique = [
    ...new Map(leads.map((l, i) => [l.id || `record-${i}`, l])).values(),
  ];
  const origins=(lead:any)=>[lead,...(lead.identitySources||[])];
  const registered = unique.filter((l) => !l.identityReview?.pending && l.identityLifecycle!=='pending' && origins(l).some(p=>matchesCampaign(p,campaign)));
  const assessed = registered.filter(
    (l) =>
      origins(l).some(p=>matchesCampaign(p,campaign)&&p.assessmentProvenance === "server_recomputed_adapted_paper" && (p.latestAssessment||p.assessed)),
  );
  const enrolled = registered.filter(
    (l) =>
      matchesCampaign(l,campaign)&&hasConfirmedEnrollment(l),
  );
  const attendance = unique
    .map((l) =>
      (l.attendanceRecords || []).find(
        (a: any) =>
          a.campaignId === campaign.id &&
          a.confirmed === true &&
          ["onsite", "online"].includes(a.mode) &&
          a.actor &&
          Date.parse(a.recordedAt) > 0,
      ),
    )
    .filter(Boolean);
  const revenueKnown = enrolled.filter(
    (l) =>
      typeof l.revenue === "number" &&
      Number.isFinite(l.revenue) &&
      l.revenue >= 0,
  );
  const verified=registered.flatMap(l=>(l.verifiedPayments?.sources||[]).filter((s:any)=>origins(l).some((p:any)=>p.id===s.sourceLeadId&&matchesCampaign(p,campaign))));
  return {
    registrationRecordsCount: unique.reduce((n,l)=>n+origins(l).filter(p=>matchesCampaign(p,campaign)).length,0),
    pendingIdentityCount: unique.filter(l=>(l.identityReview?.pending||l.identityLifecycle==='pending')&&matchesCampaign(l,campaign)).length,
    leadsCount: registered.length,
    hotLeadsCount: registered.filter((l) => l.tier === "Hot").length,
    assessedCount: assessed.length,
    enrolledCount: enrolled.length,
    confirmedAttendanceCount: attendance.length,
    onsiteAttendanceCount: attendance.filter((a) => a.mode === "onsite").length,
    onlineAttendanceCount: attendance.filter((a) => a.mode === "online").length,
    verifiedReceived: verified.reduce((n,s)=>n+s.received,0),
    verifiedRefunded: verified.reduce((n,s)=>n+s.refunded,0),
    verifiedNet: verified.reduce((n,s)=>n+s.net,0),
    totalRevenue: revenueKnown.reduce((n, l) => n + l.revenue, 0),
    revenueMissingCount: enrolled.length - revenueKnown.length,
    conversionRate: registered.length
      ? Number(((enrolled.length * 100) / registered.length).toFixed(1))
      : null,
    assessmentRate: registered.length
      ? Number(((assessed.length * 100) / registered.length).toFixed(1))
      : null,
    attribution: "first_touch" as const,
  };
}

export type PromotionResultRow = {
  key: string;
  name?: string;
  source?: string;
  medium?: string;
  kind?: PromotionKind;
  customers: number;
  enrolled: number;
  received: number;
  refunded: number;
  net: number;
};

export function promotionResultKey(lead: any, campaign: CrmCampaignRecord): string {
  const reviewed = lead.promotionReview;
  const p = reviewed?.status === 'linked' && reviewed.campaignId === campaign.id
    ? reviewed.linkId : lead.promotionLinkStatus === 'verified' ? lead.promotionLinkId : undefined;
  if (p && campaign.promotionLinks?.some(link => link.id === p)) return p;
  if (lead.promotionLinkStatus === 'unverified' || lead.rawPromotionLinkId || p) return ':unverified';
  return campaign.code === 'organic' ? ':untagged' : ':campaign';
}

export function promotionResultOrigins(lead: any, campaign: CrmCampaignRecord) {
  return [lead, ...(lead.identitySources ?? [])].filter(origin =>
    matchesCampaign(origin, campaign) ||
    (campaign.code === 'organic' && origin.campaignId === 'organic'
      && origin.campaignSourceStatus === 'pending' && origin.promotionLinkStatus === 'unverified'
      && !origin.rawCampaignCode));
}

export function campaignPromotionResults(leads: any[], campaign: CrmCampaignRecord) {
  const rows = new Map<string, PromotionResultRow>();
  function row(key: string) {
    const existing = rows.get(key);
    if (existing) return existing;
    const link = campaign.promotionLinks?.find(item => item.id === key);
    const created: PromotionResultRow = {
      key, name:link?.name, source:link?.source, medium:link?.medium,
      kind:link ? link.promotionKind ?? promotionKindForMedium(link.medium) : undefined,
      customers:0, enrolled:0, received:0, refunded:0, net:0,
    };
    rows.set(key, created);
    return created;
  }
  for (const link of campaign.promotionLinks ?? []) row(link.id);
  const seen = new Set<string>();
  for (const lead of leads) {
    if (seen.has(lead.id) || lead.identityReview?.pending || lead.identityLifecycle === 'pending') continue;
    seen.add(lead.id);
    const matching = promotionResultOrigins(lead, campaign);
    if (!matching.length) continue;
    const source = row(promotionResultKey(matching[0], campaign));
    source.customers++;
    if (matching[0] === lead && hasConfirmedEnrollment(lead)) source.enrolled++;
    for (const payment of lead.verifiedPayments?.sources ?? []) {
      const original = matching.find(origin => origin.id === payment.sourceLeadId);
      if (!original) continue;
      const bucket = row(promotionResultKey(original, campaign));
      bucket.received += payment.received;
      bucket.refunded += payment.refunded;
      bucket.net += payment.net;
    }
  }
  return [...rows.values()];
}

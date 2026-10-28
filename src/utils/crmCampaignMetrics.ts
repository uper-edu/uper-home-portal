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

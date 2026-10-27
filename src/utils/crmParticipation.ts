/** Event categories where staff may optionally record participation. Location is not evidence of attendance. */
export function supportsParticipationRecord(campaign: {
  type?: string;
  systemManaged?: boolean;
}) {
  return (
    campaign.systemManaged !== true &&
    [
      "campus_seminar",
      "enterprise_roadshow",
      "webinar_class",
      "education_fair",
    ].includes(campaign.type || "")
  );
}

/** Resolve only the customer's saved source, never the first available event. */
export function linkedParticipationCampaign(
  lead: { campaignId?: string },
  campaigns: any[],
) {
  if (!lead.campaignId) return null;
  const byId = campaigns.filter((campaign) => campaign.id === lead.campaignId);
  if (byId.length === 1) return byId[0];
  const byCode = campaigns.filter(
    (campaign) => campaign.code === lead.campaignId,
  );
  return byCode.length === 1 ? byCode[0] : null;
}

export function attendanceInput(body: any) {
  const bad = (message: string): never => {
    throw Object.assign(Error(message), { status: 400 });
  };
  if (!body || typeof body !== "object" || Array.isArray(body))
    bad("Attendance request ID required");
  if (
    typeof body.requestId !== "string" ||
    !body.requestId.trim() ||
    body.requestId.length > 100
  )
    bad("Attendance request ID required");
  if (typeof body.campaignId !== "string" || !body.campaignId.trim())
    bad("Choose a valid campaign");
  if (
    typeof body.confirmed !== "boolean" ||
    !["onsite", "online"].includes(body.mode)
  )
    bad("Choose participation mode");
  if (
    body.reason != null &&
    (typeof body.reason !== "string" || body.reason.length > 2000)
  )
    bad("Invalid participation reason");
  return {
    campaignId: body.campaignId,
    confirmed: body.confirmed,
    mode: body.mode,
    reason: body.reason?.trim() || "",
  };
}

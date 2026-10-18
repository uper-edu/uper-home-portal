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

/** Marketing attribution is first-touch metadata, never an identity or permission grant. */
export function firstTouchAttribution(
  existing: Record<string, any>,
  input: Record<string, any>,
) {
  const result: Record<string, string> = {};
  for (const key of [
    "campaign",
    "campaignId",
    "placement",
    "hookType",
    "hookContext",
  ]) {
    const value = existing[key] || input[key];
    if (typeof value === "string" && value.trim())
      result[key] = value.trim().slice(0, key === "campaign" ? 200 : 100);
  }
  return result;
}

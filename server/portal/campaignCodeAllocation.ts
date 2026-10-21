import { campaignCodeBase } from "../../src/utils/campaignCode.ts";

/** Caller inserts inside this same transaction; the shared lock covers every creation entry. */
export async function allocateCampaignCode(
  db: any,
  type: string,
  medium: string,
  at: Date,
) {
  const base = campaignCodeBase(type, medium, at);
  await db.query("SELECT GET_LOCK(:p1,5) AS acquired", ["trial-campaigns"]);
  const rows = (
    await db.query(
      "SELECT id,code FROM trial_campaigns WHERE LOWER(code)=:p1 OR LOWER(code) LIKE :p2 OR LOWER(id)=:p1 OR LOWER(id) LIKE :p2 FOR UPDATE",
      [base, base + "-%"],
    )
  ).rows;
  const used = new Set(
    rows.flatMap((r: any) => [
      String(r.id).toLowerCase(),
      String(r.code).toLowerCase(),
    ]),
  );
  const aliases = (await db.query(
    "SELECT raw_code FROM campaign_source_reviews WHERE status='linked' AND (LOWER(raw_code)=:p1 OR LOWER(raw_code) LIKE :p2)",
    [base, base + "-%"],
  )).rows;
  for (const alias of aliases) used.add(alias.raw_code.toLowerCase());
  for (let n = 1; n <= 10000; n++) {
    const candidate = n === 1 ? base : base + "-" + n;
    if (!used.has(candidate)) return candidate;
  }
  throw Object.assign(Error("campaign_code_retry"), { status: 503 });
}

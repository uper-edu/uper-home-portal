export const CAMPAIGN_BUDGET_ERROR = "campaign_budget_invalid";

export function validCampaignBudget(value: unknown): value is number | null {
  return value === null || typeof value === "number" && Number.isFinite(value) && value >= 0;
}

// Null means not recorded; undefined means invalid. Zero is an explicit budget.
export function campaignBudgetFromInput(value: string): number | null | undefined {
  if (!value.trim()) return null;
  const amount = Number(value);
  return validCampaignBudget(amount) ? amount : undefined;
}

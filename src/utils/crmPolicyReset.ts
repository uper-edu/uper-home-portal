import { DEFAULT_CRM_POLICY_CONFIG, type CrmPolicyConfig } from "../types/crmPolicyConfig";
import { PolicySaveError, policySaveResponseError } from "./crmPolicyValidation";

function matchesDefaults(current: any, expected: any): boolean {
  if (Array.isArray(expected)) return Array.isArray(current) && current.length === expected.length && expected.every((v, i) => matchesDefaults(current[i], v));
  if (expected && typeof expected === "object") return Boolean(current) && Object.keys(expected).every(key => matchesDefaults(current[key], expected[key]));
  return current === expected;
}

/** One save attempt, then authoritative read-back, including a lost save response.
 * Restoration uses the existing validated policy endpoint; it never retries a write. */
export async function restorePolicyDefaults(request: typeof fetch = fetch): Promise<CrmPolicyConfig> {
  try {
    const response = await request("/api/crm/policy-config", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(DEFAULT_CRM_POLICY_CONFIG), signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw policySaveResponseError(response.status, await response.json().catch(() => null));
  } catch (error) {
    if (error instanceof PolicySaveError) throw error;
    // Network failure is not proof that the server rejected the save.
  }
  let saved: CrmPolicyConfig;
  try {
    const response = await request("/api/crm/policy-config", { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw Error("Read-back unavailable");
    saved = await response.json();
  } catch {
    throw new PolicySaveError("policy_reset_unknown");
  }
  const { version: _version, updatedAt: _updatedAt, ...defaults } = DEFAULT_CRM_POLICY_CONFIG;
  if (!matchesDefaults(saved, defaults)) throw new PolicySaveError("policy_reset_not_applied");
  return saved;
}

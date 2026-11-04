import {isWebsitePromotion, promotionEntryPoint, promotionIdentity, type PublicPromotion} from './promotionNavigation';
import { salesProgressStages } from "./crmSalesProgress";
import { normalizeSiteLanguage, resolveMetadata } from "./siteMetadata";

export type AnalyticsParams = Record<
  string,
  string | number | boolean | undefined
>;
export type AnalyticsInput = {
  href: string;
  referrer?: string;
  mode?: string;
  language?: string;
  buildId?: string;
  internalTest?: boolean;
  promotion?: PublicPromotion;
  promotionState?: 'unverified' | 'unavailable';
};
const privateRoots = new Set(["crm", "cms", "system", "studio"]);
const crmTabs = new Set(["leads", "campaigns", "policy", "docs"]);
const knownPaths = new Set([
  "/",
  "/link",
  "/chat",
  "/consult",
  "/about",
  "/faq",
  "/hsk",
  "/csca",
  "/careers",
  "/contact",
  "/partners",
  "/tours",
  "/study-abroad",
  "/consultancy",
  "/news",
  "/crm",
  "/cms",
  "/system",
  "/studio",
  "/style-guide",
]);
const code = (value: string | null) =>
  value && /^[a-zA-Z][a-zA-Z0-9_.-]{0,79}$/.test(value) ? value : undefined;
export function analyticsContext(input: AnalyticsInput): AnalyticsParams {
  const url = new URL(input.href),
    root = url.pathname.split("/")[1].toLowerCase();
  const local =
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
    url.hostname.endsWith(".localhost");
  const environment =
    local || input.mode === "dev"
      ? "development"
      : input.mode === "test" || url.hostname.endsWith(".prototype.uperedu.com")
        ? "test"
        : input.mode === "prod"
          ? "production"
          : "unknown";
  const workspace = privateRoots.has(root) ? root : "public";
  const traffic =
    environment !== "production" || input.internalTest
      ? "internal_test"
      : workspace !== "public"
        ? "internal_employee"
        : "customer";
  const language = normalizeSiteLanguage(
    url.searchParams.get("lang") || (workspace === "public" ? input.promotion?.language : undefined) || input.language,
  );
  let path = knownPaths.has(url.pathname)
    ? url.pathname
    : /^\/(news|campaign)\/[^/]+$/.test(url.pathname)
      ? "/" + root + "/:item"
      : "/other";
  const tab =
    root === "crm" && crmTabs.has(url.searchParams.get("tab") || "")
      ? url.searchParams.get("tab")!
      : undefined;
  if (tab) path += "?tab=" + tab;
  let referrer = "";
  try {
    const ref = new URL(input.referrer || "");
    if (["https:", "http:"].includes(ref.protocol)) referrer = ref.origin + "/";
  } catch {}
  const identity = promotionIdentity(url.searchParams);
  const publicPage = workspace === "public";
  const verified = publicPage ? input.promotion : undefined;
  const unresolved = publicPage && !verified && (identity.invalid || url.searchParams.has("p"));
  const entry = publicPage ? promotionEntryPoint(url.searchParams.get("entry_point")) : undefined;
  const external = verified && !isWebsitePromotion(verified.id) ? verified : undefined;
  const campaign = verified ? code(external?.campaignCode ?? null)
    : publicPage && !unresolved ? code(identity.campaign || url.searchParams.get("utm_campaign")) : undefined;
  const source = verified ? code(external?.source ?? null)
    : publicPage && !unresolved ? code(url.searchParams.get("utm_source")) : undefined;
  const medium = verified ? code(external?.medium ?? null)
    : publicPage && !unresolved ? code(url.searchParams.get("utm_medium")) : undefined;
  const term = publicPage && !unresolved && !verified ? code(url.searchParams.get("utm_term")) : undefined;
  const manualCampaignId = publicPage && !unresolved && !verified ? code(url.searchParams.get("utm_id")) : undefined;
  const content = publicPage && !unresolved
    ? code(verified ? external?.content ?? null : url.searchParams.get("utm_content")) : undefined;
  return {
    page_location: url.origin + path,
    page_referrer: referrer,
    page_title: resolveMetadata(
      knownPaths.has(url.pathname) ? url.pathname : "/",
      language,
      { module: tab },
    ).title,
    page_path: path,
    language,
    environment,
    workspace,
    traffic_category: traffic,
    traffic_type:
      traffic === "internal_test"
        ? "internal"
        : traffic === "internal_employee"
          ? "staff"
          : "external",
    ...(environment !== "production" ? { debug_mode: true } : {}),
    ...(input.buildId ? { app_version: input.buildId.slice(0, 64) } : {}),
    ...(campaign ? { campaign_name: campaign } : {}),
    ...(external || campaign || manualCampaignId ? { campaign_id: code(external?.campaignId ?? null) ?? manualCampaignId ?? campaign } : {}),
    ...(source ? { campaign_source: source } : {}),
    ...(medium ? { campaign_medium: medium } : {}),
    ...(content ? {campaign_content: content} : {}),
    ...(term ? {campaign_term: term} : {}),
    ...(verified ? {promotion_link_id: verified.id, promotion_kind: verified.promotionKind} : {}),
    ...(entry || url.pathname === "/chat" || url.pathname === "/consult" ? {entry_point: entry ?? "direct"} : {}),
    source_basis: verified ? "verified_promotion" : unresolved ? (input.promotionState ?? "unverified")
      : campaign || source || medium
        ? "campaign_parameter"
        : "untagged",
    event_contract_version: "v1",
  };
}

export const ANALYTICS_EVENTS = new Set([
  "page_view",
  "change_language",
  "faq_expand",
  "chatbot_interaction",
  "consultation_click",
  "form_submission",
  "external_link_click",
  "link_click",
  "questionnaire_view",
  "questionnaire_start",
  "questionnaire_step_view",
  "questionnaire_step_next",
  "questionnaire_validation_error",
  "questionnaire_submit",
  "questionnaire_complete",
  "lead_form_complete",
  "consultation_message_saved",
  "questionnaire_save_result",
  "assessment_start",
  "assessment_resume",
  "assessment_section_view",
  "assessment_submit",
  "assessment_complete",
  "assessment_save_result",
  "assessment_exit",
  "consultation_send",
  "consultation_result",
  "advisor_request",
  "crm_customer_view",
  "crm_filter_change",
  "crm_progress_open",
  "crm_progress_saved",
  "crm_save_result",
  "crm_form_cancel_click",
  "crm_stage_updated",
  "course_enrollment_confirmed",
  "crm_owner_changed",
  "crm_profile_saved",
  "crm_action_open",
  "analytics_probe",
]);
const numeric = new Set([
  "step",
  "duration_ms",
  "response_time_ms",
  "active_filter_count",
  "message_length",
]);
const boolean = new Set(["has_search", "has_draft"]);
const choices: Record<string, string[]> = {
  profile_scope: ["basic", "needs"],
  status: [
    "attempt",
    "saved",
    "failed",
    "unknown",
    "conflict",
    "not_found",
    "success",
    "validation_error",
    "api_error",
    "network_error",
    "exception",
  ],
  operation: [
    "progress",
    "stage",
    "owner",
    "registration",
    "assessment",
    "profile",
  ],
  form_name: [
    "questionnaire",
    "chatbot_lead_form",
    "contact_inquiry_form",
    "career_apply_form",
  ],
  entry_point: [
    "standalone_chat",
    "homepage_widget",
    "website",
    "linkhub",
    "list",
    "direct",
    "detail",
  ],
  asset_id: ["handbook_2026"],
  handbook_action: ["preview", "view", "download_click", "share"],
  assessment_mode: ["full", "express"],
  section: ["listening", "reading", "writing", "review"],
  validation_mode: ["simulated", "live"],
  target: [
    "hub",
    "consultation",
    "handbook",
    "community",
    "whatsapp",
    "tiktok",
    "youtube",
    "home",
    "share",
  ],
  tab: [
    "activities",
    "profile",
    "assessment",
    "panorama",
    "leads",
    "campaigns",
    "policy",
    "docs",
  ],
  action: [
    "open",
    "close",
    "send_message",
    "click_shortcut",
    "clear_chat",
    "handoff",
    "booking",
    "enrollment",
    "prepare_contact",
    "progress",
    "stage",
    "owner",
  ],
  reason: [
    "required",
    "format",
    "validation",
    "cancel",
    "paused",
    "skipped",
    "provider_failure",
    "transport",
    "save_unconfirmed",
    "response_mismatch",
  ],
  filter_type: ["search", "owner", "stage", "multiple", "other"],
  role: ["sales", "manager", "admin", "staff"],
  method: ["questionnaire", "form", "explicit_request", "staff_confirmed"],
  contact_channel: [
    "whatsapp",
    "wechat",
    "email",
    "phone",
    "floating_widget",
    "form",
  ],
  faq_type: ["hsk", "csca", "general"],
  language: ["zh", "en", "id"],
  stage_from: [...salesProgressStages.map((row) => row[0]), "legacy"],
  stage_to: [...salesProgressStages.map((row) => row[0]), "legacy"],
};
export function safeAnalyticsParams(
  values: Record<string, unknown> = {},
): AnalyticsParams {
  const output: AnalyticsParams = {};
  for (const [key, value] of Object.entries(values)) {
    if (numeric.has(key) && typeof value === "number" && Number.isFinite(value))
      output[key] = Math.max(0, Math.min(86400000, Math.round(value)));
    else if (boolean.has(key) && typeof value === "boolean")
      output[key] = value;
    else if (choices[key]?.includes(String(value))) output[key] = String(value);
    else if (
      key === "question_id" &&
      typeof value === "string" &&
      /^[a-z0-9_-]{1,35}$/i.test(value)
    )
      output[key] = value;
  }
  return output;
}

export function createAnalyticsClient(options: {
  id: string;
  context: () => AnalyticsParams;
  send: (...args: any[]) => void;
  storage?: Pick<Storage, "getItem" | "setItem">;
}) {
  let lastPage = "",
    previousLocation = "";
  const receipts = new Set<string>();
  try {
    const old = JSON.parse(
      options.storage?.getItem("uper_analytics_receipts_v1") || "[]",
    );
    if (Array.isArray(old))
      old
        .slice(-300)
        .filter((x) => typeof x === "string")
        .forEach((x) => receipts.add(x));
  } catch {}
  const attribution = (context: AnalyticsParams) => ({
    campaign_source: context.campaign_source || null,
    campaign_medium: context.campaign_medium || null,
    campaign_name: context.campaign_name || null,
    campaign_id: context.campaign_id || null,
    campaign_content: context.campaign_content || null,
    campaign_term: context.campaign_term || null,
    promotion_link_id: context.promotion_link_id || null,
    promotion_kind: context.promotion_kind || null,
    entry_point: context.entry_point || null,
  });
  const track = (event: string, params: Record<string, unknown> = {}) => {
    try {
      if (!options.id || !ANALYTICS_EVENTS.has(event)) return false;
      const context = options.context();
      options.send("event", event, {
        ...context,
        ...attribution(context),
        ...safeAnalyticsParams(params),
        send_to: options.id,
      });
      return true;
    } catch {
      return false;
    }
  };
  return {
    track,
    page() {
      try {
        const context = options.context(),
          key = [context.page_location, context.language, context.promotion_link_id, context.campaign_name, context.campaign_source, context.campaign_medium, context.campaign_content, context.entry_point].join("|");
        if (key === lastPage) return false;
        // Clear prior route source overrides; untagged pages leave attribution to GA's session rules.
        const page = {
          ...context,
          page_referrer: previousLocation || context.page_referrer,
        };
        options.send("set", {
          ...page,
          ...attribution(context),
        });
        if (!options.id) return false;
        options.send("event", "page_view", { ...page, ...attribution(context), send_to: options.id });
        lastPage = key;
        previousLocation = String(context.page_location);
        return true;
      } catch {
        return false;
      }
    },
    confirmed(
      event: string,
      key: string,
      confirmed: boolean,
      params: Record<string, unknown> = {},
    ) {
      try {
        if (!confirmed || !key || !ANALYTICS_EVENTS.has(event)) return false;
        const receipt = event + ":" + key;
        if (receipts.has(receipt)) return false;
        if (!track(event, { ...params, status: "saved" })) return false;
        receipts.add(receipt);
        try {
          options.storage?.setItem(
            "uper_analytics_receipts_v1",
            JSON.stringify([...receipts].slice(-300)),
          );
        } catch {}
        return true;
      } catch {
        return false;
      }
    },
  };
}

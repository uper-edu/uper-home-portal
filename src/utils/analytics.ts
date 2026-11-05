import {lookupPromotion} from './promotionLookup';
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import {
  analyticsDestinationAllowed,
  analyticsInternalTest,
  type AnalyticsConfiguration,
} from "./analyticsEnvironment";
import {
  analyticsContext,
  createAnalyticsClient,
  type AnalyticsParams,
} from "./analyticsPolicy";

declare global {
  interface Window {
    dataLayer: any[];
    gtag: (...args: any[]) => void;
  }
}
declare const __UPER_BUILD__: { environment: string; buildId: string } | null;
declare const __UPER_ANALYTICS__: AnalyticsConfiguration | null;
const build = typeof __UPER_BUILD__ === "undefined" ? null : __UPER_BUILD__;
const configuration =
  typeof __UPER_ANALYTICS__ === "undefined" ? null : __UPER_ANALYTICS__;
export const GA_MEASUREMENT_ID =
  (import.meta as any).env?.VITE_UPER_MEASUREMENT_ID || "";
let client: ReturnType<typeof createAnalyticsClient> | undefined;
let actorRole: string | undefined;
export function setAnalyticsRole(role?: string) {
  actorRole = ["sales", "manager", "admin", "staff"].includes(role || "")
    ? role
    : undefined;
}
const context = (): AnalyticsParams => {
  let storage: Storage | undefined;
  try {
    storage = window.sessionStorage;
  } catch {}
  const route = new URL(window.location.href);
  const lookup = /^\/(crm|cms|system|studio)(?:\/|$)/i.test(route.pathname) ? undefined : lookupPromotion(route.searchParams);
  const resolved = lookup instanceof Promise ? undefined : lookup;
  const value = analyticsContext({
    href: window.location.href,
    referrer: document.referrer,
    mode: build?.environment || (import.meta as any).env?.MODE,
    language: document.documentElement.lang,
    buildId: build?.buildId,
    internalTest: analyticsInternalTest(window.location.href, storage),
    promotion: resolved?.state === 'verified' ? resolved.promotion : undefined,
    promotionState: resolved && resolved.state !== 'verified' ? resolved.state : undefined,
  });
  return {
    ...value,
    ...(value.workspace !== "public" && actorRole ? { role: actorRole } : {}),
  };
};
function initGA() {
  if (!GA_MEASUREMENT_ID || typeof window === "undefined" || client) return;
  if (
    !analyticsDestinationAllowed(
      configuration,
      GA_MEASUREMENT_ID,
      window.location.href,
      build?.environment || (import.meta as any).env?.MODE,
    )
  )
    return;
  try {
    window.dataLayer = window.dataLayer || [];
    window.gtag =
      window.gtag ||
      function () {
        window.dataLayer.push(arguments);
      };
    const current = context();
    window.gtag("js", new Date());
    window.gtag("config", GA_MEASUREMENT_ID, {
      ...current,
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      ...(current.environment !== "production"
        ? { cookie_prefix: "uper_test" }
        : {}),
    });
    let storage: Storage | undefined;
    try {
      storage = window.sessionStorage;
    } catch {}
    client = createAnalyticsClient({
      id: GA_MEASUREMENT_ID,
      context,
      send: (...args) => window.gtag(...args),
      storage,
    });
    if (!document.getElementById("google-tag-manager")) {
      const script = document.createElement("script");
      script.id = "google-tag-manager";
      script.async = true;
      script.src =
        "https://www.googletagmanager.com/gtag/js?id=" +
        encodeURIComponent(GA_MEASUREMENT_ID);
      document.head.appendChild(script);
    }
  } catch {
    /* Analytics must never block business flows. */
  }
}
function withAnalytics(send: (current: NonNullable<typeof client>) => boolean) {
  try {
    const href = window.location.href;
    if (!GA_MEASUREMENT_ID || !analyticsDestinationAllowed(
      configuration, GA_MEASUREMENT_ID, href, build?.environment || (import.meta as any).env?.MODE,
    )) return false;
    const route = new URL(href);
    const publicPage = !/^\/(crm|cms|system|studio)(?:\/|$)/i.test(route.pathname);
    const lookup = publicPage ? lookupPromotion(route.searchParams) : undefined;
    const sendCurrent = () => {
      if (window.location.href !== href) return false;
      initGA();
      return client ? send(client) : false;
    };
    if (lookup instanceof Promise) {
      void lookup.then(sendCurrent).catch(() => {});
      return true;
    }
    return sendCurrent();
  } catch {
    return false;
  }
}
export const trackEvent = (event: string, params: Record<string, unknown> = {}) =>
  withAnalytics(current => current.track(event, params));
export const trackReceipt = (event: string, key: string, params: Record<string, unknown> = {}, confirmed = true) =>
  withAnalytics(current => current.confirmed(event, key, confirmed, params));
export const trackPageView = (_path?: string, _title?: string) =>
  withAnalytics(current => current.page());
export function usePageTracking() {
  const location = useLocation();
  useEffect(() => {
    trackPageView();
  }, [location]);
}
export const trackLanguageSwitch = (language: string) =>
  trackEvent("change_language", { language });
export const trackFAQExpand = (
  faq_type: "hsk" | "csca" | "general",
  question_id: string,
  _text: string,
) => trackEvent("faq_expand", { faq_type, question_id });
export const trackChatbotInteraction = (
  action: "open" | "close" | "send_message" | "click_shortcut" | "clear_chat",
  details?: Record<string, unknown>,
) => trackEvent("chatbot_interaction", { action, ...details });
export const trackConsultationClick = (
  contact_channel: string,
  _label: string,
) => trackEvent("consultation_click", { contact_channel });
export const trackFormSubmit = (
  form_name: string,
  success: boolean,
  _details?: Record<string, unknown>,
) =>
  trackEvent("form_submission", {
    form_name,
    status: success ? "saved" : "failed",
  });
export const trackExternalLinkClick = (_url: string, _label: string) =>
  trackEvent("external_link_click");

export function trackConfirmedReceipt(
  receipt: import("./analyticsReceipts").AnalyticsReceipt | null,
) {
  return receipt
    ? trackReceipt(receipt.event, receipt.key, receipt.params)
    : false;
}

export function trackStageReceipt(key: string, from: string, to: string) {
  trackReceipt("crm_stage_updated", key, {
    operation: "stage",
    stage_from: from,
    stage_to: to,
  });
  if (to === "progress:enrolled")
    trackReceipt("course_enrollment_confirmed", key, {
      operation: "stage",
      method: "staff_confirmed",
    });
}

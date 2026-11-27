import {lookupPromotion} from './promotionLookup';
import {learnerPreviewToken} from './enrollmentLearnerPreview';
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
export const GA_MEASUREMENT_ID = configuration?.measurementId ?? "";
let client: ReturnType<typeof createAnalyticsClient> | undefined;
let actorRole: string | undefined;
export function setAnalyticsRole(role?: string) {
  actorRole = ["sales", "manager", "admin", "staff"].includes(role || "")
    ? role
    : undefined;
}
function contextInputs(href:string) {
  let storage: Storage | undefined;
  try {
    storage = window.sessionStorage;
  } catch {}
  return {
    href,
    referrer: document.referrer,
    mode: build?.environment || (import.meta as any).env?.MODE,
    language: document.documentElement.lang,
    buildId: build?.buildId,
    internalTest: analyticsInternalTest(href, storage),
  };
}
function resolvedContext(inputs:ReturnType<typeof contextInputs>,resolved:Awaited<ReturnType<typeof lookupPromotion>>) {
  return analyticsContext({
    ...inputs,
    promotion: resolved?.state === 'verified' ? resolved.promotion : undefined,
    promotionState: resolved && resolved.state !== 'verified' ? resolved.state : undefined,
  });
}
const context = (): AnalyticsParams => {
  const route = new URL(window.location.href);
  const lookup = /^\/(crm|cms|system|studio|finance)(?:\/|$)/i.test(route.pathname) ? undefined : lookupPromotion(route.searchParams);
  const value=resolvedContext(contextInputs(route.href),lookup instanceof Promise?undefined:lookup);
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
function withAnalytics(send: (current: NonNullable<typeof client>, captured?:AnalyticsParams) => boolean, retainLinkOrigin=false) {
  try {
    const href = window.location.href;
    if (!GA_MEASUREMENT_ID || !analyticsDestinationAllowed(
      configuration, GA_MEASUREMENT_ID, href, build?.environment || (import.meta as any).env?.MODE,
    )) return false;
    const route = new URL(href);
    if(/^\/enrollment\/assist\/?$/.test(route.pathname))return false;
    const publicPage = !/^\/(crm|cms|system|studio|finance)(?:\/|$)/i.test(route.pathname);
    const lookup = publicPage ? lookupPromotion(route.searchParams) : undefined;
    const sendCurrent = () => {
      if (window.location.href !== href) return false;
      initGA();
      return client ? send(client) : false;
    };
    if (lookup instanceof Promise) {
      if(retainLinkOrigin){
        // A link click belongs to the page where it happened, even when routing
        // finishes before the promotion lookup.
        const inputs=contextInputs(href);
        void lookup.then(result=>{
          if(window.location.origin!==route.origin)return;
          initGA();
          if(client)send(client,resolvedContext(inputs,result));
        }).catch(()=>{});
      }else void lookup.then(sendCurrent).catch(() => {});
      return true;
    }
    return sendCurrent();
  } catch {
    return false;
  }
}
export const trackEvent = (event: string, params: Record<string, unknown> = {}) =>
  withAnalytics((current,captured) => current.track(event, params, captured),event==='link_click');
export const trackReceipt = (event: string, key: string, params: Record<string, unknown> = {}, confirmed = true) =>
  withAnalytics(current => current.confirmed(event, key, confirmed, params));
export function trackEnrollmentStep(...step:
  | [event:'enrollment_class_view'|'enrollment_application_start']
  | [event:'enrollment_seat_reserved'|'enrollment_proof_saved',receiptKey:string]
) {
  if (typeof window==='undefined'||learnerPreviewToken()) return false;
  const [event,receiptKey]=step;
  const href=window.location.href;
  return withAnalytics((current,captured)=>{
    if(receiptKey!==undefined)return current.confirmed(event,receiptKey,true,{},captured);
    if(window.location.href===href)current.page(captured);
    return current.track(event,{},captured);
  },true);
}
export const trackPageView = (_path?: string, _title?: string) =>
  withAnalytics(current => current.page());
export function usePageTracking(enabled=true) {
  const location = useLocation();
  useEffect(() => {
    if(enabled)trackPageView();
  }, [location,enabled]);
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

import { useEffect } from "react";
import { useLocation } from "react-router-dom";

declare global {
  interface Window {
    dataLayer: any[];
    gtag: (...args: any[]) => void;
  }
}

export const GA_MEASUREMENT_ID = (import.meta as any).env.VITE_UPER_MEASUREMENT_ID || "";

/**
 * Initializes Google Analytics 4 dynamically if the VITE_UPER_MEASUREMENT_ID is provided.
 */
export const initGA = () => {
  if (!GA_MEASUREMENT_ID || typeof window === "undefined") {
    return;
  }

  // Check if already loaded
  if (document.getElementById("google-tag-manager")) {
    return;
  }

  // Create Google Tag Manager script element
  const script = document.createElement("script");
  script.id = "google-tag-manager";
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(script);

  // Initialize dataLayer and the gtag function
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer.push(arguments);
  };

  window.gtag("js", new Date());
  window.gtag("config", GA_MEASUREMENT_ID, {
    send_page_view: false, // Track manually on SPA route changes for accuracy
  });
  
  console.log(`[GA4] Google Analytics initialized with ID: ${GA_MEASUREMENT_ID}`);
};

/**
 * React hook to automatically initialize GA4 and track page navigation changes.
 */
export const usePageTracking = () => {
  const location = useLocation();

  useEffect(() => {
    initGA();
  }, []);

  useEffect(() => {
    trackPageView(location.pathname + location.search);
  }, [location]);
};

/**
 * Tracks a custom event in Google Analytics.
 */
export const trackEvent = (eventName: string, eventParams?: Record<string, any>) => {
  if (typeof window !== "undefined" && window.gtag && GA_MEASUREMENT_ID) {
    window.gtag("event", eventName, eventParams);
  } else {
    // Log in development or when GA is not configured
    console.debug(`[Analytics Event] ${eventName}:`, eventParams);
  }
};

/**
 * Tracks a page view in a single page application context.
 */
export const trackPageView = (path: string, title?: string) => {
  if (typeof window !== "undefined" && window.gtag && GA_MEASUREMENT_ID) {
    window.gtag("config", GA_MEASUREMENT_ID, {
      page_path: path,
      page_title: title || document.title,
    });
    console.log(`[GA4 PageView] Path: ${path}, Title: ${title || document.title}`);
  }
};

/**
 * Tracks language switcher actions (ID, EN, ZH).
 */
export const trackLanguageSwitch = (lang: string) => {
  trackEvent("change_language", {
    language: lang,
  });
};

/**
 * Tracks when a user expands a specific FAQ question.
 */
export const trackFAQExpand = (faqType: "hsk" | "csca" | "general", qId: string, questionText: string) => {
  trackEvent("faq_expand", {
    faq_type: faqType,
    question_id: qId,
    question_text: questionText,
  });
};

/**
 * Tracks chatbot actions (opening/closing, sending messages, clicking shortcuts).
 */
export const trackChatbotInteraction = (action: "open" | "close" | "send_message" | "click_shortcut" | "clear_chat", details?: Record<string, any>) => {
  trackEvent("chatbot_interaction", {
    chat_action: action,
    ...details,
  });
};

/**
 * Tracks consultations (WhatsApp, WeChat, Email, Phone clicks).
 */
export const trackConsultationClick = (channel: "whatsapp" | "wechat" | "email" | "phone" | "floating_widget" | "form", label: string) => {
  trackEvent("consultation_click", {
    contact_channel: channel,
    button_label: label,
  });
};

/**
 * Tracks form submissions.
 */
export const trackFormSubmit = (formName: string, success: boolean, details?: Record<string, any>) => {
  trackEvent("form_submission", {
    form_name: formName,
    status: success ? "success" : "failed",
    ...details,
  });
};

/**
 * Tracks outbound clicks.
 */
export const trackExternalLinkClick = (url: string, label: string) => {
  trackEvent("external_link_click", {
    destination_url: url,
    link_label: label,
  });
};

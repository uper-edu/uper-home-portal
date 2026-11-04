import React from "react";
import { CrmNumberedMarkdownGuide } from "./CrmAnalyticsGuide";
import type { GuideLanguage } from "./CrmGuideContent";
import content from "./promotionAttributionGuide.json";

export const promotionAttributionGuideTitle = content.title;
export const promotionAttributionGuideSections = content.sections;
export const isPromotionAttributionGuideAnchor = (key: string) =>
  promotionAttributionGuideSections.some((section) => section.key === key);

function resolveLink(href: string) {
  return new URL(
    href,
    "https://github.com/uper-edu/uper-home-portal/blob/main/docs/analytics/promotion-attribution-design.md",
  ).href;
}

export function CrmPromotionAttributionGuide({ lang }: { lang: GuideLanguage }) {
  return (
    <CrmNumberedMarkdownGuide
      lang={lang}
      id="crm-promotion-attribution-document"
      number={6}
      title={promotionAttributionGuideTitle}
      sections={promotionAttributionGuideSections}
      resolveLink={resolveLink}
    />
  );
}

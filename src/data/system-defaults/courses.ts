// Initial publication and discount settings for standard HSK courses.
// Course names, lesson counts and IDR prices come from ../crmCoursePrices.json.
// Zero maximum discount means no discount is granted by the initial course settings.
// The initializer preserves prices, discounts and publication status already saved in CRM.

export default {
  // Newly seeded courses are available in the published CRM catalog.
  "active": true,
  // Basis points: 100 means 1%. Zero grants no percentage discount.
  "maxDiscountBps": 0,
  // Optional absolute cap in IDR. Null adds no absolute cap; the percentage limit still applies.
  "maxDiscountAmount": null
};

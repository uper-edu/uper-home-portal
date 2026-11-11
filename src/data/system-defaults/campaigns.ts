// Reserved campaign identities for first installation.
// Existing campaign statistics, ownership and attribution history must be preserved.
// SYSTEM_INITIALIZED_AT is replaced by the initializer at runtime.
// Evergreen promotion links are read from ../evergreenPromotionLinks.json.

export default [
  {
    "id": "organic",
    "code": "organic",
    "name": "自然流量",
    "nameEn": "Non-campaign source",
    "nameId": "Trafik organik",
    "systemManaged": true,
    "type": "other",
    "status": "active",
    "organizer": "",
    "startDate": "",
    "endDate": "",
    "startTime": "",
    "endTime": "",
    "city": "",
    "venue": "",
    "locationType": "online",
    "address": "",
    "targetAudience": [],
    "keyTopics": [],
    "speakers": [],
    "boundUtm": {
      "utm_source": "organic",
      "utm_medium": "website",
      "utm_campaign": "organic",
      "defaultHook": "hsk_assessment",
      "defaultContext": "website",
      "defaultLang": "id"
    },
    "aiAssets": {
      "posterHeading": "",
      "posterSubheading": "",
      "socialCopy": "",
      "whatsappInvitation": "",
      "chatWelcomeGreeting": "",
      "presentationOutline": "",
      "deskTentBullets": []
    },
    "stats": {
      "impressions": 0,
      "budgetCost": 0
    },
    "createdAt": "SYSTEM_INITIALIZED_AT",
    "updatedAt": "SYSTEM_INITIALIZED_AT"
  },
  {
    "id": "social-bio",
    "code": "social-bio",
    "presetKey": "social_bio_v1",
    "name": "日常自然推广",
    "nameEn": "Evergreen unpaid promotion",
    "nameId": "Promosi rutin tanpa biaya",
    "type": "other",
    "status": "active",
    "organizer": "",
    "locationType": "online",
    "startDate": "",
    "endDate": "",
    "startTime": "",
    "endTime": "",
    "city": "",
    "venue": "",
    "address": "",
    "targetAudience": [],
    "keyTopics": [],
    "speakers": [],
    "boundUtm": {
      "utm_source": "",
      "utm_medium": "",
      "utm_campaign": "social-bio",
      "defaultHook": "hsk_assessment",
      "defaultContext": "website",
      "defaultLang": "id"
    },
    "promotionModel": "multiple",
    "aiAssets": {
      "posterHeading": "",
      "posterSubheading": "",
      "socialCopy": "",
      "whatsappInvitation": "",
      "chatWelcomeGreeting": "",
      "presentationOutline": "",
      "deskTentBullets": []
    },
    "stats": {
      "impressions": 0,
      "leadsCount": 0,
      "hotLeadsCount": 0,
      "assessedCount": 0,
      "enrolledCount": 0,
      "totalRevenue": 0,
      "conversionRate": null,
      "budgetCost": null,
      "roi": null
    },
    "createdAt": "SYSTEM_INITIALIZED_AT",
    "updatedAt": "SYSTEM_INITIALIZED_AT",
    "systemManaged": true
  }
];

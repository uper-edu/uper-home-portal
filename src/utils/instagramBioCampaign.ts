import type { CampaignPromotionLink, CrmCampaignRecord } from '../types/crmCampaign';
import { PROMOTION_EXPERIENCE } from './campaignPromotion';

export const INSTAGRAM_BIO_CAMPAIGN = 'instagram-bio';
export const INSTAGRAM_BIO_PRESET = 'instagram_bio_v1';
const languages = ['id', 'en', 'zh'] as const;

export function instagramBioCampaign(at = new Date().toISOString()): CrmCampaignRecord {
  return {
    id: INSTAGRAM_BIO_CAMPAIGN, code: INSTAGRAM_BIO_CAMPAIGN,
    presetKey: INSTAGRAM_BIO_PRESET, name: 'Instagram Bio', nameEn: 'Instagram Bio', nameId: 'Instagram Bio',
    type: 'other', status: 'active', organizer: '', locationType: 'online',
    startDate: '', endDate: '', startTime: '', endTime: '', city: '', venue: '', address: '',
    targetAudience: [], keyTopics: [], speakers: [],
    boundUtm: { utm_source: 'instagram', utm_medium: 'social', utm_campaign: INSTAGRAM_BIO_CAMPAIGN,
      defaultHook: 'hsk_assessment', defaultContext: 'website', defaultLang: 'id' },
    promotionModel: 'multiple',
    promotionLinks: languages.map(language => ({
      id: `p_instagram_bio_${language}`, name: `Instagram Bio · ${language.toUpperCase()}`,
      source: 'instagram', medium: 'social', language, experience: PROMOTION_EXPERIENCE,
      landingPath: '/link', createdAt: at,
    })),
    aiAssets: { posterHeading: '', posterSubheading: '', socialCopy: '', whatsappInvitation: '',
      chatWelcomeGreeting: '', presentationOutline: '', deskTentBullets: [] },
    stats: { impressions: 0, leadsCount: 0, hotLeadsCount: 0, assessedCount: 0, enrolledCount: 0,
      totalRevenue: 0, conversionRate: null, budgetCost: null, roi: null },
    createdAt: at, updatedAt: at,
  };
}

const sourceParameters = ['c', 'cid', 'campaign', 'p', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];

/** /link is the dedicated Bio entry. /chat itself never receives this default. */
export function linkHubConsultUrl(input: URLSearchParams, language: 'en' | 'id' | 'zh') {
  const output = new URLSearchParams();
  for (const key of sourceParameters) {
    const value = input.get(key);
    if (value) output.set(key, value);
  }
  if (!['c', 'cid', 'campaign', 'p'].some(key => input.get(key))) {
    output.set('c', INSTAGRAM_BIO_CAMPAIGN);
    output.set('p', `p_instagram_bio_${language}`);
    output.set('utm_source', 'instagram');
    output.set('utm_medium', 'social');
    output.set('utm_campaign', INSTAGRAM_BIO_CAMPAIGN);
  }
  // Each saved language variant has its own immutable promotion identity.
  if (input.get('c') === INSTAGRAM_BIO_CAMPAIGN && languages.some(code => input.get('p') === `p_instagram_bio_${code}`)) {
    output.set('p', `p_instagram_bio_${language}`);
  }
  output.set('lang', language);
  return `/chat?${output}`;
}

export function isInstagramBioPromotion(value: CampaignPromotionLink, language: string) {
  return value.id === `p_instagram_bio_${language}` && value.language === language
    && value.source === 'instagram' && value.medium === 'social'
    && value.experience === PROMOTION_EXPERIENCE && value.landingPath === '/link';
}

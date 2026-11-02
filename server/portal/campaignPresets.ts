import { INSTAGRAM_BIO_CAMPAIGN, INSTAGRAM_BIO_PRESET, instagramBioCampaign, isInstagramBioPromotion } from '../../src/utils/instagramBioCampaign';

/** Caller owns the transaction. Never replace a campaign or reset live statistics on restart. */
export async function ensureInstagramBioCampaign(db: { query: (...args: any[]) => Promise<any> }) {
  const record = instagramBioCampaign();
  const aliases = (await db.query("SELECT raw_code,campaign_id FROM campaign_source_reviews WHERE LOWER(raw_code)=:p1 AND status='linked'", [record.code])).rows;
  if (aliases.some((alias: any) => alias.campaign_id !== record.id)) {
    throw Error('Instagram Bio preset conflicts with a verified source alias. Review without replacing attribution history.');
  }
  await db.query('INSERT INTO trial_campaigns(id,code,config) VALUES(:p1,:p1,:p2) ON DUPLICATE KEY UPDATE id=id', [record.id, record]);
  const saved = (await db.query('SELECT id,code,config FROM trial_campaigns WHERE id=:p1 AND code=:p1', [record.id])).rows[0];
  if (!saved || saved.config?.presetKey !== INSTAGRAM_BIO_PRESET
      || saved.config.id !== INSTAGRAM_BIO_CAMPAIGN || saved.config.code !== INSTAGRAM_BIO_CAMPAIGN
      || !['id', 'en', 'zh'].every(language => saved.config.promotionLinks?.some((link: any) => isInstagramBioPromotion(link, language)))) {
    throw Error('Instagram Bio preset conflicts with an existing campaign. Review the reserved code without replacing existing data.');
  }
  return saved.config;
}

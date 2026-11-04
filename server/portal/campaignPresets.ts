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
  for (const link of saved.config.promotionLinks) {
    await db.query('INSERT INTO campaign_promotion_index(p,campaign_id) VALUES(:p1,:p2) ON DUPLICATE KEY UPDATE p=p', [link.id, saved.id]);
    const owner = (await db.query('SELECT campaign_id FROM campaign_promotion_index WHERE p=:p1', [link.id])).rows[0];
    if (owner?.campaign_id !== saved.id) throw Error('Instagram promotion index ownership mismatch.');
  }
  return saved.config;
}

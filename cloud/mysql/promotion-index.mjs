export function promotionIndexEntries(campaigns) {
  const entries = new Map();
  for (const row of campaigns) {
    const config = typeof row.config === 'string' ? JSON.parse(row.config) : row.config;
    if (config.id !== row.id || config.code !== row.code) throw Error('Campaign identity mismatch');
    for (const link of config.promotionLinks ?? []) {
      if (typeof link.id !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(link.id)) {
        throw Error('Invalid promotion link ID in campaign ' + row.id);
      }
      if (entries.has(link.id)) throw Error('Duplicate promotion link ID: ' + link.id);
      entries.set(link.id, row.id);
    }
  }
  return entries;
}

/** Called under the schema lock with the application stopped during upgrade. */
export async function syncPromotionIndex(connection) {
  const [campaigns] = await connection.query('SELECT id,code,config FROM trial_campaigns FOR UPDATE');
  const entries = promotionIndexEntries(campaigns);
  const [indexed] = await connection.query('SELECT p,campaign_id FROM campaign_promotion_index FOR UPDATE');
  for (const row of indexed) {
    if (entries.get(row.p) !== row.campaign_id) throw Error('Promotion index ownership mismatch: ' + row.p);
    entries.delete(row.p);
  }
  for (const [p, campaignId] of entries) {
    await connection.execute('INSERT INTO campaign_promotion_index(p,campaign_id) VALUES(?,?)', [p, campaignId]);
  }
}

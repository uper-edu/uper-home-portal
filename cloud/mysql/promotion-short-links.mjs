import { randomInt } from 'node:crypto';
import evergreenLinks from '../../src/data/evergreenPromotionLinks.json' with {type:'json'};
import defaults from '../../src/data/system-defaults/index.ts';

const alphabet = '23456789abcdefghjkmnpqrstuvwxyz';
export const promotionShortCodePattern = /^[23456789abcdefghjkmnpqrstuvwxyz]{6}$/;

const presetLinks = new Map(defaults.campaigns.map(campaign => [
  campaign.id, new Set((campaign.promotionLinks ?? []).map(link => link.id)),
]));
presetLinks.set('social-bio', new Set(evergreenLinks.map(link => link.id)));
// Previously issued Instagram Bio URLs still resolve if the historical campaign exists.
presetLinks.set('instagram-bio', new Set(['id', 'en', 'zh'].map(language => 'p_instagram_bio_' + language)));
const presetOwners = new Map([...presetLinks].flatMap(([campaignId, links]) =>
  [...links].map(p => [p, campaignId]),
));
// These Threads entries were distributed as custom links before becoming presets.
const threadsPresets = new Set(evergreenLinks.filter(link => link.source === 'threads').map(link => link.id));

export function presetPromotionOwner(p) {
  return presetOwners.get(p);
}

export async function allocatePromotionShortCode(p, insert, pick = randomInt) {
  for (let attempt = 0; attempt < 32; attempt++) {
    const code = Array.from({length: 6}, () => alphabet[pick(alphabet.length)]).join('');
    try {
      await insert(code, p);
      return code;
    } catch (error) {
      if (error.code !== 'ER_DUP_ENTRY') throw error;
    }
  }
  throw Object.assign(Error('Could not allocate a promotion short code.'), {status: 503});
}

/** Runs under the migration lock. Existing mappings are immutable. */
export async function backfillPromotionShortLinks(connection) {
  const [index] = await connection.query('SELECT p,campaign_id FROM campaign_promotion_index FOR UPDATE');
  const pending = new Set(index.filter(row => !presetLinks.get(row.campaign_id)?.has(row.p)).map(row => row.p));
  const existingThreadsAliases = new Set(index.filter(row =>
    row.campaign_id === 'social-bio' && threadsPresets.has(row.p)).map(row => row.p));
  const [saved] = await connection.query('SELECT p,short_code FROM campaign_promotion_short_links FOR UPDATE');
  for (const {p, short_code} of saved) {
    if (!promotionShortCodePattern.test(short_code) || !(pending.delete(p) || existingThreadsAliases.delete(p))) {
      throw Error('Invalid promotion short-link mapping for ' + p);
    }
  }
  for (const p of pending) {
    await allocatePromotionShortCode(p, (code, id) => connection.execute(
      'INSERT INTO campaign_promotion_short_links(short_code,p) VALUES(?,?)', [code, id],
    ));
  }
}

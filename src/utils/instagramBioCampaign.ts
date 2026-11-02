export const INSTAGRAM_BIO_CAMPAIGN = 'instagram-bio';
const languages = ['id', 'en', 'zh'] as const;

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

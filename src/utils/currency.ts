/** Display only. Never parse customer text, convert currencies or round stored amounts. */
export function formatCurrencyNumber(amount: number, language = 'zh'): string {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return '—';
  const locale = language.startsWith('id') ? 'id-ID' : language.startsWith('zh') ? 'zh-CN' : 'en-US';
  return new Intl.NumberFormat(locale, {useGrouping: true, maximumFractionDigits: 20}).format(Object.is(amount,-0)?0:amount);
}

/** Use an unambiguous currency identifier; the IDR business label is Rp in all languages. */
export function formatCurrency(amount: number, language = 'zh', currency = 'IDR'): string {
  const number = formatCurrencyNumber(amount, language);
  if (number === '—' || !/^[A-Z]{3}$/.test(currency)) return '—';
  return `${currency === 'IDR' ? 'Rp' : currency} ${number}`;
}

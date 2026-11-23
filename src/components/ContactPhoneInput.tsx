import {useMemo, useState, type ComponentPropsWithRef} from 'react';
import {getCountries, getCountryCallingCode, type CountryCode} from 'libphonenumber-js/max';
import {CONTACT_PHONE_MAX_LENGTH, DEFAULT_CONTACT_PHONE_COUNTRY, parseContactPhone} from '../utils/contactPhone';
import './contact-phone-input.css';

const countries = getCountries().map(country => ({country, code: getCountryCallingCode(country)}));
const callingCodes = new Set<string>(countries.map(({code}) => code));

function splitInternational(value: string, valid: boolean) {
  const input = value.trimStart();
  const explicit = valid && /^62/.test(input) ? '+' + input : input.replace(/^00/, '+');
  const digits = explicit.match(/^\+(\d{1,3})/)?.[1];
  if (!digits) return;
  for (let length = 1; length <= digits.length; length++) {
    const code = digits.slice(0, length);
    if (callingCodes.has(code) && (valid || explicit[code.length + 1] === ' ')) {
      return {code, national: explicit.slice(code.length + 1).replace(valid ? /^[ -]+/ : /^ /, '')};
    }
  }
}

type Props = Omit<ComponentPropsWithRef<'input'>, 'value' | 'onChange' | 'type'> & {
  language: string;
  value: string;
  onValueChange: (value: string) => void;
};

export function ContactPhoneInput({language, value, onValueChange, readOnly, disabled, ...inputProps}: Props) {
  const [selection, setSelection] = useState<{country: CountryCode; value: string}>();
  const lang = language.startsWith('zh') ? 'zh' : language.startsWith('id') ? 'id' : 'en';
  const options = useMemo(() => {
    const names = typeof Intl.DisplayNames === 'function' ? new Intl.DisplayNames([lang], {type: 'region'}) : undefined;
    return countries.map(option => ({...option, name: names?.of(option.country) ?? option.country}))
      .sort((a, b) => a.name.localeCompare(b.name, lang));
  }, [lang]);
  const parsed = /^\s*(?:\+|00|62)/.test(value) ? parseContactPhone(value) : undefined;
  const international = splitInternational(value, Boolean(parsed));
  const code = international?.code ?? getCountryCallingCode(DEFAULT_CONTACT_PHONE_COUNTRY);
  const parsedCountry = international ? parsed?.country : undefined;
  const country = selection?.value === value ? selection.country
    : parsedCountry ?? (code === '62' ? DEFAULT_CONTACT_PHONE_COUNTRY : countries.find(option => option.code === code)?.country ?? '');
  const national = international?.national ?? value;
  const countryLabel = {zh: '国家或地区区号', id: 'Kode negara atau wilayah', en: 'Country or region calling code'}[lang];

  function changeCountry(nextCountry: CountryCode) {
    const nextCode = getCountryCallingCode(nextCountry);
    const nextValue = nextCountry === DEFAULT_CONTACT_PHONE_COUNTRY ? national : `+${nextCode} ${national}`;
    setSelection({country: nextCountry, value: nextValue});
    onValueChange(nextValue);
  }

  function changeNational(next: string) {
    const fullNumber = /^\s*(?:\+|00)/.test(next);
    const nextValue = fullNumber || country === DEFAULT_CONTACT_PHONE_COUNTRY ? next : `+${code} ${next}`;
    if (fullNumber) setSelection(undefined);
    else if (country) setSelection({country, value: nextValue});
    onValueChange(nextValue);
  }

  return <span className="contact-phone-input">
    <span className="contact-phone-country">
      <span aria-hidden="true">+{code}</span>
      <select aria-label={countryLabel} disabled={disabled || readOnly} value={country} autoComplete="tel-country-code"
        onChange={event => changeCountry(event.target.value as CountryCode)}>
        {options.map(option => <option key={option.country} value={option.country}>+{option.code} · {option.name}</option>)}
      </select>
    </span>
    <input {...inputProps} type="tel" autoComplete="tel-national" readOnly={readOnly} disabled={disabled} value={national}
      maxLength={CONTACT_PHONE_MAX_LENGTH}
      onPaste={event => {
        const pasted = event.clipboardData.getData('text').trim();
        if (/^(?:\+|00)/.test(pasted) && parseContactPhone(pasted)) {
          event.preventDefault();
          changeNational(pasted);
        }
      }}
      onChange={event => changeNational(event.target.value)}/>
  </span>;
}

import {parsePhoneNumberFromString} from "libphonenumber-js/max";

export const CONTACT_PHONE_ERROR = "INVALID_CONTACT_PHONE";
export const CONTACT_PHONE_MAX_LENGTH = 40;

export function validContactPhone(value: unknown, required = true): boolean {
  if (typeof value !== "string" || value.length > CONTACT_PHONE_MAX_LENGTH) return false;
  const input = value.trim();
  if (!input) return !required;
  // Validate the original characters before removing presentation separators.
  // Never turn letters, an extension, or several numbers into one valid number.
  if (!/^\+?[0-9]+(?:[ -]+[0-9]+)*$/.test(input)) return false;
  let number = input.replace(/[ -]/g, "");
  if (number.startsWith("00")) number = "+" + number.slice(2);
  else if (number.startsWith("62")) number = "+" + number;
  try {
    return parsePhoneNumberFromString(number, {defaultCountry: "ID", extract: false})?.isValid() === true;
  } catch {
    return false;
  }
}

export function contactPhoneText(language: string) {
  const lang = language.startsWith("zh") ? "zh" : language.startsWith("id") ? "id" : "en";
  return {
    en: {
      help: "Indonesia: 08…, 62… or +62…. For other countries, include + and the country code (00 is also accepted). Spaces and hyphens are allowed. Format checking does not verify WhatsApp availability.",
      error: "Check this phone number and country code. Use digits, spaces or hyphens, with + only at the start; maximum 40 characters.",
    },
    id: {
      help: "Indonesia: 08…, 62…, atau +62…. Untuk negara lain, gunakan + dan kode negara (awalan 00 juga diterima). Spasi dan tanda hubung diperbolehkan. Pemeriksaan format tidak memastikan nomor terdaftar di WhatsApp.",
      error: "Periksa nomor telepon dan kode negara. Gunakan angka, spasi, atau tanda hubung; + hanya di awal. Maksimal 40 karakter.",
    },
    zh: {
      help: "印尼号码可填08…、62…或+62…；其他国家请带+国家区号（也支持00前缀）。可用空格、横杠分隔。格式检查不代表号码已开通WhatsApp。",
      error: "请核对号码及国家区号。仅使用数字、空格或横杠，+只能在开头，最多40个字符。",
    },
  }[lang];
}

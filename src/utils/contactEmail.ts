export const CONTACT_EMAIL_ERROR = "INVALID_CONTACT_EMAIL";

// Conventional web contact addresses: one unquoted ASCII mailbox and a full
// domain. This deliberately does not claim support for every SMTP address form.
export function validContactEmail(value: unknown, required = true): boolean {
  if (typeof value !== "string" || /[\r\n\u0000-\u001f\u007f]/.test(value)) return false;
  const email = value.trim();
  if (!email) return !required;
  if (email.length > 254) return false;
  const parts = email.split("@");
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  if (local.length > 64 || !/^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/i.test(local)) return false;
  const labels = domain.split(".");
  if (labels.length < 2 || domain.length > 253) return false;
  if (!labels.every(label => label.length <= 63 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label))) return false;
  return /^[a-z]{2,63}$/i.test(labels.at(-1)!) || /^xn--[a-z0-9-]+$/i.test(labels.at(-1)!);
}

export function contactEmailText(language: string) {
  const lang = language.startsWith("zh") ? "zh" : language.startsWith("id") ? "id" : "en";
  return {
    en: {
      help: "Enter one complete address, such as name@example.com. Dots, + tags and subdomains are supported. Format checking does not verify delivery or ownership.",
      error: "Check this email address: include a name, one @ and a full domain, with no spaces inside. Maximum 254 characters.",
    },
    id: {
      help: "Masukkan satu alamat lengkap, misalnya nama@example.com. Titik, tag +, dan subdomain didukung. Pemeriksaan format tidak memastikan pengiriman atau kepemilikan.",
      error: "Periksa alamat email: sertakan nama, satu @, dan domain lengkap, tanpa spasi di dalamnya. Maksimal 254 karakter.",
    },
    zh: {
      help: "请填写一个完整邮箱，如name@example.com，支持点号、+标签和子域名。格式检查不证明邮箱存在、可收信或属于本人。",
      error: "请核对邮箱：需有用户名、一个@和完整域名，中间不能有空格，最多254个字符。",
    },
  }[lang];
}

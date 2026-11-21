type Language = "zh" | "en" | "id";

const messages = {
  service_disabled: ['报名服务暂未开放。','Enrollment service is currently unavailable.','Layanan pendaftaran belum tersedia.'],
  bank_required: ['收款资料尚未就绪，暂时无法接受新报名。','New applications are unavailable until payment details are ready.','Pendaftaran baru belum tersedia karena informasi pembayaran belum siap.'],
  mail_required: ['验证码邮件暂不可用，暂时无法接受新报名。','New applications are unavailable because verification email is not ready.','Pendaftaran baru belum tersedia karena email verifikasi belum siap.'],
  check_failed: ['暂时无法确认报名是否开放，请稍后重试。','We could not check enrollment availability. Try again later.','Status pendaftaran belum dapat diperiksa. Coba lagi nanti.'],
} as const;

export function enrollmentReadinessMessage(reason: string, language: Language) {
  if(!Object.hasOwn(messages,reason))return undefined;
  return messages[reason as keyof typeof messages][language==='zh'?0:language==='id'?2:1];
}

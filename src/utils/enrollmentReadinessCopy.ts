type Language = "zh" | "en" | "id";

export const enrollmentCodeRequestErrors = {
  enrollment_code_offline: ['网络已断开。恢复连接后，请重新发送验证码。','You’re offline. Reconnect, then select Send code again.','Anda sedang offline. Sambungkan kembali, lalu pilih Kirim kode lagi.'],
  enrollment_code_wait: ['请稍后再申请验证码。','Wait before requesting another code.','Tunggu sebelum meminta kode baru.'],
  enrollment_code_send_unconfirmed: [
    '暂时无法确认验证码是否发出。请稍等片刻，再点击发送验证码。',
    'We couldn’t confirm whether the code was sent. Wait a moment, then select Send code again.',
    'Pengiriman kode belum dapat dikonfirmasi. Tunggu sebentar, lalu pilih Kirim kode lagi.',
  ],
} satisfies Record<string,[string,string,string]>;

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

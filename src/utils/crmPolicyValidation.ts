import type { CrmLanguage } from "./crmLanguage";

export type WorkTimeField = "startTime" | "endTime";
export type WorkTimeError = "policy_start_time_invalid" | "policy_end_time_invalid" | "policy_time_order";
export type WorkTimeErrors = Partial<Record<WorkTimeField, WorkTimeError>>;
const clock = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Same-day work windows only; never replace an explicitly empty value with a default. */
export function workTimeErrors(value: { startTime?: unknown; endTime?: unknown }): WorkTimeErrors {
  const errors: WorkTimeErrors = {};
  if (typeof value.startTime !== "string" || !clock.test(value.startTime)) errors.startTime = "policy_start_time_invalid";
  if (typeof value.endTime !== "string" || !clock.test(value.endTime)) errors.endTime = "policy_end_time_invalid";
  if (!Object.keys(errors).length && (value.startTime as string) >= (value.endTime as string)) errors.endTime = "policy_time_order";
  return errors;
}

const messages = {
  policy_boolean_invalid: ["Choose enabled or disabled.", "Pilih aktif atau nonaktif.", "请选择开启或关闭。"],
  policy_object_invalid: ["Provide a non-empty configuration object.", "Berikan objek konfigurasi yang tidak kosong.", "请提供非空的配置对象。"],
  policy_field_unknown: ["This configuration field is not supported.", "Kolom konfigurasi ini tidak didukung.", "不支持此配置字段。"],
  policy_duration_invalid: ["Enter a finite duration greater than zero and a valid unit.", "Masukkan durasi terbatas lebih dari nol dan satuan yang valid.", "请填写大于零的有效时长并选择合法单位。"],
  policy_count_invalid: ["Enter a non-negative whole number of retries.", "Masukkan jumlah percobaan ulang berupa bilangan bulat nol atau lebih.", "重试次数须为零或正整数。"],
  policy_timezone_invalid: ["Select a valid timezone.", "Pilih zona waktu yang valid.", "请选择有效时区。"],
  policy_days_invalid: ["Select at least one working day without duplicates.", "Pilih setidaknya satu hari kerja tanpa duplikat.", "请至少选择一个工作日，不可重复。"],
  policy_clock_invalid: ["Enter a valid time (HH:mm).", "Masukkan waktu yang valid (HH:mm).", "请填写有效时间（HH:mm）。"],
  policy_start_time_invalid: ["Enter a valid start time (HH:mm).", "Masukkan waktu mulai yang valid (HH:mm).", "请填写有效的开始时间（HH:mm）。"],
  policy_end_time_invalid: ["Enter a valid end time (HH:mm).", "Masukkan waktu selesai yang valid (HH:mm).", "请填写有效的结束时间（HH:mm）。"],
  policy_time_order: ["End time must be later than start time.", "Waktu selesai harus setelah waktu mulai.", "结束时间须晚于开始时间。"],
  policy_calendar_invalid: ["Correct the working hours to see the preview.", "Perbaiki jam kerja untuk melihat pratinjau.", "工作时间待修正，暂不显示预览。"],
  policy_save_failed: ["Policies were not saved. Check your connection and try again. Your changes are retained.", "Kebijakan belum disimpan. Periksa koneksi lalu coba lagi. Perubahan Anda tetap tersimpan di formulir.", "策略未保存，请检查连接后重试。你的修改仍保留在表单中。"],
  policy_save_rejected: ["Policies were not saved. Check the configuration and try again. Your changes are retained.", "Kebijakan belum disimpan. Periksa konfigurasi lalu coba lagi. Perubahan Anda tetap tersimpan di formulir.", "策略未保存，请检查配置后重试。你的修改仍保留在表单中。"],
  policy_save_forbidden: ["You no longer have permission to save these policies. Your changes are retained.", "Anda tidak lagi memiliki izin untuk menyimpan kebijakan ini. Perubahan Anda tetap tersimpan di formulir.", "你当前没有保存策略的权限，修改仍保留在表单中。"],
  policy_save_login: ["Your session has expired. Sign in before retrying. Your changes are retained on this page.", "Sesi Anda berakhir. Masuk sebelum mencoba lagi. Perubahan Anda tetap tersimpan di halaman ini.", "登录已失效，请重新登录后重试。修改仍保留在当前页面。"],
  policy_save_success: ["Policies saved. Existing task deadlines are unchanged.", "Kebijakan disimpan. Tenggat tugas yang sudah ada tidak berubah.", "策略已保存，已有任务截止时间保持不变。"],
  policy_topic_conflict: ["This topic was changed in another session. Your draft is retained. Compare the saved values before retrying.", "Topik ini diubah di sesi lain. Draf dipertahankan. Bandingkan nilai tersimpan sebelum mencoba lagi.", "此主题已被其他会话修改，草稿仍保留。请核对最新已保存值后再重试。"],
  policy_topic_unknown: ["The save result could not be confirmed. Your draft is retained. Check the saved values before retrying.", "Hasil penyimpanan belum dapat dipastikan. Draf dipertahankan. Periksa nilai tersimpan sebelum mencoba lagi.", "保存结果暂无法确认，草稿仍保留。请先核对已保存值再重试。"],
  policy_topic_saved: ["Saved.", "Disimpan.", "已保存。"],
  policy_reset_unknown: ["Restoration could not be confirmed. Your form changes are retained. Reload the saved policies before retrying.", "Pemulihan belum dapat dipastikan. Perubahan formulir tetap dipertahankan. Muat ulang kebijakan tersimpan sebelum mencoba lagi.", "恢复结果暂无法确认，表单修改仍保留。请先重新读取已保存策略，再决定是否重试。"],
  policy_reset_not_applied: ["The saved policies do not match the defaults. Your form changes are retained. Review the saved policies before retrying.", "Kebijakan tersimpan tidak sesuai dengan pengaturan standar. Perubahan formulir tetap dipertahankan. Tinjau kebijakan tersimpan sebelum mencoba lagi.", "当前已保存策略与默认值不一致，表单修改仍保留。请核对已保存策略后再重试。"],
} as const;
export type PolicyMessage = keyof typeof messages;
export function policyMessage(code: PolicyMessage, lang: CrmLanguage) {
  return messages[code][lang === "en" ? 0 : lang === "id" ? 1 : 2];
}

export class PolicySaveError extends Error {
  constructor(public code: PolicyMessage = "policy_save_failed", public fields: Record<string, PolicyMessage> = {}, public currentPolicy?: import("../types/crmPolicyConfig").CrmPolicyConfig) {
    super(code);
  }
}
export function policySaveResponseError(status: number, body: unknown) {
  const fields: Record<string, PolicyMessage> = {};
  const supplied = (body as { fieldErrors?: Record<string, unknown> } | null)?.fieldErrors;
  for (const [field,code] of Object.entries(supplied || {})) {
    if (typeof code === 'string' && Object.hasOwn(messages,code)) fields[field] = code as PolicyMessage;
  }
  if(status===409 && (body as any)?.error==="policy_topic_conflict")return new PolicySaveError("policy_topic_conflict",{},(body as any).currentPolicy);
  return new PolicySaveError(status === 401 ? "policy_save_login" : status === 403 ? "policy_save_forbidden" : status >= 400 && status < 500 ? "policy_save_rejected" : "policy_save_failed", fields);
}

const fieldNames: Record<string, readonly string[]> = {
 'identityReviewManagerOnly':['Manager-only identity review','Verifikasi identitas hanya Manager','身份核实仅限CRM Manager'],
 'ownerAssignmentManagerOnly':['Manager-only Lead Owner assignment','Penugasan Owner Lead hanya Manager','Lead分配Owner仅限CRM Manager'],
 'sourceAttributionManagerOnly':['Manager-only source attribution review','Verifikasi atribusi sumber hanya Manager','待核实来源归因仅限CRM Manager'],
 'businessHours.startTime':['Daily start time','Waktu mulai harian','每日开始工作时间'],
 'businessHours.endTime':['Daily end time','Waktu selesai harian','每日结束工作时间'],
 'businessHours.timezone':['Timezone','Zona waktu','时区'],
 'businessHours.workDays':['Working days','Hari kerja','工作日'],
 'businessHours.nextDayGraceTime':['Next-day start time','Waktu mulai hari berikutnya','次日起始时间'],
 'firstResponseSla.hot':['Hot response deadline','Tenggat respons prospek panas','高意向响应时限'],
 'firstResponseSla.warm':['Warm response deadline','Tenggat respons prospek hangat','中意向响应时限'],
 'firstResponseSla.cold':['Cold response deadline','Tenggat respons prospek dingin','培育响应时限'],
 'noResponseCadence.retryInterval':['Retry interval','Jeda percobaan ulang','重试间隔'],
 'noResponseCadence.maxRetriesBeforeNurture':['Consecutive unanswered threshold','Ambang upaya berturut-turut tanpa balasan','连续未回复阈值'],
 'inactivityWatchdog.hotInactivity':['Hot inactivity threshold','Ambang tidak aktif prospek panas','高意向未联系时长'],
 'inactivityWatchdog.warmInactivity':['Warm inactivity threshold','Ambang tidak aktif prospek hangat','中意向未联系时长'],
 'inactivityWatchdog.coldInactivity':['Cold inactivity threshold','Ambang tidak aktif prospek dingin','培育客户未联系时长'],
 'milestones.trialReminderBefore':['Before-trial reminder','Pengingat sebelum kelas percobaan','试听前提醒'],
 'milestones.trialFollowUpAfter':['After-trial follow-up','Tindak lanjut setelah kelas percobaan','试听后跟进'],
 'milestones.assessmentFollowUpAfter':['After-assessment follow-up','Tindak lanjut setelah asesmen','测评后跟进'],
 'reactivation.reactivatedResponse':['Reactivated response deadline','Tenggat respons pelanggan aktif kembali','重新激活响应时限'],
};
export function policyFieldLabel(field:string,lang:CrmLanguage) {
 return (fieldNames[field] || ['Configuration','Konfigurasi','配置'])[lang==='en'?0:lang==='id'?1:2];
}

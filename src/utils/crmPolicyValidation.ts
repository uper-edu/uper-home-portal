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
  policy_start_time_invalid: ["Enter a valid start time (HH:mm).", "Masukkan waktu mulai yang valid (HH:mm).", "请填写有效的开始时间（HH:mm）。"],
  policy_end_time_invalid: ["Enter a valid end time (HH:mm).", "Masukkan waktu selesai yang valid (HH:mm).", "请填写有效的结束时间（HH:mm）。"],
  policy_time_order: ["End time must be later than start time.", "Waktu selesai harus setelah waktu mulai.", "结束时间须晚于开始时间。"],
  policy_calendar_invalid: ["Correct the working hours to see the preview.", "Perbaiki jam kerja untuk melihat pratinjau.", "工作时间待修正，暂不显示预览。"],
  policy_save_failed: ["Policies were not saved. Check your connection and try again. Your changes are retained.", "Kebijakan belum disimpan. Periksa koneksi lalu coba lagi. Perubahan Anda tetap tersimpan di formulir.", "策略未保存，请检查连接后重试。你的修改仍保留在表单中。"],
  policy_save_rejected: ["Policies were not saved. Check the configuration and try again. Your changes are retained.", "Kebijakan belum disimpan. Periksa konfigurasi lalu coba lagi. Perubahan Anda tetap tersimpan di formulir.", "策略未保存，请检查配置后重试。你的修改仍保留在表单中。"],
  policy_save_forbidden: ["You no longer have permission to save these policies. Your changes are retained.", "Anda tidak lagi memiliki izin untuk menyimpan kebijakan ini. Perubahan Anda tetap tersimpan di formulir.", "你当前没有保存策略的权限，修改仍保留在表单中。"],
  policy_save_login: ["Your session has expired. Sign in before retrying. Your changes are retained on this page.", "Sesi Anda berakhir. Masuk sebelum mencoba lagi. Perubahan Anda tetap tersimpan di halaman ini.", "登录已失效，请重新登录后重试。修改仍保留在当前页面。"],
  policy_save_success: ["Policies saved. Existing task deadlines are unchanged.", "Kebijakan disimpan. Tenggat tugas yang sudah ada tidak berubah.", "策略已保存，已有任务截止时间保持不变。"],
} as const;
export type PolicyMessage = keyof typeof messages;
export function policyMessage(code: PolicyMessage, lang: CrmLanguage) {
  return messages[code][lang === "en" ? 0 : lang === "id" ? 1 : 2];
}

export class PolicySaveError extends Error {
  constructor(public code: PolicyMessage = "policy_save_failed", public fields: WorkTimeErrors = {}) {
    super(code);
  }
}
export function policySaveResponseError(status: number, body: unknown) {
  const fields: WorkTimeErrors = {};
  const supplied = (body as { fieldErrors?: WorkTimeErrors } | null)?.fieldErrors;
  for (const field of ["startTime", "endTime"] as const) {
    const code = supplied?.[field];
    if (code === "policy_start_time_invalid" || code === "policy_end_time_invalid" || code === "policy_time_order") fields[field] = code;
  }
  return new PolicySaveError(status === 401 ? "policy_save_login" : status === 403 ? "policy_save_forbidden" : status >= 400 && status < 500 ? "policy_save_rejected" : "policy_save_failed", fields);
}

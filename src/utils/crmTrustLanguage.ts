import type { CrmLanguage } from "./crmLanguage";
const messages: Record<string, [string, string]> = {
  "Stage change reason required": [
    "Alasan perubahan tahap wajib diisi",
    "请填写阶段变更原因",
  ],
  "Stage changed; refresh and review": [
    "Tahap berubah; muat ulang dan tinjau",
    "阶段已变化，请刷新核对",
  ],
  "Request ID required": ["ID permintaan wajib diisi", "缺少请求编号"],
  "Request conflict; query the original result": [
    "Permintaan bentrok; periksa hasil awal",
    "请求内容冲突，请查询原保存结果",
  ],
  "Action and reason required": [
    "Tindakan dan alasan wajib diisi",
    "请填写操作及原因",
  ],
  "Task changed; refresh and review": [
    "Tugas berubah; muat ulang dan tinjau",
    "任务已变化，请刷新核对",
  ],
  "Information text required": ["Isi catatan diperlukan", "请填写记录内容"],
  "Identity decision and reason required": [
    "Keputusan identitas dan alasan diperlukan",
    "请选择身份判断并填写依据",
  ],
  "Identity candidate changed; refresh and review": [
    "Kandidat identitas berubah; muat ulang",
    "身份候选已变化，请刷新核对",
  ],
  "Information changed; refresh and review": [
    "Informasi berubah; muat ulang",
    "信息已变化，请刷新核对",
  ],
  "Future appointment time with timezone required": [
    "Pilih waktu janji mendatang dengan zona waktu",
    "请选择带时区的未来约定时间",
  ],
  "Operation not found": [
    "Hasil belum ditemukan; coba lagi tanpa mengubah isi",
    "尚未查到保存结果，请保持原内容重试",
  ],
  "Task not found": ["Tugas tidak ditemukan", "未找到任务"],
  "Lead not found": ["Pelanggan tidak ditemukan", "未找到客户"],
  "Invalid task action": ["Tindakan tugas tidak valid", "任务操作无效"],
  "Enter an action, purpose and future time with timezone": [
    "Isi tindakan, tujuan, dan waktu mendatang dengan zona waktu",
    "请填写动作、依据和带时区的未来时间",
  ],
};
export function trustError(message: string, lang: CrmLanguage) {
  const value = messages[message];
  return lang === "en"
    ? message
    : value?.[lang === "id" ? 0 : 1] ||
        (lang === "id"
          ? "Penyimpanan gagal. Periksa hasil sebelum mencoba lagi."
          : "保存未确认，请先查询结果后再重试。");
}

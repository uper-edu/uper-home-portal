import {outreachText} from './crmOutreach';
import type { CrmLanguage } from "./crmLanguage";
const messages: Record<string, [string, string]> = {
  "Identity review requires access to all candidates": ["Verifikasi memerlukan akses ke semua kandidat", "无权核实全部候选客户"],
  "Identity review remaining candidates before consolidation": ["Verifikasi dan singkirkan kandidat lain sebelum menggabungkan", "请先核实并排除其他候选客户，再确认归入"],
  "Enter task content and a future time with timezone": ["Isi tugas dan waktu mendatang", "请填写任务内容和未来时间"],
  "Enter the specific task action": ["Isi tindakan spesifik tugas", "请填写任务的具体动作"],
  "Enter the task purpose": ["Isi tujuan tugas", "请填写任务用途"],
  "Choose what the task time means": ["Pilih makna waktu tugas", "请选择任务时间的含义"],
  "Choose a task date and time": ["Pilih tanggal dan waktu tugas", "请选择完整的任务日期和时间"],
  "Choose a future time in the operating timezone": ["Waktu yang dipilih sudah lewat. Pilih waktu mendatang.", "所选时间已经过去，请选择未来时间。"],
  "Enter the task reason or evidence": ["Isi alasan atau bukti tugas", "请填写任务原因或依据"],

  "Request changed; refresh and review": ["Permintaan berubah; muat ulang dan tinjau", "请求已变化，请刷新核对"],
  "Choose the requests handled by this result": ["Konfirmasi permintaan yang ditangani; muat ulang jika bukti belum tersedia", "请逐项确认本次已处理的请求；依据未加载时请重新打开表单"],
  "Confirm that this is a separate matter": ["Konfirmasi bahwa ini urusan berbeda; tugas lama tetap", "请确认这是独立事项，原任务保持不变"],
  "Confirm replacement of the same matter": ["Konfirmasi penggantian pekerjaan untuk urusan yang sama", "请确认替代同一事项的原工作"],
  "Choose how this relates to existing tasks": ["Pilih hubungan dengan tugas yang ada", "请选择与已有任务的关系"],
  "Use the contact arrangement to change this review task": ["Ubah tugas tinjauan melalui pengaturan kontak", "请通过调整联系安排修改此复查任务"],
  "Handle or move the linked requests before cancelling": ["Tangani atau pindahkan permintaan terkait sebelum membatalkan", "请先处理关联请求，或通过替代转移到新任务后再取消"],

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
  "Request context conflict; query the original result and refresh before saving": [
    "Konteks permintaan berbeda. Periksa hasil awal dan muat ulang sebelum menyimpan; draf tetap tersedia.",
    "请求的客户、操作或内容不一致。请查询原结果并刷新核对后保存，草稿已保留。",
  ],
  "Save response does not match this customer and action": [
    "Hasil tidak sesuai dengan pelanggan dan tindakan ini. Draf tetap tersedia; periksa hasil sebelum mencoba lagi.",
    "保存响应与当前客户或操作不匹配，草稿已保留；请先查询结果再重试。",
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
  "Identity evidence changed; refresh and review": ["Bukti identitas berubah; muat ulang dan tinjau kembali", "身份依据已变化，请刷新并重新核对"],
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
    "Isi tindakan, tujuan, dan waktu mendatang",
    "请填写动作、依据和未来时间",
  ],
};
const stageMessages:Record<string,[string,string,string]>={
 '请选择阶段实际生效时间或明确未知':['Choose the effective time or explicitly mark it unknown','Pilih waktu berlaku atau nyatakan tidak diketahui','请选择阶段实际生效时间或明确未知'],
 '请填写完整的阶段生效日期与时间':['Enter the complete effective date and time','Isi tanggal dan waktu berlaku lengkap','请填写完整的阶段生效日期与时间'],
 '请明确确认报名已成立':['Explicitly confirm that enrollment is established','Konfirmasi bahwa pendaftaran telah selesai','请明确确认报名已成立'],
 '阶段生效时间无效或晚于当前时间':['The effective time is invalid or in the future','Waktu berlaku tidak valid atau masih di masa depan','阶段生效时间无效或晚于当前时间'],
 '依据不属于当前客户或已不可用':['Evidence is unavailable or belongs to another customer','Bukti tidak tersedia atau milik pelanggan lain','依据不属于当前客户或已不可用'],
 '请关联原始依据或填写具体事实说明':['Link original evidence or describe the supporting facts','Hubungkan bukti asli atau jelaskan fakta pendukung','请关联原始依据或填写具体事实说明'],
 '请明确确认报名已成立；意向不等于报名':['Confirm established enrollment; interest alone is not enrollment','Konfirmasi pendaftaran selesai; minat saja bukan pendaftaran','请明确确认报名已成立；意向不等于报名'],
 '阶段没有变化，请勿重复保存':['The stage has not changed','Tahap belum berubah','阶段没有变化，请勿重复保存']
};
export function trustError(message: string, lang: CrmLanguage) {
  if(message==='Choose a future time in the operating timezone')return lang==='zh'?'所选时间已经过去，请选择未来时间。':lang==='id'?'Waktu yang dipilih sudah lewat. Pilih waktu mendatang.':'Choose a future time';
  if(stageMessages[message])return stageMessages[message][lang==='zh'?2:lang==='id'?1:0];
  if(message.startsWith("IDENTITY_")||message.startsWith("CONTACT_")||message==="SELF_CLAIM_DISABLED"||message==="OWNER_MANAGER_REQUIRED")return outreachText(message,lang);
  const value = messages[message];
  return lang === "en"
    ? message
    : value?.[lang === "id" ? 0 : 1] ||
        (lang === "id"
          ? "Penyimpanan gagal. Periksa hasil sebelum mencoba lagi."
          : "保存未确认，请先查询结果后再重试。");
}

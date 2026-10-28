import type {CrmLanguage} from './crmLanguage';
/** Section names only. Values, original evidence and save commands remain owned by each form. */
export const crmFormLabels={
 unsaved:['Unsaved changes','Perubahan belum disimpan','有未保存修改'],
 sourceReview:['Review source','Verifikasi sumber','核实来源'],
 owner:['Owner assignment','Penugasan penanggung jawab','负责人安排'],
 changes:['Changes to make','Perubahan yang akan dibuat','本次修改'],
 evidence:['Source and explanation','Sumber dan penjelasan','信息依据'],
 original:['Original record','Catatan asli','原始记录'],
 amendment:['Supplement or correction','Pelengkap atau koreksi','补充与修正'],
 agreements:['Mistaken agreements','Kesepakatan yang salah dicatat','误记约定'],
 stage:['New sales stage','Tahap penjualan baru','选择新阶段'],
 stageEvidence:['Facts and evidence','Fakta dan bukti','变更依据'],
 contactScope:['Contact scope','Cakupan kontak','本次联系范围'],
 message:['Message preparation','Persiapan pesan','准备消息'],
 decision:['Identity decision','Keputusan identitas','身份核实结论'],
 campaign:['Campaign information','Informasi kampanye','活动基本信息'],
 promotion:['Promotion placement','Penempatan promosi','推广入口设置'],
 experience:['Customer entry experience','Alur masuk pelanggan','客户进入流程'],
 sourceEvidence:['Source evidence','Bukti sumber','原始来源依据'],
 attribution:['Attribution decision','Keputusan atribusi','归因处理'],
 materialSetup:['Material settings','Pengaturan materi','物料设置'],
 materialContent:['Draft content','Isi draf','文案草稿'],
 schedule:['Working hours','Jam kerja','工作时段'],
 response:['First-contact deadlines','Tenggat kontak pertama','首次联系期限'],
 watchdog:['Contact reference intervals','Interval acuan kontak','联系参考间隔'],
 permissions:['Review and ownership rules','Aturan verifikasi dan kepemilikan','核实与归属规则'],
}as const;
export type CrmFormLabel=keyof typeof crmFormLabels;
export const crmFormText=(lang:CrmLanguage,key:CrmFormLabel)=>crmFormLabels[key][lang==='zh'?2:lang==='id'?1:0];

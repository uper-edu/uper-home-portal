export const salesProgressStages = [
 ['progress:unreached','待建立沟通','Awaiting conversation','Menunggu komunikasi','尚未建立支持需求交流的有效双向沟通；未接通或未回复不等于已沟通。'],
 ['progress:discovery','需求沟通中','Understanding needs','Menggali kebutuhan','已建立有效沟通，正在了解目标、条件及顾虑。'],
 ['progress:proposal','方案确认中','Confirming proposal','Konfirmasi program','正在与客户确认具体课程、排期或价格方案；仅发送通用介绍不算。'],
 ['progress:registration','报名办理中','Registration in progress','Proses pendaftaran','客户明确决定报名正式课程方案，正在办理手续；试听预约、有兴趣或询问报名方式不算。'],
 ['progress:enrolled','已报名','Enrolled','Terdaftar','正式课程报名已确认成立，依据应说明具体课程方案及确认事实；不包含试听预约，也不以报名意向或未经核对的付款自述代替。'],
 ['progress:paused','暂缓推进','On hold','Ditunda','有明确原因暂缓本次推进，保留恢复可能；未回复本身不代表暂缓。'],
 ['progress:closed','结束推进','Opportunity closed','Peluang ditutup','已明确结束本次销售机会并记录原因；不自动改变联系许可。'],
] as const;
export type SalesProgressStage = typeof salesProgressStages[number][0];
export const legacySalesStages=['New','Contacted','Assessment Booked','Assessment Done','Trial Booked','Trial Attended','Enrolled','Lost'];
export const isSalesProgressStage=(s:any):s is SalesProgressStage=>salesProgressStages.some(v=>v[0]===s);
export function progressLabel(s:any,lang:string='zh'){const row=salesProgressStages.find(v=>v[0]===s);return row?row[lang==='zh'?1:lang==='id'?3:2]:String(s||'');}
export const isEnrolledStage=(s:any)=>s==='Enrolled'||s==='progress:enrolled';
export const isClosedSalesStage=(s:any)=>['Enrolled','Lost','progress:enrolled','progress:closed'].includes(s);

const progressDefinitions:Record<string,[string,string]>={
 'progress:unreached':['No effective two-way conversation has been established to discuss needs. An unanswered attempt does not count as a conversation.','Belum ada komunikasi dua arah yang efektif untuk membahas kebutuhan. Upaya tanpa jawaban tidak dihitung sebagai komunikasi.'],
 'progress:discovery':['An effective conversation is underway to understand goals, conditions and concerns.','Komunikasi efektif telah terjalin untuk memahami tujuan, kondisi, dan kendala.'],
 'progress:proposal':['Confirming a specific course, schedule or price with the customer. Sending general information alone does not qualify.','Sedang mengonfirmasi kursus, jadwal, atau harga tertentu dengan pelanggan. Mengirim informasi umum saja tidak cukup.'],
 'progress:registration':['The customer has explicitly decided to enrol in a full course and is completing registration. Trial bookings, interest or questions about registration do not qualify.','Pelanggan sudah memutuskan mendaftar kursus reguler dan sedang mengurus pendaftaran. Reservasi kelas coba, minat, atau pertanyaan tentang pendaftaran tidak termasuk.'],
 'progress:enrolled':['Full-course enrolment is confirmed. Evidence must identify the course and confirmation. Trial bookings, intent or unverified payment claims do not qualify.','Pendaftaran kursus reguler telah dikonfirmasi. Bukti harus menyebutkan kursus dan konfirmasinya. Reservasi kelas coba, niat mendaftar, atau klaim pembayaran yang belum diperiksa tidak termasuk.'],
 'progress:paused':['Progress is paused for an explicit reason and may resume. No reply alone does not mean a pause.','Proses ditunda dengan alasan jelas dan masih dapat dilanjutkan. Tidak ada balasan saja bukan berarti ditunda.'],
 'progress:closed':['This sales opportunity has explicitly ended with a recorded reason. Contact permission remains separate.','Peluang penjualan ini sudah diakhiri dengan alasan tercatat. Izin menghubungi tetap terpisah.'],
};
export function progressDefinition(stage:string,lang='zh'){return lang==='zh'?salesProgressStages.find(s=>s[0]===stage)?.[4]||'':progressDefinitions[stage]?.[lang==='id'?1:0]||'';}

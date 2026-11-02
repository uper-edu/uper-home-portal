/** Display copy for an explicitly selected stage; never populates or interprets customer facts. */
type StageCopy={summary:[string,string,string];instruction:[string,string,string];example:[string,string,string]};
const guidance:Record<string,StageCopy>={
 'progress:unreached':{
  summary:['No two-way conversation yet','Belum ada komunikasi dua arah','尚未建立双向沟通'],
  instruction:['Describe the unanswered contact or the record being corrected.','Jelaskan kontak tanpa balasan atau catatan yang dikoreksi.','说明尚未建立沟通的事实，或需要纠正的误记。'],
  example:['An unanswered contact was incorrectly recorded as a conversation; corrected against the original record.','Kontak tanpa balasan salah dicatat sebagai percakapan; dikoreksi berdasarkan catatan asli.','此前把未回复的联系误记为已沟通，现据原记录更正。']},
 'progress:discovery':{
  summary:['Discussing goals and needs','Membahas tujuan dan kebutuhan','正在了解目标、条件和顾虑'],
  instruction:['Describe confirmed needs and what still needs clarification.','Jelaskan kebutuhan yang sudah dipastikan dan hal yang masih perlu digali.','说明已确认的需求及仍待了解的信息。'],
  example:['The customer replied that they need Chinese for work; availability and budget are still being discussed.','Pelanggan membalas bahwa Mandarin dibutuhkan untuk pekerjaan; jadwal dan anggaran masih dibahas.','客户已回复希望为工作学中文，正在了解可上课时段和预算。']},
 'progress:proposal':{
  summary:['Reviewing a specific course proposal','Meninjau program tertentu','正在确认具体课程方案'],
  instruction:['Describe the proposal being reviewed and the customer’s response.','Jelaskan program yang ditinjau dan tanggapan pelanggan.','说明正在核对的课程方案及客户反馈。'],
  example:['The customer is reviewing the weekend course schedule and total fee.','Pelanggan sedang meninjau jadwal kursus akhir pekan dan biaya total.','已与客户讨论周末课程，正在确认上课时间和课程总价。']},
 'progress:registration':{
  summary:['Enrollment decided; registration underway','Sudah memutuskan; pendaftaran diproses','已决定报名，正在办理手续'],
  instruction:['Describe the enrollment decision and the registration steps still underway.','Jelaskan keputusan mendaftar dan proses yang masih berlangsung.','说明客户明确报名的决定及正在办理的手续。'],
  example:['The customer decided to enroll and is completing their registration details; registration is not yet complete.','Pelanggan sudah memutuskan mendaftar dan sedang melengkapi data; pendaftaran belum selesai.','客户已决定报名，正在填写报名资料，手续尚未完成。']},
 'progress:enrolled':{
  summary:['Formal course enrollment confirmed','Pendaftaran kursus dikonfirmasi','正式课程报名已确认'],
  instruction:['Record how the customer confirmed enrollment; do not repeat the course or amount above. Finance verifies receipt separately.','Catat cara pelanggan mengonfirmasi pendaftaran; tidak perlu mengulang kursus atau nominal di atas. Penerimaan diverifikasi keuangan.','记录客户确认报名的方式及事实，无需重复上方课程和金额；到账由财务核验。'],
  example:['The customer confirmed this course enrollment and final amount due via WhatsApp.','Pelanggan mengonfirmasi pendaftaran kursus dan tagihan akhir ini melalui WhatsApp.','客户通过WhatsApp确认本次课程报名及最终应收。']},
 'progress:paused':{
  summary:['Paused for an explicit reason','Ditunda dengan alasan jelas','有明确原因，暂缓推进'],
  instruction:['Describe the reason for pausing and any agreed time to reconnect.','Jelaskan alasan penundaan dan waktu komunikasi kembali jika disepakati.','说明暂缓原因及已约定的后续沟通时间。'],
  example:['The customer is traveling and asked to resume the course discussion next month.','Pelanggan sedang bepergian dan meminta pembahasan dilanjutkan bulan depan.','客户近期出差，希望下月再讨论课程。']},
 'progress:closed':{
  summary:['This opportunity has ended','Peluang ini sudah berakhir','已明确结束本次推进'],
  instruction:['Describe the customer’s decision or explicit reason for closing.','Jelaskan keputusan pelanggan atau alasan jelas penutupan.','说明结束本次推进的客户决定或明确原因。'],
  example:['The customer chose another course and confirmed they will not proceed with this enrollment.','Pelanggan memilih kursus lain dan memastikan tidak melanjutkan pendaftaran ini.','客户已选择其他课程，确认不再推进本次报名。']},
};
const index=(lang:string)=>lang==='zh'?2:lang==='id'?1:0;
export function stageShortDescription(stage:string,lang:string){return guidance[stage]?.summary[index(lang)]||'';}
export function stageFactsExample(stage:string,lang:string){return guidance[stage]?.example[index(lang)]||'';}
export function stageFactsGuidance(stage:string,lang:string){return guidance[stage]?.instruction[index(lang)]||['Describe the facts supporting the selected stage.','Jelaskan fakta yang mendukung tahap terpilih.','请说明支持所选阶段的具体事实。'][index(lang)];}

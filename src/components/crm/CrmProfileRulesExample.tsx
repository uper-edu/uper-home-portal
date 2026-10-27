import {useState} from 'react';
/** Documentation only: no requests, business writes or notification side effects. */
export function CrmProfileRulesExample({col}:{col:number}){
 const t=(en:string,id:string,zh:string)=>[en,id,zh][col], [selected,setSelected]=useState(0);
 const examples=[
  [t('My course budget is now IDR 1.8 million.','Anggaran kursus saya kini Rp1,8 juta.','整门课程总预算现在调整为180万印尼盾。'),t('Adopt the explicit change; retain the old value and original evidence.','Terapkan perubahan eksplisit; simpan nilai lama dan bukti asli.','采用明确变化，保留旧值及原文依据。')],
  [t('I hope to start next month.','Saya berharap mulai bulan depan.','希望下个月开始。'),t('A current start preference, not a confirmed class or an invented exact date.','Preferensi mulai saat ini, bukan kelas terkonfirmasi atau tanggal pasti buatan.','记录当前开课偏好，不表示已确定班级，不补造具体日期。')],
  [t('I may move to Surabaya next month.','Saya mungkin pindah ke Surabaya bulan depan.','下个月可能搬到泗水。'),t('Retain the statement; do not replace the current city.','Simpan pernyataan; jangan ganti kota saat ini.','保留表达，不覆盖现居城市。')],
  [t('HSK exam preparation; first consolidate HSK 1, then HSK 2.','Persiapan HSK: kuatkan HSK 1 dahulu, lalu HSK 2.','HSK备考：先巩固HSK 1，再准备HSK 2。'),t('Compatible goal detail, not a conflict.','Rincian tujuan yang sesuai, bukan konflik.','相容的目标细节，不产生冲突。')],
  [t('Please ask an advisor to contact me.','Mohon konsultan menghubungi saya.','请顾问联系我。'),t('Record one explicit request per original event. A request is not contact, enrollment or a new task.','Catat satu permintaan eksplisit per kejadian asli. Ini bukan kontak, pendaftaran, atau tugas baru.','按原始事件记录明确请求；不等于已联系、已报名，也不创建新任务。')]
 ];
 return <details className="crm-learning-example"><summary>{t('How original evidence updates the profile','Cara bukti asli memperbarui profil','原文如何更新画像与请求')}</summary><div role="group" aria-label={t('Evidence examples','Contoh bukti','原文示例')}>{examples.map((e,i)=><button className="crm-work-button" type="button" key={i} aria-pressed={selected===i} onClick={()=>setSelected(i)}>{i+1}</button>)}</div><blockquote>{examples[selected][0]}</blockquote><p role="status">{examples[selected][1]}</p><p>{t('Sources and actual times remain traceable. Genuine contradictions retain both records; AI never changes Tier or sales stage.','Sumber dan waktu nyata tetap terlacak. Konflik nyata menyimpan kedua catatan; AI tidak mengubah Tier atau tahap penjualan.','来源与实际发生时间可追溯；真实矛盾保留双方记录，AI不改变Tier或销售阶段。')}</p></details>;
}

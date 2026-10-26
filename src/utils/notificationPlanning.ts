type Language = 'en' | 'id' | 'zh';
const reasons: Record<string,[string,string,string]> = {
  task_missing:['Related task not found','Tugas terkait tidak ditemukan','关联任务不存在'],
  task_completed:['Related task completed','Tugas terkait selesai','关联任务已完成'],
  task_cancelled:['Related task cancelled','Tugas terkait dibatalkan','关联任务已取消'],
  evaluated:['No eligible matching rule or recipient','Tidak ada aturan atau penerima yang sesuai','无符合条件的生效规则或接收对象'],
  routing_review:['Routing review required','Rute penerima perlu ditinjau','通知路由待核实'],
  source_mismatch:['Source does not match','Sumber tidak sesuai','来源不匹配'],
  tier_mismatch:['Customer group does not match','Kelompok pelanggan tidak sesuai','客户分组不匹配'],
  stage_mismatch:['Sales stage does not match','Tahap penjualan tidak sesuai','销售阶段不匹配'],
  routing_unresolved:['No eligible recipient','Tidak ada penerima yang memenuhi syarat','无符合权限的接收对象'],
  appointment_before_activation:['Appointment predates rule activation','Janji sebelum aktivasi aturan','约定时间早于规则启用'],
};
export function notificationPlanningSummary(data: any, lang: Language) {
  const col=lang==='zh'?2:lang==='id'?1:0;
  const reason=(key:string)=>reasons[key]?.[col] || key;
  const count=Number(data?.jobCount||0);
  const summary=count>0
    ? [`${count} notification job(s) linked; check delivery records for the sending result`,`${count} pekerjaan notifikasi terkait; periksa catatan pengiriman untuk hasilnya`,`已关联${count}条通知作业；发送结果请查发送记录`][col]
    : [`No notification job: ${reason(data?.reason)}`,`Tidak ada pekerjaan notifikasi: ${reason(data?.reason)}`,`未生成通知作业：${reason(data?.reason)}`][col];
  const excluded=(data?.exclusions||[]).map((x:any)=>`${x.ruleId}: ${reason(x.reason)}`).join('; ');
  return summary+(excluded?' · '+excluded:'');
}

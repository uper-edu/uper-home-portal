/** New explicit arrangements opt in; existing rows are never backfilled. */
export function executionTime(task:any) {
  if(task?.scheduled_at)return task.scheduled_at;
  if(task?.details?.timeReminderVersion===1 && (task.kind==='contact_review'||['appointment','review'].includes(task.timing_kind)))return task.due_at;
  return null;
}
export function taskNoticeCancellation(task:any,event:string,payload:any) {
  if(!task)return 'Task unavailable';
  if(task.status==='completed')return 'Task completed';
  if(task.status==='cancelled')return 'Task cancelled';
  // Changing an execution appointment cannot erase the original response deadline.
  if(event!=='task.overdue'&&Number(task.details?.noticeRevision||0)!==Number(payload.taskNoticeVersion||0))return 'Task arrangement changed';
  return null;
}
export function timingEventLabel(event:string,task:any,internal:boolean,lang:string) {
  if(event==='commitment.due')return (internal?['Customer agreement due · internal review only','Kesepakatan jatuh tempo · tinjauan internal saja','客户约定已到期 · 仅内部核实']:['Customer agreement due','Kesepakatan pelanggan jatuh tempo','客户约定已到期'])[lang==='zh'?2:lang==='id'?1:0];
  if(event==='task.overdue'&&task?.kind==='consultation'&&!internal)return ['First contact attempt overdue','Percobaan kontak pertama terlambat','首次联系尝试已逾期'][lang==='zh'?2:lang==='id'?1:0];
  const review=task?.kind==='contact_review'||task?.timing_kind==='review';
  const texts=internal||review ? event==='task.appointment_due'
    ? ['Internal review due','Waktu peninjauan internal tiba','内部复查时间已到']
    : event==='task.created' ? ['Internal review scheduled','Peninjauan internal dijadwalkan','已安排内部复查']
    : event==='task.rescheduled' ? ['Internal review rescheduled','Jadwal peninjauan internal diubah','内部复查已改期']
    : event==='task.overdue' ? ['Internal review overdue','Peninjauan internal terlambat','内部复查已逾期'] : ['Internal review','Peninjauan internal','内部核实／复查']
    : event==='task.appointment_due' ? ['Agreed execution time reached','Waktu pelaksanaan yang disepakati tiba','约定执行时间已到'] : null;
  return texts?texts[lang==='zh'?2:lang==='id'?1:0]:event;
}

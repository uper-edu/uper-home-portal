/** Contact facts and contact permission are explicit choices, never inferred from prose. */
export function hasContactDetails(d:any){return ['channel','connectStatus','contactDirection','occurrenceMode','contactLocal'].some(k=>Boolean(d?.[k]));}
export function initialProgressRecord(lead: any, saved?: any) {
  const contact = saved?.recordKind === 'contact' && hasContactDetails(saved);
  return {
    requestId: crypto.randomUUID(), summary: '', channel: '', connectStatus: '',
    expectedRevision: lead.simpleRevision || 0, expectedStage: lead.currentStage,
    expectedStageRevision: lead.stageRevision || 0, workflowVersion: 3,
    ...saved, ...(!contact?{channel:'',connectStatus:'',contactLocal:''}:{}), recordKind: contact ? 'contact' : 'internal',
    occurrenceMode: contact && (saved?.occurrenceMode === 'specified' || saved?.occurrenceMode === 'unknown' || saved?.contactTimeConfirmed) ? saved.occurrenceMode : '',
    contactDirection: contact && ['sales', 'customer'].includes(saved?.contactDirection) ? saved.contactDirection : '',
    expectedContactArrangementVersion: saved?.expectedContactArrangementVersion ?? lead.contactArrangement?.version ?? 0,
    agreementIntent: saved?.agreementIntent ?? (saved?.commitmentChange ? 'update' : saved?.commitmentAction ? 'new' : ''),
    agreementTiming: saved?.agreementTiming ?? (saved?.commitmentLocal ? 'exact' : saved?.commitmentDate ? 'date' : ''),
    alsoNewAgreement: saved?.alsoNewAgreement ?? Boolean(saved?.commitmentChange && saved?.commitmentAction && saved.commitmentChange.status !== 'rescheduled'),
  };
}

export function progressArrangementChoices(state?: string): string[] {
  if (state === 'stopped') return ['', 'active'];
  if (!state || state === 'active') return ['', 'stopped'];
  // Legacy waiting/nurture is never silently interpreted as permission to contact.
  return ['', 'active', 'stopped'];
}

export function progressSaveSummary(result: any, lang = 'zh') {
  const t = (en: string, id: string, zh: string) => lang === 'en' ? en : lang === 'id' ? id : zh;
  const parts = [t('Progress saved', 'Perkembangan disimpan', '进展已保存')];
  if (result.contactRecorded === true) parts.push(t('actual contact recorded', 'kontak nyata dicatat', '实际联系已登记'));
  if (result.contactRecorded === false) parts.push(t('no actual contact recorded', 'tidak ada kontak nyata yang dicatat', '未登记实际联系'));
  if(result.agreementChange)parts.push(({
    created:t('customer agreement added','kesepakatan pelanggan ditambahkan','客户约定已新增'),
    fulfilled:t('customer agreement marked fulfilled','kesepakatan pelanggan ditandai dipenuhi','客户约定已标记履行'),
    cancelled:t('customer agreement cancelled','kesepakatan pelanggan dibatalkan','客户约定已取消'),
    rescheduled:t('customer agreement rescheduled','kesepakatan pelanggan dijadwalkan ulang','客户约定已改约'),
  } as any)[result.agreementChange]||t('customer agreement updated','kesepakatan pelanggan diperbarui','客户约定已更新'));
  if(result.stageUpdated)parts.push(t('sales stage updated','tahap penjualan diperbarui','销售阶段已更新'));
  if(result.stageUpdatePending)parts.push(t('sales stage not updated','tahap penjualan belum diperbarui','销售阶段未更新'));
  parts.push(result.contactPlanChange === 'restored'
    ? t('proactive contact restored', 'kontak proaktif diaktifkan kembali', '已恢复主动联系')
    : result.contactPlanChange === 'stopped'
      ? t('proactive contact stopped', 'kontak proaktif dihentikan', '已停止主动联系')
      : t('contact arrangement unchanged', 'pengaturan kontak tidak berubah', '联系安排未变'));
  if (result.completed || result.completedTaskIds?.length) parts.push(t('first-contact requirement processed', 'kewajiban kontak pertama diproses', '首次联系要求已处理'));
  return parts.join(lang === 'zh' ? '；' : '; ') + (lang === 'zh' ? '。' : '.');
}

export type ChatWorkspaceAction = 'assessment' | 'assessment_result' | 'learning_profile';
export type ChatWorkspaceEntry = {action:ChatWorkspaceAction; language:'zh'|'en'|'id'};

export function chatWorkspaceEntry(action:unknown,language:unknown):ChatWorkspaceEntry|undefined {
  if (action!=='assessment'&&action!=='assessment_result'&&action!=='learning_profile') return;
  if (language!=='zh'&&language!=='en'&&language!=='id') return;
  return {action,language};
}

export function assessmentWorkspaceReply(entry:ChatWorkspaceEntry) {
  if(entry.action==='learning_profile')return;
  if(entry.action==='assessment_result')return {
    zh:'点下方按钮查看测评结果。如果还没有结果，可以从这里开始或继续测评。',
    en:'Use the button below to view your result. If you don’t have a result yet, you can start or resume the assessment here.',
    id:'Gunakan tombol di bawah untuk melihat hasil tes. Jika belum ada hasil, Anda bisa memulai atau melanjutkan tes dari sini.',
  }[entry.language];
  return {
    zh:'可以。点下方按钮即可打开免费的 HSK 摸底测评。',
    en:'Yes. Use the button below to open the free HSK placement assessment.',
    id:'Bisa. Gunakan tombol di bawah untuk membuka tes penempatan HSK gratis.',
  }[entry.language];
}

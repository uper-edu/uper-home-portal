export type ChatWorkspaceAction = 'assessment' | 'assessment_result' | 'learning_profile';
export type ChatWorkspaceEntry = {action:ChatWorkspaceAction; language:'zh'|'en'|'id'};

export function chatWorkspaceEntry(action:unknown,language:unknown):ChatWorkspaceEntry|undefined {
  if (action!=='assessment'&&action!=='assessment_result'&&action!=='learning_profile') return;
  if (language!=='zh'&&language!=='en'&&language!=='id') return;
  return {action,language};
}

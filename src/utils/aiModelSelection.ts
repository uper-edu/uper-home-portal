export const reasoningEfforts=['low','medium','high'] as const;
export type ReasoningEffort=typeof reasoningEfforts[number];
export const defaultReasoningEffort:ReasoningEffort='low';
const reasoningModels=['gpt-6.2-sol','gpt-6.1-sol','gpt-6.1-terra','gpt-6-luna','MiniMax-M3.1-Flash'];
export const claudeModels = ['claude-haiku-5-5', 'claude-sonnet-5-5'] as const;
export const geminiModels = ['gemini-3.5-flash-lite', 'gemini-3.8-flash'] as const;
export const isClaudeModel = (model: string) => claudeModels.some(candidate => candidate === model);
export const isGeminiModel = (model: string) => geminiModels.some(candidate => candidate === model);
export const supportsReasoningEffort=(model:string)=>reasoningModels.includes(model)||isClaudeModel(model)||isGeminiModel(model);

export type AiSelection={
  primary:string;
  fallback:string;
  primaryEffort?:ReasoningEffort;
  fallbackEffort?:ReasoningEffort;
};
export const aiModelSlots=['primary','fallback'] as const;
export const effortField={primary:'primaryEffort',fallback:'fallbackEffort'} as const;

export function selectedReasoningEffort(selection:AiSelection,role:typeof aiModelSlots[number]){
  return supportsReasoningEffort(selection[role])?selection[effortField[role]]??defaultReasoningEffort:undefined;
}

export function sameAiSelection(a:AiSelection,b:AiSelection){
  return aiModelSlots.every(role=>a[role]===b[role]&&selectedReasoningEffort(a,role)===selectedReasoningEffort(b,role));
}

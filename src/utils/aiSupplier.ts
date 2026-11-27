import {claudeModels,geminiModels} from './aiModelSelection.ts';

export const aiSupplierTemplates = {
  anthropic: {name: 'Anthropic (Claude)', endpoint: 'https://api.anthropic.com/v1/messages', models: claudeModels},
  gemini: {name: 'Google (Gemini)', endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', models: geminiModels},
  minimax: {name: 'MiniMax', endpoint: 'https://api.minimax.cn/v1/chat/completions', models: ['MiniMax-M3.1-Flash']},
} as const;

export type AiSupplierId = keyof typeof aiSupplierTemplates;
export type AiSupplier = {id: AiSupplierId; name: string; models: string[]; enabled: boolean; verified?: boolean};
export type AiSupplierView = Omit<AiSupplier,'verified'|'enabled'> & {registered: boolean; credentialReady: boolean; inUse: boolean};
export const aiSupplierIds = Object.keys(aiSupplierTemplates) as AiSupplierId[];

export function isAiSupplierId(id: unknown): id is AiSupplierId {
  return typeof id === 'string' && Object.hasOwn(aiSupplierTemplates, id);
}

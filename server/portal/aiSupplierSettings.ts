import {aiSupplierIds, aiSupplierTemplates, isAiSupplierId, type AiSupplier, type AiSupplierId, type AiSupplierView} from '../../src/utils/aiSupplier.ts';
import {aiModelSlots, type AiSelection} from '../../src/utils/aiModelSelection.ts';
import {aiModels} from '../../src/data/system-defaults/ai.ts';
import type {CredentialClient} from './integrationCredentials.ts';

type Settings = {current: AiSelection; suppliers?: Partial<Record<AiSupplierId, AiSupplier>>};
const usesModel = (settings: Settings, model: string) => aiModelSlots.some(role => settings.current[role] === model);

export function supplierInUse(settings: Settings, id: AiSupplierId) {
  return aiSupplierTemplates[id].models.some(model => usesModel(settings, model));
}

export function supplierViews(settings: Settings, keys: Record<string, boolean>): AiSupplierView[] {
  return aiSupplierIds.flatMap(id => {
    const template = aiSupplierTemplates[id];
    const saved = settings.suppliers?.[id];
    const inUse = supplierInUse(settings, id);
    if (!saved && !keys[id] && !inUse) return [];
    return [{id, name:saved?.name??template.name, models:saved?.models??[...template.models], enabled:saved?.enabled??true,
      registered: !!saved, credentialReady: !!keys[id]&&(!saved||!!saved.verified), inUse}];
  });
}

export function selectableAiModels(settings: Settings, suppliers: AiSupplierView[]): string[] {
  const available = new Set<string>(suppliers.filter(supplier => supplier.enabled && supplier.credentialReady).flatMap(supplier => supplier.models));
  // The older MiniMax model can still use its configured gateway until a direct provider is registered.
  const templateModels = [...aiSupplierTemplates.anthropic.models,...(settings.suppliers?.minimax ? aiSupplierTemplates.minimax.models : [])];
  return aiModels.filter(model => !templateModels.some(candidate => candidate === model) || available.has(model) || usesModel(settings, model));
}

export function managedSupplierForModel(settings: Settings, model: string) {
  return aiSupplierIds.find(id=>settings.suppliers?.[id]&&aiSupplierTemplates[id].models.some(candidate=>candidate===model));
}

function invalid(status: number, message: string): never {
  throw Object.assign(Error(message), {status});
}

export function changeAiSupplier(settings: Settings, input: unknown, credentialReady: boolean, legacyReady: boolean) {
  const {id, action, name, models} = (input ?? {}) as Record<string, unknown>;
  if (!isAiSupplierId(id)) return invalid(400, 'supplier_invalid');
  const current = settings.suppliers?.[id];
  if (action === 'add') {
    if (current || legacyReady || supplierInUse(settings, id)) return invalid(409, 'supplier_exists');
    const template = aiSupplierTemplates[id];
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 80 || /[\u0000-\u001f\u007f]/.test(name) ||
      !Array.isArray(models) || !models.length || new Set(models).size !== models.length ||
      models.some(model => !template.models.some(candidate => candidate === model))) return invalid(400, 'supplier_invalid');
    return {id, name: name.trim(), models: template.models.filter(model => models.includes(model)), enabled: false};
  }
  if (!current || (action !== 'enable' && action !== 'disable')) return invalid(400, 'supplier_invalid');
  if (action === 'enable' && (!credentialReady || !current.verified)) return invalid(409, 'supplier_credential_required');
  if (action === 'disable' && supplierInUse(settings, id)) return invalid(409, 'supplier_in_use');
  return {...current, enabled: action === 'enable'};
}

export async function saveAiSettings(db: CredentialClient, settings: object) {
  await db.query("INSERT INTO portal_settings(id,value) VALUES('ai_service',:p1) ON DUPLICATE KEY UPDATE value=VALUES(value)", [settings]);
}

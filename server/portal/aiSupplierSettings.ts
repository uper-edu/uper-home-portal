import {aiSupplierIds, aiSupplierTemplates, type AiSupplier, type AiSupplierId, type AiSupplierView} from '../../src/utils/aiSupplier.ts';
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
    return [{id, name:saved?.name??template.name, models:saved?.models??[...template.models],
      registered: !!saved, credentialReady: !!keys[id]&&(!saved||!!saved.verified), inUse}];
  });
}

export function selectableAiModels(settings: Settings, suppliers: AiSupplierView[]): string[] {
  const available = new Set<string>(suppliers.filter(supplier => supplier.credentialReady).flatMap(supplier => supplier.models));
  // The older MiniMax model can still use its configured gateway until a direct provider is registered.
  const templateModels = aiSupplierIds.filter(id=>id!=='minimax'||settings.suppliers?.minimax)
    .flatMap(id=>aiSupplierTemplates[id].models as readonly string[]);
  return aiModels.filter(model => !templateModels.some(candidate => candidate === model) || available.has(model) || usesModel(settings, model));
}

export function managedSupplierForModel(settings: Settings, model: string) {
  return aiSupplierIds.find(id=>settings.suppliers?.[id]&&aiSupplierTemplates[id].models.some(candidate=>candidate===model));
}

export async function saveAiSettings(db: CredentialClient, settings: object) {
  await db.query("INSERT INTO portal_settings(id,value) VALUES('ai_service',:p1) ON DUPLICATE KEY UPDATE value=VALUES(value)", [settings]);
}

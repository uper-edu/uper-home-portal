/** Read-only interpretation of historical withdrawal events. New writes use amendments. Follow only explicit event/log references; never infer relationships from text or time. */
export function withdrawnFactIds(facts: any[]): Set<string> {
  const withdrawn = new Set<string>(facts.filter(f => f.kind === 'fact.corrected').map(f => f.data?.correctionOf).filter(Boolean));
  let changed = true;
  while (changed) {
    changed = false;
    const logs = new Set(facts.filter(f => withdrawn.has(f.id) && f.kind === 'followup.recorded').map(f => f.data?.result?.logId).filter(Boolean));
    for (const f of facts) {
      if (f.kind !== 'profile.fields_updated' || withdrawn.has(f.id)) continue;
      if ((f.data?.basisFactIds || []).some((id: string) => withdrawn.has(id)) || (f.data?.sourceRecordId && logs.has(f.data.sourceRecordId))) {
        withdrawn.add(f.id); changed = true;
      }
    }
  }
  return withdrawn;
}

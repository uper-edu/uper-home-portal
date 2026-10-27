/** Read-only profile presentation. Never infer missing evidence or adoption decisions. */
export function profileFieldVisible(lead: any, field: string) {
  const value = lead[field];
  return (
    !!lead.profileFieldMeta?.[field] ||
    (Array.isArray(value)
      ? value.length > 0
      : typeof value === "string"
        ? !!value.trim()
        : value != null)
  );
}

export const profileNeedsGroups: [string, string[]][] = [
  ["学习目标", ["goal", "goals", "targetHskLevel", "hskExamPlan"]],
  ["学习安排", ["mode", "availability", "preferredStart"]],
  [
    "预算与顾虑",
    ["budgetAmount", "concerns"],
  ],
];

export function visibleProfileNeedsGroups(lead: any) {
  return profileNeedsGroups
    .map(([title, fields]) => ({
      title,
      fields: fields.filter((field) => profileFieldVisible(lead, field)),
    }))
    .filter((group) => group.fields.length > 0);
}

export function linkedProfileEvidence(
  events: any[],
  ids: string[],
  leadId: string,
) {
  const all = events.filter((event) => event.leadId === leadId);
  const selected: any[] = [],
    seen = new Set<string>();
  const add = (id: string) => {
    const event = all.find((event) => event.eventId === id);
    if (!event || seen.has(id)) return;
    seen.add(id);
    selected.push(event);
    for (const basis of event.payload?.basisFactIds || []) add(basis);
    const root = event.payload?.sourceRoot;
    if (root?.id) {
      // Multiple ledger entries may point to the same original; retain each explicit link.
      for (const related of all.filter(
        (other) =>
          other.eventId === root.id || other.sourceRecordId === root.id,
      ))
        add(related.eventId);
    }
  };
  ids.forEach(add);
  return selected;
}

export function fieldEvidenceDetails(events: any[], field: string) {
  return events.flatMap((event) => {
    const payload = event.payload || {};
    const changes = (payload.changes || []).filter(
      (change: any) => change.field === field,
    );
    const observations = (payload.observations || []).filter(
      (observation: any) =>
        observation.kind === "field" && observation.field === field,
    );
    const hasAnswer = Object.hasOwn(payload.answers || {}, field);
    if (!hasAnswer && !changes.length && !observations.length) return [];
    return [
      {
        event,
        hasAnswer,
        answer: payload.answers?.[field],
        changes,
        observations,
      },
    ];
  });
}

export function profileChangeReason(
  change: any,
  event: any,
  observations: any[],
) {
  if (change.reason) return change.reason;
  const observation = observations.find(
    (item) =>
      item.field === change.field &&
      JSON.stringify(item.value) ===
        JSON.stringify(
          change.applied === false ? change.observation : change.after,
        ),
  );
  if (observation?.reason) return observation.reason;
  if (
    change.applied === true &&
    (change.adoption === "explicit_sales_edit" ||
      event.payload?.adoption === "explicit_sales_edit")
  )
    return "销售直接编辑，明确采用该值";
  if (change.applied === true && event.payload?.sourceType === "questionnaire")
    return "采用客户问卷原始答案";
  return ""; // Old records may lack a saved reason; do not manufacture one.
}

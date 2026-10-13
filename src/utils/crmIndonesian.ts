import dictionary from "./crm-id.json";
const entries: Record<string, string> = dictionary;
const templates = Object.entries(entries)
  .filter(([key]) => /\{\d+\}/.test(key))
  .map(([key, value]) => {
    const parts = key.split(/(\{\d+\})/);
    const order: string[] = [];
    const pattern = parts
      .map((part) =>
        /^\{\d+\}$/.test(part)
          ? (order.push(part), "([\\s\\S]*?)")
          : part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      )
      .join("");
    return {
      specificity: key.replace(/\{\d+\}/g, "").length,
      pattern: new RegExp("^" + pattern + "$"),
      value,
      order,
    };
  })
  .sort((a, b) => b.specificity - a.specificity);
/** Translate system presentation text only. Never apply to customer names or free text. */
export function crmId<T>(value: T): T {
  if (typeof value !== "string") return value;
  if (Object.hasOwn(entries, value)) return entries[value] as T;
  for (const template of templates) {
    const match = template.pattern.exec(value);
    if (match) {
      const values = Object.fromEntries(
        template.order.map((key, i) => [key, match[i + 1]]),
      );
      return template.value.replace(/\{\d+\}/g, (key) => values[key]) as T;
    }
  }
  return value;
}

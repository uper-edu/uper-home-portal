// Page-memory only. Drafts are scoped to authenticated staff and never shared across accounts.
const staffDrafts = new Map<string, Record<string, any>>();
export function draftsFor(employeeId: string, area = "workflow") {
  const key = JSON.stringify([employeeId, area]);
  let value = staffDrafts.get(key);
  if (!value) {
    value = {};
    staffDrafts.set(key, value);
  }
  return value;
}
export function clearStaffDrafts(employeeId: string) {
  for (const key of staffDrafts.keys())
    if (JSON.parse(key)[0] === employeeId) staffDrafts.delete(key);
}

import {
  defaultLeadFilters,
  dimensions,
  type LeadFilters,
} from "./crmLeadFilters";
/** Clear query conditions without changing presentation or broadening server permissions. */
export function clearLeadConditions(f: LeadFilters): LeadFilters {
  return { ...defaultLeadFilters("all"), sort: f.sort };
}
export const advancedLeadDimensions = [
  "tier",
  "mode",
  "signal",
  "situation",
  "connect",
] as const;
export function leadConditionCount(f: LeadFilters): number {
  return (
    (f.overview?.length||0) +
    Number(!!f.search.trim()) +
    Number(f.ownership !== "all") +
    Number(f.task !== "all") +
    Number(f.workScope === "action") +
    dimensions.reduce((n, k) => n + f[k].length, 0)
  );
}

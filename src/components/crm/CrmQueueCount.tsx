import { useCallback, useEffect, useState } from "react";
import type { CrmLanguage } from "../../utils/crmLanguage";

type Queue = "payments" | "promotion" | "identity";
const endpoints = {
  payments: "/api/crm/payments?summary=1",
  promotion: "/api/crm/campaigns/sources/promotions?summary=1",
  identity: "/api/crm/identity-reviews?summary=1",
};

export function useCrmQueueSummary(queue: Queue, actorId?: string) {
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{
    actorId: string;
    revision: number;
    data?: { pendingCount: number; counts?: Record<string, number> };
  }>();
  const refresh = useCallback(() => setRevision(value => value + 1), []);

  useEffect(() => {
    if (!actorId) {
      setResult(undefined);
      return;
    }
    const controller = new AbortController();
    const load = async () => {
      try {
        const response = await fetch(endpoints[queue], { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw Error("Queue summary unavailable");
        const data = await response.json();
        if (!Number.isSafeInteger(data.pendingCount) || data.pendingCount < 0) throw Error("Invalid queue count");
        if (!controller.signal.aborted) setResult({ actorId, revision, data });
      } catch {
        if (!controller.signal.aborted) setResult({ actorId, revision });
      }
    };
    void load();
    window.addEventListener("focus", refresh);
    window.addEventListener("uper-access-changed", refresh);
    return () => {
      controller.abort();
      window.removeEventListener("focus", refresh);
      window.removeEventListener("uper-access-changed", refresh);
    };
  }, [actorId, queue, refresh, revision]);

  const current = actorId && result?.actorId === actorId && result.revision === revision ? result : undefined;
  return { data: current?.data, loading: Boolean(actorId && !current), refresh };
}

export function crmQueueCountLabel(queue: Queue, count: number, lang: CrmLanguage) {
  if (queue === "identity") {
    if (lang === "zh") return `${count} 条销售线索待核实身份`;
    if (lang === "id") return `${count} prospek perlu verifikasi identitas`;
    return `Leads needing identity review: ${count}`;
  }
  if (lang === "zh") return queue === "payments"
    ? `${count} 项报名待财务处理` : `${count} 位客户的推广来源待核实`;
  if (lang === "id") return queue === "payments"
    ? `${count} pendaftaran perlu ditangani bagian keuangan` : `${count} pelanggan dengan sumber promosi perlu ditinjau`;
  return queue === "payments"
    ? `Enrollments needing finance attention: ${count}` : `Customers with promotion sources to review: ${count}`;
}

export function CrmQueueCount({ queue, count, lang }: { queue: Queue; count?: number; lang: CrmLanguage }) {
  if (!count) return null;
  const label = crmQueueCountLabel(queue, count, lang);
  return <span className="crm-queue-count" title={label}>
    <span aria-hidden="true">{count > 99 ? "99+" : count}</span><span className="sr-only"> {label}</span>
  </span>;
}

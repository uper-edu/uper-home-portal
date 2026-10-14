import { useEffect, useState } from "react";
import { notificationHealth } from "../../utils/crmNotificationHealth";
export function CrmOperationalIssues({ lang, isLight = true }: any) {
  const [issues, setIssues] = useState<{
    failed: number;
    review: number;
  } | null>({ failed: 0, review: 0 });
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const responses = await Promise.all([
          fetch("/api/crm/integration-readiness"),
          fetch("/api/crm/notification-jobs"),
        ]);
        if (responses.some((r) => !r.ok)) throw Error();
        const [ready, jobs] = await Promise.all(responses.map((r) => r.json()));
        if (active) setIssues(notificationHealth(ready, jobs));
      } catch {
        if (active) setIssues(null);
      }
    };
    load();
    const timer = setInterval(load, 10000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);
  const t = (en: string, id: string, zh: string) =>
    lang === "zh" ? zh : lang === "id" ? id : en;
  if (issues && issues.failed === 0 && issues.review === 0) return null;
  const failed = Boolean(issues?.failed);
  return (
    <p
      role={failed ? "alert" : "status"}
      className="crm-operation-status"
      data-theme={isLight ? "light" : "dark"}
      data-tone={failed ? "failed" : "review"}
    >
      {issues ? (
        <>
          {t("Notification failures", "Kegagalan notifikasi", "通知失败")}{" "}
          {issues.failed} ·{" "}
          {t("Outcome unknown", "Hasil tidak diketahui", "结果待核实")}{" "}
          {issues.review}.{" "}
          {t(
            "Review delivery records in Sales Operations.",
            "Tinjau catatan pengiriman di Operasional Penjualan.",
            "请在销售运营的发送记录中核对。",
          )}
        </>
      ) : (
        t(
          "Notification status unavailable; refresh to retry.",
          "Status notifikasi tidak tersedia; segarkan untuk mencoba lagi.",
          "通知状态暂不可查询，请刷新重试。",
        )
      )}
    </p>
  );
}

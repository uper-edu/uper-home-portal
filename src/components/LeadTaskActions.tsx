import { crmId } from "../utils/crmIndonesian";
import { crmError } from "../utils/crmLanguage";
import { useEffect, useState } from "react";
import { describeFollowUpTask, pendingFollowUps } from "../utils/crmFollowUp";
export default function LeadTaskActions({
  leadId,
  readOnly = false,
  isLight,
  lang,
  timezone = "Asia/Jakarta",
  onChange,
  refreshKey,
}: {
  leadId: string;
  readOnly?: boolean;
  isLight: boolean;
  lang: "zh" | "en" | "id";
  timezone?: string;
  onChange: () => void;
  refreshKey?: string;
}) {
  const [tasks, setTasks] = useState<any[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(""),
    [loading, setLoading] = useState(true);
  const load = async (signal?: AbortSignal) => {
    try {
      const r = await fetch(`/api/crm/leads/${leadId}/tasks`, { signal });
      if (!r.ok) throw Error((await r.json()).error || String(r.status));
      const data = await r.json();
      if (signal?.aborted) return;
      setTasks(data);
      setError("");
    } catch (e) {
      if (!signal?.aborted) setError((e as Error).message);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  };
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [leadId, refreshKey]);
  return (
    <section
      className={`p-3 rounded-xl border ${isLight ? "bg-slate-50 border-slate-200" : "bg-slate-950 border-slate-800"}`}
    >
      <h3 className="font-semibold text-xs mb-2">
        {lang === "id"
          ? crmId("Follow-up tasks")
          : lang === "zh"
            ? "待跟进事项"
            : "Follow-up tasks"}
      </h3>
      {error && (
        <p role="alert" className="text-xs text-rose-500">
          {crmError(error, lang)}
        </p>
      )}
      {loading && (
        <p role="status" className="text-xs text-slate-500">
          {lang === "id"
            ? crmId("Loading follow-up tasks…")
            : lang === "zh"
              ? "正在加载跟进事项…"
              : "Loading follow-up tasks…"}
        </p>
      )}
      {pendingFollowUps(
        tasks.map((task) => ({
          ...task,
          dueAt: task.due_at,
          ownerId: task.owner_id,
        })),
      ).map((task) => {
        const display = describeFollowUpTask(task, lang, timezone);
        return (
          <div
            key={task.id}
            className="flex items-center justify-between gap-3 text-xs py-2"
          >
            <div>
              <p>
                {display.action} ·{" "}
                {task.ownerId ||
                  (lang === "id"
                    ? crmId("Unassigned")
                    : lang === "zh"
                      ? "待分配"
                      : "Unassigned")}
              </p>
              <p
                className={
                  display.tone === "overdue"
                    ? "text-rose-500"
                    : "text-slate-500"
                }
              >
                {display.timing}
                {display.deadline !== null && ` (${timezone})`}
              </p>
            </div>
            <button
              type="button"
              disabled={readOnly || busy === task.id}
              className="border rounded-lg px-3 py-1.5"
              onClick={async () => {
                if (readOnly) return;
                setBusy(task.id);
                try {
                  const r = await fetch(
                    `/api/crm/tasks/${task.id}/${task.status === "migration_hold" ? "activate" : "complete"}`,
                    {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: "{}",
                    },
                  );
                  if (!r.ok) throw Error((await r.json()).error);
                  await load();
                  onChange();
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy("");
                }
              }}
            >
              {task.status === "migration_hold"
                ? lang === "id"
                  ? crmId("Activate historical task")
                  : lang === "zh"
                    ? "启用历史待办"
                    : "Activate historical task"
                : lang === "id"
                  ? crmId("Complete follow-up")
                  : lang === "zh"
                    ? "完成跟进"
                    : "Complete follow-up"}
            </button>
          </div>
        );
      })}
      {!error &&
        !loading &&
        !tasks.some((t) =>
          ["open", "overdue", "migration_hold"].includes(t.status),
        ) && (
          <p className="text-xs text-slate-500">
            {lang === "id"
              ? crmId("No pending follow-up")
              : lang === "zh"
                ? "暂无待跟进事项"
                : "No pending follow-up"}
          </p>
        )}
      <p className="text-[10px] text-slate-500 mt-2">
        {lang === "id"
          ? crmId(
              "Viewing clears unread activity. Completing follow-up stops related overdue reminders.",
            )
          : lang === "zh"
            ? "查看客户仅清除未读；完成跟进会停止相关逾期提醒。"
            : "Viewing clears unread activity. Completing follow-up stops related overdue reminders."}
      </p>
    </section>
  );
}

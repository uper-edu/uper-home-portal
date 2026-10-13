import {crmValue,crmError,crmLocale} from '../utils/crmLanguage';
import { useEffect, useState } from "react";
export default function LeadTaskActions({
  leadId,
  readOnly = false,
  isLight,
  lang,
  timezone = "Asia/Jakarta",
  onChange,
}: {
  leadId: string;
  readOnly?: boolean;
  isLight: boolean;
  lang: "zh" | "en";
  timezone?: string;
  onChange: () => void;
}) {
  const [tasks, setTasks] = useState<any[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState("");
  const load = async () => {
    try {
      const r = await fetch(`/api/crm/leads/${leadId}/tasks`);
      if (!r.ok) throw Error((await r.json()).error || String(r.status));
      setTasks(await r.json());
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  };
  useEffect(() => {
    load();
  }, [leadId]);
  return (
    <section
      className={`p-3 rounded-xl border ${isLight ? "bg-slate-50 border-slate-200" : "bg-slate-950 border-slate-800"}`}
    >
      <h3 className="font-semibold text-xs mb-2">
        {lang === "zh" ? "待跟进事项" : "Follow-up tasks"}
      </h3>
      {error && (
        <p role="alert" className="text-xs text-rose-500">
          {crmError(error,lang)}
        </p>
      )}
      {tasks
        .filter((t) => ["open", "overdue", "migration_hold"].includes(t.status))
        .map((task) => (
          <div
            key={task.id}
            className="flex items-center justify-between gap-3 text-xs py-2"
          >
            <div>
              <p>
                {crmValue(task.kind,lang)} ·{" "}
                {task.owner_id || (lang === "zh" ? "待分配" : "Unassigned")}
              </p>
              <p
                className={
                  Date.parse(task.due_at) < Date.now()
                    ? "text-rose-500"
                    : "text-slate-500"
                }
              >
                {lang === "zh" ? "截止" : "Due"}:{" "}
                {new Date(task.due_at).toLocaleString(crmLocale(lang),{timeZone:timezone})} ({timezone})
              </p>
            </div>
            <button
              type="button"
              disabled={readOnly || busy === task.id}
              className="border rounded-lg px-3 py-1.5"
              onClick={async () => {
                if(readOnly)return;
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
                ? lang === "zh"
                  ? "启用历史待办"
                  : "Activate historical task"
                : lang === "zh"
                  ? "完成跟进"
                  : "Complete follow-up"}
            </button>
          </div>
        ))}
      {!error &&
        !tasks.some((t) =>
          ["open", "overdue", "migration_hold"].includes(t.status),
        ) && (
          <p className="text-xs text-slate-500">
            {lang === "zh" ? "暂无待跟进事项" : "No pending follow-up"}
          </p>
        )}
      <p className="text-[10px] text-slate-500 mt-2">
        {lang === "zh"
          ? "查看客户仅清除未读；完成跟进会停止相关逾期提醒。"
          : "Viewing clears unread activity. Completing follow-up stops related overdue reminders."}
      </p>
    </section>
  );
}

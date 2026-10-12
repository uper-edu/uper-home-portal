import { useEffect, useState } from "react";
async function api(url: string, body?: any) {
  const r = await fetch(
    url,
    body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : undefined,
  );
  const data = await r.json();
  if (!r.ok) throw Error(data.error || String(r.status));
  return data;
}
export default function NotificationCenter({
  isLight,
  lang,
}: {
  isLight: boolean;
  lang: "zh" | "en";
}) {
  const [open, setOpen] = useState(false),
    [tab, setTab] = useState("notification-rules"),
    [rows, setRows] = useState<any[]>([]),
    [error, setError] = useState(""),
    [draft, setDraft] = useState(""),
    [key, setKey] = useState(""),
    [simulation, setSimulation] = useState("");
  const load = async () => {
    try {
      const d = await api("/api/crm/" + tab);
      setRows(Array.isArray(d) ? d : d.channels || []);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  };
  useEffect(() => {
    if (!open) return;
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [open, tab]);
  return (
    <section
      className={`p-4 rounded-2xl border ${isLight ? "bg-white text-slate-800 border-slate-200" : "bg-slate-900 text-slate-200 border-slate-800"}`}
    >
      <button onClick={() => setOpen(!open)}>
        {lang === "zh"
          ? "通知设置与发送审计"
          : "Notification settings & delivery audit"}{" "}
        ·{" "}
        {open
          ? lang === "zh"
            ? "收起"
            : "Collapse"
          : lang === "zh"
            ? "打开"
            : "Open"}
      </button>
      {open && (
        <>
          <div className="flex gap-3 my-3">
            {[
              "notification-rules",
              "notification-channels",
              "notification-jobs",
              "notification-audit",
            ].map((t) => (
              <button
                key={t}
                onClick={() => {
                  setTab(t);
                  setDraft("");
                }}
              >
                {
                  (
                    {
                      notifications: "站内消息",
                      tasks: "跟进任务",
                      "notification-rules": "通知策略",
                      "notification-channels": "渠道配置",
                      "notification-jobs": "发送记录",
                      "notification-audit": "修改审计",
                    } as any
                  )[t]
                }
              </button>
            ))}
          </div>
          <p role="alert">{error}</p>
          {tab === "notification-channels" && (
            <p>Email / SMS：未接入。凭据只填写服务端环境变量名称。</p>
          )}
          {rows.map((row) => (
            <article key={row.id} className="border p-3 mb-2">
              {tab === "notifications" ? (
                <p>
                  {row.read_at ? "已读" : "未读"} · {row.content.event} ·{" "}
                  {row.content.name} · {row.content.owner}
                </p>
              ) : tab === "tasks" ? (
                <p>
                  {row.kind} · {row.status} · {row.owner_id || "待分配"} · 截止{" "}
                  {new Date(row.due_at).toLocaleString()}
                </p>
              ) : (
                <pre className="whitespace-pre-wrap">
                  {JSON.stringify(row, null, 2)}
                </pre>
              )}
              {tab === "notifications" && (
                <button
                  onClick={() =>
                    api(`/api/crm/notifications/${row.id}/read`, {}).then(load)
                  }
                >
                  标记已读
                </button>
              )}
              {tab === "tasks" && (
                <button
                  onClick={() =>
                    api(`/api/crm/tasks/${row.id}/complete`, {}).then(load)
                  }
                >
                  完成跟进
                </button>
              )}
              {tab === "notification-rules" && (
                <button
                  onClick={() => {
                    setKey(row.id);
                    setDraft(JSON.stringify(row.config, null, 2));
                  }}
                >
                  编辑策略
                </button>
              )}
            </article>
          ))}
          {tab === "notification-channels" && (
            <button
              onClick={() => {
                setKey("sales");
                setDraft(
                  JSON.stringify(
                    {
                      team: "sales",
                      secretRef: "LARK_SALES_WEBHOOK",
                      mode: "simulation",
                    },
                    null,
                    2,
                  ),
                );
              }}
            >
              配置渠道
            </button>
          )}
          {draft && (
            <div>
              <label>
                标识
                <input value={key} onChange={(e) => setKey(e.target.value)} />
              </label>
              <textarea
                aria-label="配置"
                className="w-full h-96 border"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
              {[false, true].map((enabled) => (
                <button
                  key={String(enabled)}
                  onClick={async () => {
                    try {
                      const config = JSON.parse(draft);
                      await api(
                        `/api/crm/${tab}/${encodeURIComponent(key)}`,
                        tab === "notification-rules"
                          ? { config, enabled }
                          : config,
                      );
                      setDraft("");
                      await load();
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  {enabled ? "启用" : "保存草稿"}
                </button>
              ))}
              {tab === "notification-rules" && (
                <button
                  onClick={async () => {
                    try {
                      setSimulation(
                        JSON.stringify(
                          await api("/api/crm/notification-simulate", {
                            config: JSON.parse(draft),
                          }),
                        ),
                      );
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  模拟发送时间
                </button>
              )}
              <p>{simulation}</p>
            </div>
          )}
        </>
      )}
    </section>
  );
}

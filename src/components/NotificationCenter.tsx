import { useCallback, useEffect, useState } from "react";
import {
  Bell,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Plus,
  Settings2,
  Radio,
  History,
  ShieldCheck,
  Save,
  Play,
  X,
} from "lucide-react";

type Tab =
  | "notification-rules"
  | "notification-channels"
  | "notification-jobs"
  | "notification-audit"
  | "integration-readiness";
interface Rule {
  event: string;
  channels: string[];
  recipient: string;
  team: string;
  group: string;
  sources: string[];
  tiers: string[];
  states: string[];
  teams?: string[];
  timing: string;
  delayMinutes: number;
  digestTime: string;
  businessOnly: boolean;
  timezone: string;
  days: number[];
  start: string;
  end: string;
  dedupeMinutes: number;
  maxPerHour: number;
  retries: number[];
  template: string;
  language: string;
  quiet?: { start: string; end: string };
}
interface Channel {
  team: string;
  secretRef: string;
  mode: string;
  signingSecretRef?: string;
}
interface Row {
  id: string;
  config?: Rule & Channel;
  enabled?: boolean;
  version?: number;
  [key: string]: any;
}
const initialRule: Rule = {
  event: "lead.created",
  channels: ["inapp"],
  recipient: "owner",
  team: "sales",
  group: "crm-test",
  sources: [],
  tiers: [],
  states: [],
  teams: [],
  timing: "immediate",
  delayMinutes: 0,
  digestTime: "18:00",
  businessOnly: true,
  timezone: "Asia/Jakarta",
  days: [1, 2, 3, 4, 5, 6],
  start: "09:00",
  end: "20:00",
  dedupeMinutes: 15,
  maxPerHour: 20,
  retries: [1, 5, 15],
  template: "{{event}} · {{name}} · {{owner}} · {{due}}",
  language: "zh",
};
const eventNames: Record<string, [string, string]> = {
  "lead.created": ["客户登记", "New lead"],
  "conversation.updated": ["聊天更新", "Chat updated"],
  "conversation.reactivated": ["客户重新咨询", "Consultation reopened"],
  "handoff.requested": ["请求人工", "Human follow-up requested"],
  "booking.requested": ["预约申请", "Booking requested"],
  "enrollment.requested": ["报名申请", "Enrollment requested"],
  "assessment.completed": ["评测完成", "Assessment completed"],
  "task.overdue": ["跟进逾期", "Follow-up overdue"],
  "ai.failed": ["AI 调用失败", "AI failure"],
  "notification.failed": ["通知最终失败", "Notification failure"],
  "daily.digest": ["每日汇总", "Daily summary"],
};
const stateNames: Record<string, [string, string]> = {
  pending: ["待发送", "Pending"],
  sending: ["发送中", "Sending"],
  accepted: ["接口接受", "Accepted"],
  simulated: ["模拟完成", "Simulated"],
  failed: ["明确失败", "Failed"],
  unknown: ["结果未知", "Unknown"],
  cancelled: ["已取消", "Cancelled"],
};
async function api(path: string, body?: unknown) {
  const r = await fetch("/api/crm/" + path, {
    method: body === undefined ? "GET" : "POST",
    headers:
      body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok)
    throw Object.assign(new Error(data.error || String(r.status)), {
      status: r.status,
    });
  return data;
}
const split = (text: string) =>
  text
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
export default function NotificationCenter({
  isLight,
  lang,
}: {
  isLight: boolean;
  lang: "zh" | "en";
}) {
  const zh = lang === "zh",
    t = (a: string, b: string) => (zh ? a : b);
  const [open, setOpen] = useState(false),
    [tab, setTab] = useState<Tab>("notification-rules"),
    [rows, setRows] = useState<Row[]>([]),
    [channels, setChannels] = useState<Row[]>([]);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [loading, setLoading] = useState(false),
    [busy, setBusy] = useState(false),
    [denied, setDenied] = useState(false);
  const [editor, setEditor] = useState<"rule" | "channel" | null>(null),
    [key, setKey] = useState(""),
    [existing, setExisting] = useState(false),
    [rule, setRule] = useState<Rule>(initialRule),
    [channel, setChannel] = useState<Channel>({
      team: "sales",
      secretRef: "LARK_GROUP_CRM",
      mode: "simulation",
    });
  const [simulation, setSimulation] = useState<
      { channel: string; at: string }[]
    >([]),
    [simulateAt, setSimulateAt] = useState(""),
    [filter, setFilter] = useState("all"),
    [cancelId, setCancelId] = useState(""),
    [cancelReason, setCancelReason] = useState("");
  const box = `rounded-2xl border ${isLight ? "bg-white border-slate-200/90" : "bg-slate-900 border-slate-800"}`;
  const muted = isLight ? "text-slate-500" : "text-slate-400";
  const input = `w-full h-9 px-3 rounded-lg border text-xs outline-none focus:ring-2 focus:ring-primary-500/30 ${isLight ? "bg-white border-slate-200 text-slate-800" : "bg-slate-950 border-slate-700 text-slate-200"}`;
  const button = `px-3 py-2 rounded-lg border text-xs font-semibold transition-colors disabled:opacity-50 ${isLight ? "border-slate-200 hover:bg-slate-50" : "border-slate-700 hover:bg-slate-800"}`;
  const primary =
    "px-3 py-2 rounded-lg bg-primary-600 hover:bg-primary-500 text-white text-xs font-bold disabled:opacity-50";
  const patch = (value: Partial<Rule>) =>
    setRule((prev) => ({ ...prev, ...value }));
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api(tab);
      setRows(
        tab === "integration-readiness"
          ? [{ id: "status", ...data }]
          : Array.isArray(data)
            ? data
            : data.channels || [],
      );
      if (tab === "notification-rules") {
        const d = await api("notification-channels");
        setChannels(d.channels || []);
      }
      setError("");
      setDenied(false);
    } catch (e) {
      setError((e as Error).message);
      setDenied((e as any).status === 403);
    } finally {
      setLoading(false);
    }
  }, [tab]);
  useEffect(() => {
    if (!open) return;
    void load();
    const timer = setInterval(() => void load(), 10000);
    return () => clearInterval(timer);
  }, [open, load]);
  const format = (value: string | undefined) =>
    value ? new Date(value).toLocaleString(zh ? "zh-CN" : "en-US") : "—";
  const label = (name: string) => eventNames[name]?.[zh ? 0 : 1] || name;
  const field = (title: string, child: React.ReactNode, hint?: string) => (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold">{title}</span>
      {child}
      {hint && <span className={`block text-[11px] ${muted}`}>{hint}</span>}
    </label>
  );
  const text = (
    title: string,
    value: string,
    onChange: (v: string) => void,
    hint?: string,
  ) =>
    field(
      title,
      <input
        className={input}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />,
      hint,
    );
  const list = (
    title: string,
    value: string[],
    onChange: (v: string[]) => void,
    hint?: string,
  ) =>
    field(
      title,
      <input
        key={key + title}
        className={input}
        defaultValue={value.join(", ")}
        onBlur={(e) => onChange(split(e.target.value))}
      />,
      hint,
    );
  const select = (
    title: string,
    value: string,
    options: [string, string][],
    onChange: (v: string) => void,
  ) =>
    field(
      title,
      <select
        className={input}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map(([v, title]) => (
          <option key={v} value={v}>
            {title}
          </option>
        ))}
      </select>,
    );
  const number = (
    title: string,
    value: number,
    onChange: (v: number) => void,
  ) =>
    field(
      title,
      <input
        className={input}
        type="number"
        min="0"
        max="10080"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />,
    );
  const section = (title: string, children: React.ReactNode) => (
    <div
      className={`p-4 rounded-xl border space-y-4 ${isLight ? "bg-slate-50/70 border-slate-200" : "bg-slate-950/40 border-slate-800"}`}
    >
      <h4 className="text-xs font-bold">{title}</h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {children}
      </div>
    </div>
  );
  async function save(enabled: boolean) {
    setBusy(true);
    setError("");
    try {
      if (!/^[a-zA-Z0-9_-]{1,100}$/.test(key))
        throw Error(
          t(
            "标识只能包含字母、数字、横线和下划线",
            "Use letters, numbers, hyphens and underscores for the ID",
          ),
        );
      if (editor === "rule") {
        if (!rule.channels.length)
          throw Error(t("至少选择一个渠道", "Select at least one channel"));
        if (
          rule.channels.includes("lark") &&
          !channels.some((c) => c.id === rule.group)
        )
          throw Error(
            t(
              "请先配置对应的 Lark 群渠道",
              "Configure the selected Lark channel first",
            ),
          );
        await api("notification-rules/" + encodeURIComponent(key), {
          config: rule,
          enabled,
        });
      } else {
        const config = { ...channel };
        if (!config.signingSecretRef) delete config.signingSecretRef;
        await api("notification-channels/" + encodeURIComponent(key), config);
      }
      setEditor(null);
      setNotice(
        editor === "rule"
          ? enabled
            ? t("策略已启用，仅影响新事件", "Policy enabled for new events")
            : t("策略已停用并保存为草稿", "Policy saved as inactive draft")
          : t("渠道配置已保存", "Channel saved"),
      );
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function edit(row?: Row) {
    setNotice("");
    setSimulation([]);
    setSimulateAt("");
    setExisting(!!row);
    setKey(row?.id || "");
    if (tab === "notification-rules") {
      setRule(
        row ? { ...initialRule, ...row.config } : structuredClone(initialRule),
      );
      setEditor("rule");
    } else {
      setChannel(
        row
          ? ({ ...row.config } as Channel)
          : { team: "sales", secretRef: "LARK_GROUP_CRM", mode: "simulation" },
      );
      setEditor("channel");
    }
  }
  const tabs: [Tab, string, typeof Bell][] = [
    ["notification-rules", t("通知策略", "Policies"), Settings2],
    ["notification-channels", t("渠道配置", "Channels"), Radio],
    ["notification-jobs", t("发送记录", "Delivery records"), Bell],
    ["notification-audit", t("修改审计", "Change history"), History],
    ["integration-readiness", t("联调检查", "Integration checks"), ShieldCheck],
  ];
  return (
    <section
      className={`${box} p-5 space-y-4 ${isLight ? "text-slate-800" : "text-slate-200"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex gap-3">
          <span className="p-2 h-fit rounded-xl bg-primary-500/10 text-primary-500">
            <Bell className="w-5 h-5" />
          </span>
          <div>
            <h3 className="font-bold text-sm">
              {t(
                "通知设置与发送审计",
                "Notification settings & delivery audit",
              )}
            </h3>
            <p className={`text-xs mt-1 ${muted}`}>
              {t(
                "配置事件、收件人与发送时间；客户跟进仍在 Leads 列表处理。通知在本区域单独保存，上方保存与重置仅适用于 SLA。",
                "Configure events, recipients and delivery timing. Handle follow-ups in Leads. Save notifications here; the top Save and Reset controls apply to SLA only.",
              )}
            </p>
          </div>
        </div>
        <button
          className={button}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
          <span className="sr-only">
            {t(
              "展开或收起通知设置",
              "Expand or collapse notification settings",
            )}
          </span>
        </button>
      </div>
      {open && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div
              className={`flex flex-wrap gap-1 p-1 rounded-xl border ${isLight ? "bg-slate-100 border-slate-200" : "bg-slate-800 border-slate-700"}`}
            >
              {tabs.map(([value, title, Icon]) => (
                <button
                  key={value}
                  onClick={() => {
                    setTab(value);
                    setRows([]);
                    setEditor(null);
                    setFilter("all");
                    setNotice("");
                    setCancelId("");
                  }}
                  className={`flex gap-1.5 items-center px-3 py-2 rounded-lg text-xs font-semibold ${tab === value ? (isLight ? "bg-white text-primary-700 shadow-2xs" : "bg-primary-600 text-white") : muted}`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {title}
                </button>
              ))}
            </div>
            <button
              className={button}
              onClick={() => void load()}
              disabled={loading}
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
              />
              <span className="sr-only">{t("刷新", "Refresh")}</span>
            </button>
          </div>
          {error && (
            <p
              role="alert"
              className="text-xs p-3 rounded-lg bg-rose-500/10 text-rose-500"
            >
              {denied
                ? t(
                    "此账号没有通知管理权限，请联系管理员。",
                    "This account has no notification management permission.",
                  )
                : error}
            </p>
          )}
          {notice && (
            <p
              role="status"
              className="text-xs p-3 rounded-lg bg-emerald-500/10 text-emerald-600"
            >
              {notice}
            </p>
          )}
          {!denied && (
            <>
              <div className="flex flex-wrap justify-between gap-3 items-center">
                <p className={`text-xs ${muted}`}>
                  {tab === "notification-rules"
                    ? t(
                        "启用仅作用于新事件。已排队任务保留原版本，停用规则不会自动取消它们。",
                        "Activation applies to new events. Queued jobs retain their policy version; disabling does not cancel them.",
                      )
                    : tab === "notification-channels"
                      ? t(
                          "站内提醒显示在 Leads。Lark 用于群通知；Email / SMS 尚未接入。",
                          "In-app reminders appear in Leads. Lark sends group notifications; Email / SMS are not connected.",
                        )
                      : tab === "notification-jobs"
                        ? t(
                            "接口接受不代表员工已读或已跟进。结果未知请人工核查，避免重复发送。",
                            "Accepted does not mean read or followed up. Check unknown results manually before resending.",
                          )
                        : tab === "notification-audit"
                          ? t(
                              "记录策略版本、渠道修改和手动取消操作，最多显示最近 200 条。",
                              "Policy versions, channel changes and cancellations. Latest 200 records.",
                            )
                          : t(
                              "配置检查不代表真实平台联调或群内实收通过。",
                              "Configuration checks do not prove live identity integration or receipt in the group.",
                            )}
                </p>
                {(tab === "notification-rules" ||
                  tab === "notification-channels") &&
                  !editor && (
                    <button
                      className={`${primary} flex items-center gap-1`}
                      onClick={() => edit()}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      {tab === "notification-rules"
                        ? t("新增策略", "Add policy")
                        : t("新增渠道", "Add channel")}
                    </button>
                  )}
              </div>
              {editor && (
                <div
                  className="space-y-4"
                  aria-label={t(
                    "通知配置表单",
                    "Notification configuration form",
                  )}
                >
                  <div className="flex justify-between items-center">
                    <h4 className="text-sm font-bold">
                      {editor === "rule"
                        ? t("编辑通知策略", "Edit notification policy")
                        : t("编辑 Lark 渠道", "Edit Lark channel")}
                    </h4>
                    <button className={button} onClick={() => setEditor(null)}>
                      <X className="w-4 h-4" />
                      <span className="sr-only">
                        {t("关闭编辑", "Close editor")}
                      </span>
                    </button>
                  </div>
                  {field(
                    t("配置标识", "Configuration ID"),
                    <input
                      className={input}
                      value={key}
                      disabled={existing}
                      onChange={(e) => setKey(e.target.value)}
                      placeholder="crm-followup"
                    />,
                    t(
                      "唯一标识；保存后不可在此修改。",
                      "Unique ID; cannot be renamed after saving.",
                    ),
                  )}
                  {editor === "rule" ? (
                    <>
                      {section(
                        t("1 · 事件与筛选", "1 · Event and filters"),
                        <>
                          {select(
                            t("业务事件", "Business event"),
                            rule.event,
                            Object.entries(eventNames).map(([v, n]) => [
                              v,
                              n[zh ? 0 : 1],
                            ]),
                            (v) => patch({ event: v }),
                          )}
                          {list(
                            t("来源筛选", "Sources"),
                            rule.sources,
                            (v) => patch({ sources: v }),
                            t(
                              "留空表示全部；用逗号分隔来源标识。",
                              "Empty means all; comma-separated source IDs.",
                            ),
                          )}
                          {list(
                            t("客户等级", "Lead tiers"),
                            rule.tiers,
                            (v) => patch({ tiers: v }),
                            "Hot, Warm, Cold",
                          )}
                          {list(
                            t("业务状态", "Business states"),
                            rule.states,
                            (v) => patch({ states: v }),
                          )}
                          {list(
                            t("团队筛选", "Team filters"),
                            rule.teams || [],
                            (v) => patch({ teams: v }),
                          )}
                        </>,
                      )}
                      {section(
                        t("2 · 收件人与渠道", "2 · Recipients and channels"),
                        <>
                          {select(
                            t("站内收件人", "In-app recipients"),
                            rule.recipient,
                            [
                              [
                                "owner",
                                t(
                                  "负责人（无负责人转团队）",
                                  "Owner (team if unassigned)",
                                ),
                              ],
                              ["team", t("指定团队", "Team")],
                              ["supervisor", t("主管", "Supervisors")],
                            ],
                            (v) => patch({ recipient: v }),
                          )}
                          {text(t("团队标识", "Team ID"), rule.team, (v) =>
                            patch({ team: v }),
                          )}
                          {field(
                            t("通知渠道", "Delivery channels"),
                            <div className="flex gap-4 py-2 text-xs">
                              {["inapp", "lark"].map((c) => (
                                <label
                                  key={c}
                                  className="flex gap-2 items-center"
                                >
                                  <input
                                    type="checkbox"
                                    checked={rule.channels.includes(c)}
                                    onChange={(e) =>
                                      patch({
                                        channels: e.target.checked
                                          ? [...rule.channels, c]
                                          : rule.channels.filter(
                                              (x) => x !== c,
                                            ),
                                      })
                                    }
                                  />
                                  {c === "inapp"
                                    ? t("Leads 站内提醒", "Leads reminder")
                                    : "Lark"}
                                </label>
                              ))}
                            </div>,
                          )}
                          {rule.channels.includes("lark") &&
                            select(
                              t("Lark 群渠道", "Lark group channel"),
                              rule.group,
                              [
                                [rule.group, rule.group],
                                ...channels
                                  .filter((c) => c.id !== rule.group)
                                  .map(
                                    (c) =>
                                      [
                                        c.id,
                                        `${c.id} · ${c.config?.mode === "live" ? t("真实发送", "Live") : t("模拟", "Simulation")}`,
                                      ] as [string, string],
                                  ),
                              ],
                              (v) => patch({ group: v }),
                            )}
                        </>,
                      )}
                      {section(
                        t("3 · 发送时间", "3 · Delivery timing"),
                        <>
                          {rule.event === "daily.digest"
                            ? field(
                                t("汇总时间模式", "Summary timing"),
                                <p className="text-xs py-2">
                                  {t(
                                    "按工作日和每日汇总时间生成事件",
                                    "Generated on configured days at the daily summary time",
                                  )}
                                </p>,
                              )
                            : select(
                                t("发送方式", "Timing"),
                                rule.timing,
                                [
                                  ["immediate", t("立即", "Immediately")],
                                  ["delay", t("延迟", "Delay")],
                                  [
                                    "digest",
                                    t(
                                      "顺延至当日汇总时间",
                                      "Defer to summary time",
                                    ),
                                  ],
                                ],
                                (v) => patch({ timing: v }),
                              )}
                          {rule.timing === "delay" &&
                            number(
                              t("延迟分钟", "Delay minutes"),
                              rule.delayMinutes,
                              (v) => patch({ delayMinutes: v }),
                            )}
                          {field(
                            t("每日汇总时间", "Daily summary time"),
                            <input
                              className={input}
                              type="time"
                              value={rule.digestTime}
                              onChange={(e) =>
                                patch({ digestTime: e.target.value })
                              }
                            />,
                          )}
                          {text(
                            t("时区", "Timezone"),
                            rule.timezone,
                            (v) => patch({ timezone: v }),
                            "Asia/Jakarta",
                          )}
                          {field(
                            t("Lark 工作时间限制", "Lark business hours"),
                            <label className="flex gap-2 text-xs py-2">
                              <input
                                type="checkbox"
                                checked={rule.businessOnly}
                                onChange={(e) =>
                                  patch({ businessOnly: e.target.checked })
                                }
                              />
                              {t(
                                "仅在工作时间发送",
                                "Send only during business hours",
                              )}
                            </label>,
                            t(
                              "站内提醒始终即时产生。",
                              "In-app reminders are always immediate.",
                            ),
                          )}
                          {field(
                            t("工作时间开始", "Business hours start"),
                            <input
                              className={input}
                              type="time"
                              value={rule.start}
                              onChange={(e) => patch({ start: e.target.value })}
                            />,
                          )}
                          {field(
                            t("工作时间结束", "Business hours end"),
                            <input
                              className={input}
                              type="time"
                              value={rule.end}
                              onChange={(e) => patch({ end: e.target.value })}
                            />,
                          )}
                          {field(
                            t("工作日", "Working days"),
                            <div className="flex flex-wrap gap-2 py-2">
                              {(zh
                                ? ["日", "一", "二", "三", "四", "五", "六"]
                                : ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]
                              ).map((d, i) => (
                                <label key={i} className="text-xs flex gap-1">
                                  <input
                                    type="checkbox"
                                    checked={rule.days.includes(i)}
                                    onChange={(e) =>
                                      patch({
                                        days: e.target.checked
                                          ? [...rule.days, i].sort()
                                          : rule.days.filter((x) => x !== i),
                                      })
                                    }
                                  />
                                  {d}
                                </label>
                              ))}
                            </div>,
                          )}
                          {field(
                            t("静默时段", "Quiet hours"),
                            <label className="flex gap-2 py-2 text-xs">
                              <input
                                type="checkbox"
                                checked={!!rule.quiet}
                                onChange={(e) =>
                                  patch({
                                    quiet: e.target.checked
                                      ? { start: "22:00", end: "08:00" }
                                      : undefined,
                                  })
                                }
                              />
                              {t(
                                "启用 Lark 静默时段",
                                "Enable Lark quiet hours",
                              )}
                            </label>,
                          )}
                          {rule.quiet && (
                            <>
                              {field(
                                t("静默开始", "Quiet hours start"),
                                <input
                                  className={input}
                                  type="time"
                                  value={rule.quiet.start}
                                  onChange={(e) =>
                                    patch({
                                      quiet: {
                                        ...rule.quiet!,
                                        start: e.target.value,
                                      },
                                    })
                                  }
                                />,
                              )}
                              {field(
                                t("静默结束", "Quiet hours end"),
                                <input
                                  className={input}
                                  type="time"
                                  value={rule.quiet.end}
                                  onChange={(e) =>
                                    patch({
                                      quiet: {
                                        ...rule.quiet!,
                                        end: e.target.value,
                                      },
                                    })
                                  }
                                />,
                              )}
                            </>
                          )}
                        </>,
                      )}
                      {section(
                        t(
                          "4 · 去重、重试与内容",
                          "4 · Deduplication, retries and content",
                        ),
                        <>
                          {number(
                            t(
                              "Lark 合并窗口（分钟）",
                              "Lark deduplication window (minutes)",
                            ),
                            rule.dedupeMinutes,
                            (v) => patch({ dedupeMinutes: v }),
                          )}
                          {number(
                            t("每群每小时发送上限", "Hourly limit per group"),
                            rule.maxPerHour,
                            (v) => patch({ maxPerHour: v }),
                          )}
                          {list(
                            t(
                              "暂时失败重试间隔（分钟）",
                              "Transient failure retry delays (minutes)",
                            ),
                            rule.retries.map(String),
                            (v) => patch({ retries: v.map(Number) }),
                            t(
                              "默认 1, 5, 15；结果未知不自动重发。",
                              "Default 1, 5, 15; unknown results are not retried automatically.",
                            ),
                          )}
                          {select(
                            t("模板语言", "Template language"),
                            rule.language,
                            [
                              ["zh", "中文"],
                              ["en", "English"],
                              ["id", "Bahasa Indonesia"],
                            ],
                            (v) => patch({ language: v }),
                          )}
                          <div className="sm:col-span-2 lg:col-span-3">
                            {field(
                              t("消息摘要模板", "Message summary template"),
                              <textarea
                                className={`${input} h-24 py-2`}
                                value={rule.template}
                                maxLength={2000}
                                onChange={(e) =>
                                  patch({ template: e.target.value })
                                }
                              />,
                              t(
                                "可用变量：{{event}}、{{name}}、{{owner}}、{{due}}。语言不会自动翻译模板。",
                                "Variables: {{event}}, {{name}}, {{owner}}, {{due}}. Language does not translate the template.",
                              ),
                            )}
                          </div>
                        </>,
                      )}
                      <div className={`${box} p-4 space-y-3`}>
                        <h4 className="text-xs font-bold">
                          {t(
                            "时间预览 · 不发送消息",
                            "Timing preview · no messages sent",
                          )}
                        </h4>
                        <div className="flex flex-wrap gap-3 items-end">
                          <div>
                            {field(
                              t(
                                "模拟事件时间（本机时区）",
                                "Simulated event time (browser timezone)",
                              ),
                              <input
                                className={input}
                                type="datetime-local"
                                value={simulateAt}
                                onChange={(e) => setSimulateAt(e.target.value)}
                              />,
                            )}
                          </div>
                          <button
                            className={`${button} flex gap-1 items-center`}
                            disabled={busy}
                            onClick={async () => {
                              setBusy(true);
                              try {
                                const d = await api("notification-simulate", {
                                  config:
                                    rule.event === "daily.digest"
                                      ? { ...rule, timing: "digest" }
                                      : rule,
                                  ...(simulateAt
                                    ? { at: new Date(simulateAt).toISOString() }
                                    : {}),
                                });
                                setSimulation(d.sendAt);
                                setError("");
                              } catch (e) {
                                setError((e as Error).message);
                              } finally {
                                setBusy(false);
                              }
                            }}
                          >
                            <Play className="w-3.5 h-3.5" />
                            {t("预览发送时间", "Preview delivery timing")}
                          </button>
                        </div>
                        {simulation.map((s) => (
                          <p key={s.channel} className="text-xs">
                            {s.channel} · {format(s.at)}
                          </p>
                        ))}
                      </div>
                    </>
                  ) : (
                    <>
                      {section(
                        t("Lark 群连接", "Lark group connection"),
                        <>
                          {text(t("团队标识", "Team ID"), channel.team, (v) =>
                            setChannel({ ...channel, team: v }),
                          )}
                          {select(
                            t("发送模式", "Delivery mode"),
                            channel.mode,
                            [
                              ["simulation", t("模拟发送", "Simulation")],
                              [
                                "live",
                                t("真实发送至群", "Live group delivery"),
                              ],
                            ],
                            (v) => setChannel({ ...channel, mode: v }),
                          )}
                          {text(
                            t(
                              "Webhook 环境变量名",
                              "Webhook environment variable",
                            ),
                            channel.secretRef,
                            (v) => setChannel({ ...channel, secretRef: v }),
                            t(
                              "填写 LARK_GROUP_CRM 等变量名，不填写 URL。",
                              "Use a variable name such as LARK_GROUP_CRM, not the URL.",
                            ),
                          )}
                          {text(
                            t(
                              "签名密钥变量名（可选）",
                              "Signing secret variable (optional)",
                            ),
                            channel.signingSecretRef || "",
                            (v) =>
                              setChannel({ ...channel, signingSecretRef: v }),
                            t(
                              "未启用签名验证时留空。",
                              "Leave empty when signature verification is disabled.",
                            ),
                          )}
                        </>,
                      )}
                      <p className={`text-xs ${muted}`}>
                        {t(
                          "切换为真实发送会影响引用此渠道的待发送任务。测试环境仅允许指定测试群；保存配置不会发送测试消息。",
                          "Live mode affects pending jobs that reference this channel. Test environments allow only the designated group. Saving does not send a test message.",
                        )}
                      </p>
                    </>
                  )}
                  <div className="flex flex-wrap gap-2 justify-end">
                    {editor === "rule" && (
                      <button
                        className={button}
                        disabled={busy}
                        onClick={() => void save(false)}
                      >
                        {t("保存为停用草稿", "Save inactive draft")}
                      </button>
                    )}
                    <button
                      className={`${primary} flex items-center gap-1`}
                      disabled={busy}
                      onClick={() => void save(true)}
                    >
                      <Save className="w-3.5 h-3.5" />
                      {busy
                        ? t("保存中…", "Saving…")
                        : editor === "rule"
                          ? t("保存并启用", "Save and enable")
                          : t("保存渠道", "Save channel")}
                    </button>
                  </div>
                </div>
              )}
              {!editor && (
                <>
                  {rows.length === 0 && !loading && (
                    <p className={`text-xs text-center py-8 ${muted}`}>
                      {t("暂无记录", "No records yet")}
                    </p>
                  )}
                  {tab === "notification-rules" && (
                    <div className="grid md:grid-cols-2 gap-3">
                      {rows.map((row) => (
                        <article
                          key={row.id}
                          className={`${box} p-4 space-y-3`}
                        >
                          <div className="flex justify-between gap-2">
                            <h4 className="font-bold text-sm">
                              {label(row.config!.event)}
                            </h4>
                            <span
                              className={`text-[11px] rounded-md px-2 py-1 ${row.enabled ? "bg-emerald-500/10 text-emerald-600" : "bg-slate-500/10 " + muted}`}
                            >
                              {row.enabled
                                ? t("已启用", "Enabled")
                                : t("停用 / 草稿", "Inactive / draft")}
                            </span>
                          </div>
                          <p className={`text-[11px] ${muted}`}>
                            {row.id} · v{row.version}
                          </p>
                          <p className="text-xs">
                            {row
                              .config!.channels.map((c) =>
                                c === "inapp"
                                  ? t("Leads 提醒", "Leads reminder")
                                  : c,
                              )
                              .join(" + ")}{" "}
                            ·{" "}
                            {row.config!.recipient === "owner"
                              ? t("负责人", "Owner")
                              : row.config!.recipient === "supervisor"
                                ? t("主管", "Supervisors")
                                : row.config!.team}
                          </p>
                          <p className={`text-xs ${muted}`}>
                            {row.config!.timing === "immediate"
                              ? t("立即发送", "Immediate")
                              : row.config!.timing === "delay"
                                ? `${row.config!.delayMinutes} ${t("分钟延迟", "minute delay")}`
                                : t("汇总时间", "Summary time")}{" "}
                            · {row.config!.timezone}
                            {row.config!.businessOnly
                              ? " · " + t("遵守工作时间", "Business hours")
                              : ""}
                          </p>
                          <button className={button} onClick={() => edit(row)}>
                            {t("编辑策略", "Edit policy")}
                          </button>
                        </article>
                      ))}
                    </div>
                  )}
                  {tab === "notification-channels" && (
                    <div className="grid md:grid-cols-2 gap-3">
                      {rows.map((row) => (
                        <article
                          key={row.id}
                          className={`${box} p-4 space-y-3`}
                        >
                          <h4 className="font-bold text-sm">Lark · {row.id}</h4>
                          <p className="text-xs">
                            {t("团队", "Team")}：{row.config!.team} ·{" "}
                            {row.config!.mode === "live"
                              ? t("真实发送", "Live")
                              : t("模拟发送", "Simulation")}
                          </p>
                          <p className={`text-xs ${muted}`}>
                            {t("Webhook 变量", "Webhook variable")}：
                            {row.config!.secretRef}
                          </p>
                          <button className={button} onClick={() => edit(row)}>
                            {t("编辑渠道", "Edit channel")}
                          </button>
                        </article>
                      ))}
                      {["Email", "SMS"].map((c) => (
                        <article key={c} className={`${box} p-4 opacity-60`}>
                          <h4 className="font-bold text-sm">{c}</h4>
                          <p className={`text-xs mt-2 ${muted}`}>
                            {t(
                              "未接入 · 暂不可发送",
                              "Not connected · unavailable for delivery",
                            )}
                          </p>
                        </article>
                      ))}
                    </div>
                  )}
                  {tab === "notification-jobs" && (
                    <>
                      <div className="max-w-xs">
                        {select(
                          t("发送状态", "Delivery state"),
                          filter,
                          [
                            ["all", t("全部状态", "All states")],
                            ...Object.entries(stateNames).map(
                              ([v, n]) =>
                                [v, n[zh ? 0 : 1]] as [string, string],
                            ),
                          ],
                          setFilter,
                        )}
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                          <thead className={muted}>
                            <tr>
                              {[
                                t("事件 / 客户", "Event / lead"),
                                t("渠道 / 收件人", "Channel / recipient"),
                                t("状态", "State"),
                                t("计划时间 / 次数", "Scheduled / attempts"),
                                t("结果 / 操作", "Result / action"),
                              ].map((s) => (
                                <th key={s} className="p-3 whitespace-nowrap">
                                  {s}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {rows
                              .filter(
                                (r) => filter === "all" || r.state === filter,
                              )
                              .map((row) => (
                                <tr
                                  key={row.id}
                                  className={`border-t ${isLight ? "border-slate-200" : "border-slate-800"}`}
                                >
                                  <td className="p-3">
                                    <p>{label(row.snapshot?.event || "")}</p>
                                    {row.snapshot?.leadId && (
                                      <a
                                        className="text-primary-500 underline"
                                        href={
                                          "/crm?lead=" +
                                          encodeURIComponent(
                                            row.snapshot.leadId,
                                          )
                                        }
                                      >
                                        {t("查看客户", "View lead")}
                                      </a>
                                    )}
                                    <p className={`text-[10px] ${muted}`}>
                                      {row.id}
                                    </p>
                                  </td>
                                  <td className="p-3">
                                    {row.channel}
                                    <br />
                                    {row.recipient}
                                  </td>
                                  <td className="p-3">
                                    <span
                                      className={`whitespace-nowrap ${row.state === "failed" || row.state === "unknown" ? "text-rose-500" : row.state === "accepted" ? "text-emerald-600" : muted}`}
                                    >
                                      {stateNames[row.state]?.[zh ? 0 : 1] ||
                                        row.state}
                                    </span>
                                  </td>
                                  <td className="p-3 whitespace-nowrap">
                                    {format(row.due_at)}
                                    <br />
                                    {row.attempts} {t("次", "attempts")} · v
                                    {row.version}
                                  </td>
                                  <td className="p-3 max-w-xs break-words">
                                    {row.result || "—"}
                                    {row.state === "pending" && (
                                      <button
                                        className={`${button} block mt-2`}
                                        onClick={() => {
                                          setCancelId(row.id);
                                          setCancelReason("");
                                        }}
                                      >
                                        {t("取消通知", "Cancel notification")}
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                      {cancelId && (
                        <div className={`${box} p-4 space-y-3`}>
                          {text(
                            t("取消原因", "Cancellation reason"),
                            cancelReason,
                            setCancelReason,
                          )}
                          <p className={`text-xs ${muted}`}>
                            {t(
                              "仅取消这条通知，不完成客户跟进任务。",
                              "Cancels this notification only; does not complete follow-up.",
                            )}
                          </p>
                          <div className="flex gap-2">
                            <button
                              className={primary}
                              disabled={busy || !cancelReason.trim()}
                              onClick={async () => {
                                setBusy(true);
                                try {
                                  await api(
                                    "notification-jobs/" +
                                      encodeURIComponent(cancelId) +
                                      "/cancel",
                                    { reason: cancelReason },
                                  );
                                  setCancelId("");
                                  setNotice(
                                    t("通知已取消", "Notification cancelled"),
                                  );
                                  await load();
                                } catch (e) {
                                  setError((e as Error).message);
                                } finally {
                                  setBusy(false);
                                }
                              }}
                            >
                              {t("确认取消", "Confirm cancellation")}
                            </button>
                            <button
                              className={button}
                              onClick={() => setCancelId("")}
                            >
                              {t("保留通知", "Keep notification")}
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                  {tab === "notification-audit" && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead className={muted}>
                          <tr>
                            {[
                              t("操作人", "Actor"),
                              t("操作", "Action"),
                              t(
                                "对象 / 版本 / 原因",
                                "Object / version / reason",
                              ),
                            ].map((s) => (
                              <th className="p-3" key={s}>
                                {s}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row) => (
                            <tr
                              key={row.id}
                              className={`border-t ${isLight ? "border-slate-200" : "border-slate-800"}`}
                            >
                              <td className="p-3">{row.actor}</td>
                              <td className="p-3">
                                {{
                                  "rule.save": t("保存策略", "Policy saved"),
                                  "channel.save": t(
                                    "保存渠道",
                                    "Channel saved",
                                  ),
                                  "notification.cancel": t(
                                    "取消通知",
                                    "Notification cancelled",
                                  ),
                                }[row.action] || row.action}
                              </td>
                              <td className="p-3 break-words">
                                {row.data?.id || row.data?.jobId || "—"}
                                {row.data?.version
                                  ? " · v" + row.data.version
                                  : ""}
                                {row.data?.reason
                                  ? " · " + row.data.reason
                                  : ""}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {tab === "integration-readiness" &&
                    rows.map((row) => (
                      <div key={row.id} className="space-y-3">
                        <div className={`${box} p-4`}>
                          <h4 className="text-xs font-bold">
                            {t(
                              "员工身份与权限",
                              "Employee identity and permissions",
                            )}
                          </h4>
                          <p className={`text-xs mt-2 ${muted}`}>
                            {t("当前模式", "Current mode")}：
                            {row.identity?.mode} ·{" "}
                            {t(
                              "真实平台联调尚未确认",
                              "Live platform integration is not confirmed",
                            )}
                          </p>
                        </div>
                        <div className="grid md:grid-cols-2 gap-3">
                          {row.channels?.map((c: any) => (
                            <div
                              key={c.id}
                              className={`${box} p-4 text-xs space-y-2`}
                            >
                              <h4 className="font-bold">Lark · {c.id}</h4>
                              <p>
                                {t("Webhook 配置", "Webhook configured")}：
                                {c.webhookConfigured
                                  ? t("是", "Yes")
                                  : t("否", "No")}
                              </p>
                              <p>
                                {t(
                                  "签名配置满足要求",
                                  "Signature requirements met",
                                )}
                                ：
                                {c.signingSecretConfigured
                                  ? t("是", "Yes")
                                  : t("否", "No")}
                              </p>
                              <p>
                                {t("指定测试群", "Designated test group")}：
                                {c.designatedTestGroup
                                  ? t("是", "Yes")
                                  : t("否", "No")}
                              </p>
                              <p className={muted}>
                                {t(
                                  "群内实收需结合发送记录和验收报告确认。",
                                  "Confirm group receipt using delivery records and acceptance reports.",
                                )}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                </>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}

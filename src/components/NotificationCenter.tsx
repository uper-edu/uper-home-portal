import { CrmSingleSelect } from "./crm/CrmSingleSelect";
import { crmId } from "../utils/crmIndonesian";
import {
  crmLocale,
  crmValue,
  crmError,
  crmDeliveryResult,
} from "../utils/crmLanguage";
import SearchableChoices from "./SearchableChoices";
import { useCallback, useEffect, useRef, useState } from "react";
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
  calendarMode?: "inherit" | "custom";
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
  quiet?: {
    start: string;
    end: string;
  };
}
interface Channel {
  maxPerHour?: number;
  groupName?: string;
  teamName?: string;
  team?: string;
  secretRef?: string;
  mode: string;
  signingEnabled?: boolean;
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
  calendarMode: "inherit",
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
  navigationRequest = 0,
}: {
  isLight: boolean;
  lang: "zh" | "en" | "id";
  navigationRequest?: number;
}) {
  const panelRef = useRef<HTMLElement>(null);
  const zh = lang === "zh",
    t = (a: string, b: string) => (lang === "id" ? crmId(b) : zh ? a : b);
  const [open, setOpen] = useState(false),
    [tab, setTab] = useState<Tab>("notification-rules"),
    [rows, setRows] = useState<Row[]>([]),
    [channels, setChannels] = useState<Row[]>([]);
  useEffect(() => {
    if (navigationRequest > 0) setOpen(true);
  }, [navigationRequest]);
  useEffect(() => {
    if (navigationRequest > 0 && open)
      panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [navigationRequest, open]);
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
      secretRef: "",
      mode: "simulation",
      maxPerHour: 20,
    });
  const [filterOptions, setFilterOptions] = useState<Record<string, string[]>>({
    sources: [],
    tiers: [],
    states: [],
    teams: [],
  });
  useEffect(() => setNotice(""), [lang]);
  const [routing, setRouting] = useState<any>(null);
  const [globalCalendar, setGlobalCalendar] = useState({
    timezone: "Asia/Jakarta",
    start: "09:00",
    end: "20:00",
    days: [1, 2, 3, 4, 5, 6],
    source: "fallback",
  });
  const [simulation, setSimulation] = useState<
      {
        channel: string;
        at: string;
      }[]
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
  const patch = (value: Partial<Rule>) => {
    setRule((prev) => ({ ...prev, ...value }));
    setSimulation([]);
  };
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
        const [d, calendar, options, routingConfig] = await Promise.all([
          api("notification-channels"),
          api("notification-calendar"),
          api("notification-options"),
          api("notification-routing"),
        ]);
        setChannels(d.channels || []);
        setGlobalCalendar(calendar);
        setFilterOptions(options);
        setRouting(routingConfig);
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
    value ? new Date(value).toLocaleString(crmLocale(lang)) : "—";
  const label = (name: string) =>
    (lang === "id"
      ? crmId(eventNames[name]?.[1])
      : eventNames[name]?.[zh ? 0 : 1]) || name;
  const connectionLabel = (row: Row) =>
    (
      ({
        simulation: t("模拟模式 · 不真实发送", "Simulation · no live delivery"),
        missing_webhook: t(
          "未连接 · 缺少 机器人连接",
          "Not connected · missing Webhook",
        ),
        missing_signing_secret: t(
          "未连接 · 缺少签名密钥",
          "Not connected · missing signing secret",
        ),
        test_group_blocked: t(
          "受限 · 非指定测试群",
          "Blocked · not designated test group",
        ),
        configured: t(
          "已配置 · 待群内实收确认",
          "Configured · group receipt not verified",
        ),
      }) as Record<string, string>
    )[row.connection?.status] ||
    t("配置状态未确认", "Configuration status unverified");
  const groupLabel = (row: Row) =>
    `${row.config?.groupName || t("未命名群", "Unnamed group")} · ${connectionLabel(row)}`;
  const calendarSummary = `${globalCalendar.timezone} · ${globalCalendar.start}–${globalCalendar.end} · ${globalCalendar.days.map((d) => (zh ? ["日", "一", "二", "三", "四", "五", "六"] : lang === "id" ? ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"] : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"])[d]).join(", ")}`;
  const timed = rule.channels.includes("lark") || rule.event === "daily.digest";
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
      <CrmSingleSelect label={title} value={value} options={options.map(([value, label]) => ({ value, label }))} onChange={onChange} lang={lang} isLight={isLight} />,
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
      if (!/^[a-zA-Z0-9_.-]{1,100}$/.test(key))
        throw Error(
          t(
            "标识只能包含字母、数字、点、横线和下划线",
            "Use letters, numbers, dots, hyphens and underscores for the ID",
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
        if (!config.groupName?.trim())
          throw Error(t("请填写实际群名称", "Enter the group name"));
        delete config.team;
        delete config.teamName;
        if (config.mode === "simulation") {
          delete config.secretRef;
          delete config.signingSecretRef;
          delete config.signingEnabled;
        } else {
          if (!config.secretRef?.trim())
            throw Error(
              t(
                "真实发送需要 机器人连接 配置引用",
                "Live delivery requires a Webhook reference",
              ),
            );
          config.signingEnabled = !!config.signingEnabled;
          if (config.signingEnabled && !config.signingSecretRef?.trim())
            throw Error(
              t(
                "开启签名验证后需填写签名密钥引用",
                "Signing requires a secret reference",
              ),
            );
          if (!config.signingEnabled) delete config.signingSecretRef;
        }
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
          ? ({
              ...row.config,
              signingEnabled:
                row.config?.signingEnabled ?? !!row.config?.signingSecretRef,
              maxPerHour:
                row.rateLimit?.maxPerHour ?? row.config?.maxPerHour ?? 20,
            } as Channel)
          : {
              team: "sales",
              secretRef: "",
              mode: "simulation",
              maxPerHour: 20,
            },
      );
      if (!row) setKey("lark-" + crypto.randomUUID().slice(0, 12));
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
      ref={panelRef}
      style={{ scrollMarginTop: 128 }}
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
                "7. 通知设置与发送审计",
                "7. Notification settings & delivery audit",
              )}
            </h3>
            <p className={`text-xs mt-1 ${muted}`}>
              {t(
                "配置事件、收件人与发送时间；客户跟进仍在 客户列表处理。通知策略和渠道分别使用本区域的保存按钮。",
                "Configure events, recipients and delivery timing. Handle follow-ups in Leads. Save notification policies and channels using the buttons in this section.",
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
                : crmError(error, lang)}
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
                          "站内提醒显示在客户列表。Lark 用于群通知；邮件／短信 尚未接入。",
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
              {tab === "notification-rules" && routing && (
                <div className={`${box} p-4 text-xs space-y-2`}>
                  <h4 className="font-bold">
                    {t("全局通知路由", "Global notification routing")}
                  </h4>
                  <p>
                    {t(
                      "站内客户通知默认通知有效 负责人；未分配或 负责人 无效时通知有权处理该客户团队的 CRM 管理者。只改变收件人，不修改客户归属。",
                      "In-app lead notifications go to a valid Owner; otherwise to authorized CRM Leaders for that lead team. Routing does not assign ownership.",
                    )}
                  </p>
                  <p className={muted}>
                    {t(
                      "CRM 管理者 来自可信平台角色及权限，不把所有管理员当作 管理者。Lark 仍发往策略指定群。明确团队/主管策略及运营异常、每日汇总保留原目标。找不到接收者时记录路由异常。",
                      "CRM Leaders come from trusted roles and permissions, not administrator status. Lark keeps its configured group destination. Explicit team/supervisor policies, operational incidents and summaries retain their targets. Missing recipients produce a routing incident.",
                    )}
                  </p>
                  <p>
                    {t("身份目录", "Identity directory")}：
                    {routing.identityMode === "local"
                      ? lang === "id"
                        ? crmId("Local staff accounts")
                        : lang === "zh"
                          ? "本地员工账号"
                          : "Local staff accounts"
                      : routing.identityMode === "mock"
                        ? t("本地模拟", "Local mock")
                        : t("平台", "Platform")}{" "}
                    · {t("有效 CRM 管理者", "Eligible CRM Leaders")}：
                    {routing.leaders.map((e: any) => e.id).join(", ") ||
                      t("未配置", "None configured")}
                  </p>
                </div>
              )}
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
                  {editor === "channel" ? (
                    <details className={`${box} p-3 text-xs`}>
                      <summary className="cursor-pointer">
                        {t(
                          "技术信息（只读）",
                          "Technical information (read only)",
                        )}
                      </summary>
                      <p className="mt-2">
                        {t("内部渠道 ID", "Internal channel ID")}：{key}
                      </p>
                      <p className={muted}>
                        {t(
                          "系统生成；现有策略通过此 ID 引用渠道，改名不改变关联。",
                          "Generated internally. Existing policies reference this ID; renaming the display label preserves links.",
                        )}
                      </p>
                    </details>
                  ) : (
                    <>
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
                    </>
                  )}
                  {editor === "rule" ? (
                    <>
                      {section(
                        t("1 · 触发条件", "1 · Trigger conditions"),
                        <>
                          <SearchableChoices
                            title={t("业务事件", "Business event")}
                            values={[rule.event]}
                            choices={Object.entries(eventNames).map(
                              ([value, n]) => ({
                                value,
                                label:
                                  lang === "id" ? crmId(n[1]) : n[zh ? 0 : 1],
                              }),
                            )}
                            onChange={(values) => patch({ event: values[0] })}
                            zh={zh}
                            lang={lang}
                            isLight={isLight}
                            multiple={false}
                          />
                          <p
                            className={`text-xs sm:col-span-2 lg:col-span-3 ${muted}`}
                          >
                            {t(
                              "事件单选；范围可多选。未选择表示全部；同字段任一满足，不同字段同时满足。",
                              "One event per policy; filters allow multiple selections. Empty means all. Values within a field use OR; different fields use AND.",
                            )}
                          </p>
                          {(
                            ["sources", "tiers", "states", "teams"] as const
                          ).map((key) => {
                            const labels: Record<string, [string, string]> = {
                              homepage_widget: [
                                "主页助手",
                                "Homepage assistant",
                              ],
                              standalone_chat: ["独立聊天", "Standalone chat"],
                              legacy_unknown: [
                                "历史来源未知",
                                "Unknown legacy source",
                              ],
                              Unqualified: ["待确认等级", "Unqualified"],
                              Hot: ["高意向", "Hot"],
                              "Warm-Offline": [
                                "常规意向·线下",
                                "Warm · offline",
                              ],
                              "Warm-Online": ["常规意向·线上", "Warm · online"],
                              School: ["院校合作", "School partnership"],
                              "Cold-Nurture": ["培育客户", "Cold nurture"],
                              New: ["待初访", "New"],
                              Contacted: ["已建联", "Contacted"],
                              "Assessment Booked": [
                                "已约测评",
                                "Assessment booked",
                              ],
                              "Assessment Done": [
                                "测评完成",
                                "Assessment completed",
                              ],
                              "Trial Booked": ["已约试听", "Trial booked"],
                              "Trial Attended": ["试听出席", "Trial attended"],
                              Enrolled: ["已报名", "Enrolled"],
                              Lost: ["已流失", "Lost"],
                              sales: ["销售团队", "Sales team"],
                              ops: ["运营团队", "Operations team"],
                              supervisors: ["主管团队", "Supervisor team"],
                            };
                            const titles = {
                              sources: t("客户来源", "Lead sources"),
                              tiers: t("客户等级", "Lead tiers"),
                              states: t("客户阶段", "Lead stages"),
                              teams: t("客户所属团队", "Lead team"),
                            };
                            return (
                              <SearchableChoices
                                key={key}
                                title={titles[key]}
                                values={rule[key] || []}
                                choices={(filterOptions[key] || []).map(
                                  (value) => ({
                                    value,
                                    label:
                                      (lang === "id"
                                        ? crmId(labels[value]?.[1])
                                        : labels[value]?.[zh ? 0 : 1]) ||
                                      t(
                                        `历史或目录值：${value}`,
                                        `Historical or directory value: ${value}`,
                                      ),
                                  }),
                                )}
                                onChange={(values) => patch({ [key]: values })}
                                zh={zh}
                                lang={lang}
                                isLight={isLight}
                              />
                            );
                          })}
                        </>,
                      )}
                      {section(
                        t("2 · 通知对象", "2 · Notification recipients"),
                        <>
                          {rule.channels.includes("inapp") && (
                            <>
                              {select(
                                t("站内收件人", "In-app recipients"),
                                rule.recipient,
                                [
                                  [
                                    "owner",
                                    t(
                                      rule.event === "daily.digest"
                                        ? "统计团队中有权查看汇总的员工"
                                        : "全局路由：负责人 → CRM 管理者",
                                      rule.event === "daily.digest"
                                        ? "Authorized summary team members"
                                        : "Global routing: Owner → CRM Leader",
                                    ),
                                  ],
                                  ["team", t("指定团队", "Team")],
                                  [
                                    "supervisor",
                                    t("主管团队", "Supervisor team"),
                                  ],
                                ],
                                (v) => patch({ recipient: v }),
                              )}
                              {rule.recipient === "team" && (
                                <SearchableChoices
                                  title={t("接收团队", "Recipient team")}
                                  values={[rule.team]}
                                  choices={(filterOptions.teams || []).map(
                                    (value) => ({
                                      value,
                                      label:
                                        value === "sales"
                                          ? t("销售团队", "Sales team")
                                          : value === "ops"
                                            ? t("运营团队", "Operations team")
                                            : value === "supervisors"
                                              ? t("主管团队", "Supervisor team")
                                              : value,
                                    }),
                                  )}
                                  onChange={(values) =>
                                    patch({ team: values[0] })
                                  }
                                  multiple={false}
                                  zh={zh}
                                  lang={lang}
                                  isLight={isLight}
                                />
                              )}
                            </>
                          )}
                          {rule.event === "daily.digest" &&
                            rule.recipient !== "team" && (
                              <SearchableChoices
                                title={t("汇总统计团队", "Summary team")}
                                values={[rule.team]}
                                choices={(filterOptions.teams || []).map(
                                  (value) => ({ value, label: value }),
                                )}
                                onChange={(values) =>
                                  patch({ team: values[0] })
                                }
                                multiple={false}
                                zh={zh}
                                lang={lang}
                                isLight={isLight}
                              />
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
                                    ? t("客户列表站内提醒", "Leads reminder")
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
                                [
                                  rule.group,
                                  channels.some((c) => c.id === rule.group)
                                    ? groupLabel(
                                        channels.find(
                                          (c) => c.id === rule.group,
                                        )!,
                                      )
                                    : t(
                                        `未配置渠道（${rule.group}）`,
                                        `Unconfigured channel (${rule.group})`,
                                      ),
                                ],
                                ...channels
                                  .filter((c) => c.id !== rule.group)
                                  .map(
                                    (c) =>
                                      [c.id, groupLabel(c)] as [string, string],
                                  ),
                              ],
                              (v) => patch({ group: v }),
                            )}
                        </>,
                      )}
                      {section(
                        t("3 · 发送安排", "3 · Delivery schedule"),
                        <>
                          {!timed && (
                            <p
                              className={`text-xs sm:col-span-2 lg:col-span-3 ${muted}`}
                            >
                              {t(
                                "站内提醒始终即时产生，无需配置外发时间。",
                                "In-app reminders are immediate; no external delivery timing is required.",
                              )}
                            </p>
                          )}
                          {timed && (
                            <>
                              {rule.event === "daily.digest"
                                ? field(
                                    t("汇总时间模式", "Summary timing"),
                                    <p className="text-xs py-2">
                                      {t(
                                        "按工作日和汇总发送时间生成统计",
                                        "Generate statistics on configured days at the summary time",
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
                                          "指定时刻发送（逐条通知）",
                                          "Send at a set time (individual notifications)",
                                        ),
                                      ],
                                    ],
                                    (v) => patch({ timing: v }),
                                  )}
                              {rule.event !== "daily.digest" &&
                                rule.timing === "delay" &&
                                number(
                                  t("延迟分钟", "Delay minutes"),
                                  rule.delayMinutes,
                                  (v) => patch({ delayMinutes: v }),
                                )}
                              {(rule.event === "daily.digest" ||
                                rule.timing === "digest") &&
                                field(
                                  t(
                                    rule.event === "daily.digest"
                                      ? "每日统计汇总时间"
                                      : "通知发送时刻",
                                    rule.event === "daily.digest"
                                      ? "Daily summary time"
                                      : "Scheduled notification time",
                                  ),
                                  <input
                                    className={input}
                                    type="time"
                                    value={rule.digestTime}
                                    onChange={(e) =>
                                      patch({ digestTime: e.target.value })
                                    }
                                  />,
                                )}
                              {select(
                                t("工作日历来源", "Work calendar"),
                                rule.calendarMode || "custom",
                                [
                                  [
                                    "inherit",
                                    t(
                                      "遵循全局 SLA 工作日历",
                                      "Inherit global SLA calendar",
                                    ),
                                  ],
                                  [
                                    "custom",
                                    t(
                                      "此策略自定义时间",
                                      "Custom calendar for this policy",
                                    ),
                                  ],
                                ],
                                (v) =>
                                  patch({
                                    calendarMode: v as "inherit" | "custom",
                                  }),
                              )}
                              {rule.calendarMode === "inherit" && (
                                <div className="sm:col-span-2 lg:col-span-3 text-xs space-y-2">
                                  <p>{calendarSummary}</p>
                                  <p className={muted}>
                                    {t(
                                      "来自上方已保存的 SLA 设置；新事件按当前日历安排，待发通知发送前再次检查。不重算已有跟进截止时间。",
                                      "Uses saved SLA settings above for new events and pre-send checks. Existing follow-up deadlines are preserved.",
                                    )}
                                  </p>
                                </div>
                              )}
                              {rule.channels.includes("lark") &&
                                field(
                                  t("Lark 工作时间限制", "Lark business hours"),
                                  <label className="flex gap-2 py-2 text-xs">
                                    <input
                                      type="checkbox"
                                      checked={rule.businessOnly}
                                      onChange={(e) =>
                                        patch({
                                          businessOnly: e.target.checked,
                                        })
                                      }
                                    />
                                    {t(
                                      "仅在工作时间发送",
                                      "Send only during business hours",
                                    )}
                                  </label>,
                                  t(
                                    "关闭后允许全天发送；站内提醒始终即时产生。",
                                    "Disable for round-the-clock delivery; in-app reminders are always immediate.",
                                  ),
                                )}
                              {rule.calendarMode === "custom" && (
                                <>
                                  {text(
                                    t("时区", "Timezone"),
                                    rule.timezone,
                                    (v) => patch({ timezone: v }),
                                    "Asia/Jakarta",
                                  )}
                                  {rule.channels.includes("lark") &&
                                    rule.businessOnly && (
                                      <>
                                        {field(
                                          t(
                                            "工作时间开始",
                                            "Business hours start",
                                          ),
                                          <input
                                            className={input}
                                            type="time"
                                            value={rule.start}
                                            onChange={(e) =>
                                              patch({ start: e.target.value })
                                            }
                                          />,
                                        )}
                                        {field(
                                          t(
                                            "工作时间结束",
                                            "Business hours end",
                                          ),
                                          <input
                                            className={input}
                                            type="time"
                                            value={rule.end}
                                            onChange={(e) =>
                                              patch({ end: e.target.value })
                                            }
                                          />,
                                        )}
                                      </>
                                    )}
                                  {(rule.businessOnly ||
                                    rule.event === "daily.digest" ||
                                    rule.timing === "digest") &&
                                    field(
                                      t("工作日", "Working days"),
                                      <div className="flex flex-wrap gap-2 py-2">
                                        {(zh
                                          ? [
                                              "日",
                                              "一",
                                              "二",
                                              "三",
                                              "四",
                                              "五",
                                              "六",
                                            ]
                                          : [
                                              "Su",
                                              "Mo",
                                              "Tu",
                                              "We",
                                              "Th",
                                              "Fr",
                                              "Sa",
                                            ]
                                        ).map((d, i) => (
                                          <label
                                            key={i}
                                            className="text-xs flex gap-1"
                                          >
                                            <input
                                              type="checkbox"
                                              checked={rule.days.includes(i)}
                                              onChange={(e) =>
                                                patch({
                                                  days: e.target.checked
                                                    ? [...rule.days, i].sort()
                                                    : rule.days.filter(
                                                        (x) => x !== i,
                                                      ),
                                                })
                                              }
                                            />
                                            {d}
                                          </label>
                                        ))}
                                      </div>,
                                    )}
                                </>
                              )}
                              {rule.channels.includes("lark") &&
                                field(
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
                              {rule.channels.includes("lark") && rule.quiet && (
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
                            </>
                          )}
                        </>,
                      )}
                      {section(
                        t("4 · 消息内容", "4 · Message content"),
                        <>
                          {rule.channels.includes("lark") && (
                            <>
                              {select(
                                t("日期显示语言", "Date display language"),
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
                              <div
                                className={`${box} p-3 text-xs sm:col-span-2 lg:col-span-3`}
                              >
                                <p className="font-semibold mb-2">
                                  {t(
                                    "Lark 摘要预览（模拟数据）",
                                    "Lark summary preview (synthetic data)",
                                  )}
                                </p>
                                <p className="whitespace-pre-wrap">
                                  {rule.template.replace(
                                    /\{\{(event|name|owner|due)\}\}/g,
                                    (_, key) =>
                                      (
                                        ({
                                          event: rule.event,
                                          name: t("测试客户", "Sample customer"),
                                          owner: t("测试顾问", "Sample advisor"),
                                          due: t(
                                            "测试截止时间",
                                            "Sample deadline",
                                          ),
                                        }) as Record<string, string>
                                      )[key],
                                  )}
                                </p>
                                <p className={muted}>
                                  {t(
                                    "仅预览正文替换，不发送消息；实际内容来自事件与客户记录。",
                                    "Text substitution only; no delivery. Actual values come from the event and lead.",
                                  )}
                                </p>
                              </div>
                            </>
                          )}
                          <p
                            className={`text-xs sm:col-span-2 lg:col-span-3 ${muted}`}
                          >
                            {t(
                              "站内提醒自动呈现客户与事件信息，无需填写模板；Lark 使用摘要模板，不发送完整聊天。",
                              "In-app reminders include lead and event data. Lark uses the summary template, not the full transcript.",
                            )}
                          </p>
                        </>,
                      )}
                      {rule.channels.includes("lark") ? (
                        <details className={`${box} p-4`}>
                          <summary className="text-xs font-bold cursor-pointer">
                            {t(
                              "5 · 发送保护（高级设置）",
                              "5 · Delivery safeguards (advanced)",
                            )}
                          </summary>
                          <div className="mt-4">
                            {section(
                              t(
                                "Lark 重复抑制与重试",
                                "Lark deduplication and retries",
                              ),
                              <>
                                {number(
                                  t(
                                    "重复通知抑制窗口（分钟）",
                                    "Lark deduplication window (minutes)",
                                  ),
                                  rule.dedupeMinutes,
                                  (v) => patch({ dedupeMinutes: v }),
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
                                <p
                                  className={`text-xs sm:col-span-2 lg:col-span-3 ${muted}`}
                                >
                                  {t(
                                    "同一群、客户、事件与紧急级别的后续通知会被抑制，不合并内容，也不影响聊天保存。每群限流统一在渠道设置中配置。",
                                    "Subsequent notifications for the same group, lead, event and priority are suppressed. Content is not merged and chats remain saved. Configure hourly limits in channel settings.",
                                  )}
                                </p>
                              </>,
                            )}
                          </div>
                        </details>
                      ) : (
                        <p className={`text-xs ${muted}`}>
                          {t(
                            "5 · 发送保护：站内提醒无需 Lark 重试、重复抑制或限流参数。",
                            "5 · Delivery safeguards: in-app reminders do not use Lark retry, deduplication or rate limits.",
                          )}
                        </p>
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
                            {s.channel} ·{" "}
                            {new Date(s.at).toLocaleString(crmLocale(lang), {
                              timeZone:
                                rule.calendarMode === "inherit"
                                  ? globalCalendar.timezone
                                  : rule.timezone,
                            })}{" "}
                            ·{" "}
                            {rule.calendarMode === "inherit"
                              ? globalCalendar.timezone
                              : rule.timezone}
                          </p>
                        ))}
                      </div>
                    </>
                  ) : (
                    <>
                      {section(
                        t("1 · 基本信息", "1 · Basic information"),
                        <>
                          {text(
                            t("渠道名称", "Channel name"),
                            channel.groupName || "",
                            (v) => setChannel({ ...channel, groupName: v }),
                            t(
                              "仅在 CRM 渠道列表与策略群选择器中显示；不修改 Lark 群名，不决定发送目标。",
                              "Displayed in CRM channel lists and policy selectors. Does not rename a Lark group or determine the delivery target.",
                            ),
                          )}
                          {select(
                            t("运行方式", "Operation mode"),
                            channel.mode,
                            [
                              ["simulation", t("模拟测试", "Simulation")],
                              ["live", t("真实发送", "Live delivery")],
                            ],
                            (v) => setChannel({ ...channel, mode: v }),
                          )}
                          <p
                            className={`text-xs sm:col-span-2 lg:col-span-3 ${muted}`}
                          >
                            {channel.mode === "simulation"
                              ? t(
                                  "只生成模拟发送记录，不向 Lark 发消息，无需 机器人连接。已有连接信息保留，但在模拟模式中不使用。",
                                  "Records simulated deliveries only. No messages sent to Lark; no Webhook required. Existing connection settings are retained but unused.",
                                )
                              : t(
                                  "将向 机器人连接 对应的群发送。切换模式影响引用此渠道的待发任务；保存配置本身不发送测试消息。",
                                  "Sends to the group identified by the Webhook. Mode changes affect pending jobs. Saving does not send a test message.",
                                )}
                          </p>
                        </>,
                      )}
                      {channel.mode === "live"
                        ? section(
                            t("2 · 连接配置", "2 · Connection settings"),
                            <>
                              {text(
                                t(
                                  "机器人连接 配置引用（必填）",
                                  "Webhook configuration reference (required)",
                                ),
                                channel.secretRef || "",
                                (v) => setChannel({ ...channel, secretRef: v }),
                                t(
                                  "填写服务端环境变量名，例如 LARK_GROUP_CRM。变量中的 机器人地址 决定目标群；不要在此填写 地址或密钥。",
                                  "Enter a server environment variable such as LARK_GROUP_CRM. Its Webhook URL determines the target group; never enter a URL or secret here.",
                                ),
                              )}
                              {field(
                                t("签名验证", "Signature verification"),
                                <label className="flex gap-2 py-2 text-xs">
                                  <input
                                    type="checkbox"
                                    checked={!!channel.signingEnabled}
                                    onChange={(e) =>
                                      setChannel({
                                        ...channel,
                                        signingEnabled: e.target.checked,
                                      })
                                    }
                                  />
                                  {t(
                                    "机器人已开启签名验证",
                                    "Bot requires signature verification",
                                  )}
                                </label>,
                                t(
                                  "仅在 Lark 机器人开启签名验证时勾选。",
                                  "Enable only if signature verification is enabled on the Lark bot.",
                                ),
                              )}
                              {channel.signingEnabled &&
                                text(
                                  t(
                                    "签名密钥引用（必填）",
                                    "Signing secret reference (required)",
                                  ),
                                  channel.signingSecretRef || "",
                                  (v) =>
                                    setChannel({
                                      ...channel,
                                      signingSecretRef: v,
                                    }),
                                  t(
                                    "填写服务端变量名，不填写实际密钥。",
                                    "Enter the server variable name, not the secret.",
                                  ),
                                )}
                              <p
                                className={`text-xs sm:col-span-2 lg:col-span-3 ${muted}`}
                              >
                                {t(
                                  "连接检查以保存后的配置为准。“配置就绪”不代表群内已收到消息；实际接口接受结果在发送记录查询。测试环境仅允许指定测试群。",
                                  "Connection checks use saved settings. Configured does not prove group receipt; API acceptance appears in delivery records. Only the designated test group may receive live test messages.",
                                )}
                              </p>
                            </>,
                          )
                        : section(
                            t("2 · 连接配置", "2 · Connection settings"),
                            <p
                              className={`text-xs sm:col-span-2 lg:col-span-3 ${muted}`}
                            >
                              {t(
                                "模拟测试不需要连接配置。",
                                "Simulation requires no connection settings.",
                              )}
                            </p>,
                          )}
                      {section(
                        t("3 · 发送保护", "3 · Delivery safeguards"),
                        <>
                          {number(
                            t("每小时发送上限", "Hourly delivery limit"),
                            channel.maxPerHour ?? 20,
                            (v) => setChannel({ ...channel, maxPerHour: v }),
                          )}
                          <p
                            className={`text-xs sm:col-span-2 lg:col-span-3 ${muted}`}
                          >
                            {t(
                              "引用此渠道的所有策略共用。默认 20；0 暂停发送；达到上限后顺延，不丢弃通知。模拟模式也可验证限流。",
                              "Shared by all policies using this channel. Default 20; zero pauses delivery. Excess jobs are deferred, not discarded. Simulation also exercises rate limits.",
                            )}
                          </p>
                        </>,
                      )}
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
                          <p className={`text-xs ${muted}`}>
                            {t("适用范围", "Applies to")}：
                            {[
                              [t("来源", "Source"), row.config!.sources],
                              [t("等级", "Tier"), row.config!.tiers],
                              [t("状态", "State"), row.config!.states],
                              [
                                t("客户团队", "Lead team"),
                                row.config!.teams || [],
                              ],
                            ]
                              .filter(
                                ([, values]) => (values as string[]).length,
                              )
                              .map(
                                ([name, values]) =>
                                  `${name}: ${(values as string[]).join(", ")}`,
                              )
                              .join(" · ") || t("全部客户", "All leads")}
                          </p>
                          <p className="text-xs">
                            {row
                              .config!.channels.map((c) =>
                                c === "inapp"
                                  ? t("客户列表提醒", "Leads reminder")
                                  : "Lark · " +
                                    (channels.find(
                                      (x) => x.id === row.config!.group,
                                    )?.config?.groupName ||
                                      t("未命名群", "Unnamed group")),
                              )
                              .join(" + ")}{" "}
                            ·{" "}
                            {row.config!.channels.includes("inapp")
                              ? row.config!.event === "daily.digest"
                                ? t(
                                    `汇总统计团队：${row.config!.team}`,
                                    `Summary team: ${row.config!.team}`,
                                  )
                                : row.config!.recipient === "owner"
                                  ? t(
                                      `客户负责人；未分配或负责人无效时转 CRM Leader`,
                                      `Lead owner; invalid/unassigned owner → CRM Leader`,
                                    )
                                  : row.config!.recipient === "supervisor"
                                    ? t("主管团队", "Supervisor team")
                                    : t(
                                        `接收团队：${row.config!.team}`,
                                        `Recipient team: ${row.config!.team}`,
                                      )
                              : t("仅群通知", "Group delivery only")}
                          </p>
                          <p className={`text-xs ${muted}`}>
                            {!row.config!.channels.includes("lark") &&
                            row.config!.event !== "daily.digest" ? (
                              t("站内提醒即时产生", "Immediate in-app reminder")
                            ) : (
                              <>
                                {row.config!.event === "daily.digest" ||
                                row.config!.timing === "digest"
                                  ? `${row.config!.event === "daily.digest" ? t("每日统计汇总", "Daily summary") : t("指定时刻逐条发送", "Individual sends at set time")} ${row.config!.digestTime}`
                                  : row.config!.timing === "delay"
                                    ? `${row.config!.delayMinutes} ${t("分钟延迟", "minute delay")}`
                                    : t("立即发送", "Immediate")}
                                {" · "}
                                {row.config!.calendarMode === "inherit"
                                  ? t(
                                      "继承全局 SLA 日历",
                                      "Global SLA calendar",
                                    )
                                  : row.config!.timezone}
                                {row.config!.channels.includes("lark") &&
                                row.config!.businessOnly
                                  ? " · " + t("遵守工作时间", "Business hours")
                                  : ""}
                              </>
                            )}
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
                          <h4 className="font-bold text-sm">
                            Lark ·{" "}
                            {row.config!.groupName ||
                              t("未命名群", "Unnamed group")}
                          </h4>
                          <p className="text-xs">
                            {row.config!.mode === "live"
                              ? t("真实发送", "Live")
                              : t("模拟发送", "Simulation")}
                          </p>
                          <p className="text-xs">{connectionLabel(row)}</p>
                          <p className="text-xs">
                            {t("每小时上限", "Hourly limit")}：
                            {row.rateLimit?.maxPerHour ?? 20} ·{" "}
                            {row.rateLimit?.source === "legacy_strictest"
                              ? t(
                                  "旧策略兼容值（可在此统一设置）",
                                  "Legacy compatibility limit (configure here)",
                                )
                              : t(
                                  "群内所有策略共用",
                                  "Shared by all group policies",
                                )}
                          </p>
                          <p className={`text-xs ${muted}`}>
                            {t(
                              "被通知策略引用",
                              "Used by notification policies",
                            )}
                            ：{row.usage?.total ?? 0} · {t("已启用", "Enabled")}
                            ：{row.usage?.enabled ?? 0}
                          </p>
                          <details className={`text-[11px] ${muted}`}>
                            <summary className="cursor-pointer">
                              {t("技术信息", "Technical information")}
                            </summary>
                            <p>
                              {t("标识：", "ID:")}
                              {row.id}
                            </p>
                            {row.config!.mode === "live" && (
                              <p>
                                {t("机器人连接 配置引用", "Webhook reference")}
                                ：{row.config!.secretRef}
                              </p>
                            )}
                          </details>
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
                                [
                                  v,
                                  lang === "id" ? crmId(n[1]) : n[zh ? 0 : 1],
                                ] as [string, string],
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
                                    {crmValue(row.channel, lang)}
                                    <br />
                                    {row.recipient}
                                  </td>
                                  <td className="p-3">
                                    <span
                                      className={`whitespace-nowrap ${row.state === "failed" || row.state === "unknown" ? "text-rose-500" : row.state === "accepted" ? "text-emerald-600" : muted}`}
                                    >
                                      {(lang === "id"
                                        ? crmId(stateNames[row.state]?.[1])
                                        : stateNames[row.state]?.[
                                            zh ? 0 : 1
                                          ]) || row.state}
                                    </span>
                                  </td>
                                  <td className="p-3 whitespace-nowrap">
                                    {format(row.due_at)}
                                    <br />
                                    {row.attempts} {t("次", "attempts")} · v
                                    {row.version}
                                  </td>
                                  <td className="p-3 max-w-xs break-words">
                                    {row.result
                                      ? crmDeliveryResult(
                                          row.result,
                                          row.state,
                                          lang,
                                        )
                                      : "—"}
                                    {row.result && (
                                      <details className="mt-1 text-xs">
                                        <summary className="cursor-pointer">
                                          {t(
                                            "原始技术回执",
                                            "Original technical receipt",
                                          )}
                                        </summary>
                                        <pre className="whitespace-pre-wrap mt-1">
                                          {row.result}
                                        </pre>
                                      </details>
                                    )}
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
                                {t("机器人连接 配置", "Webhook configured")}：
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

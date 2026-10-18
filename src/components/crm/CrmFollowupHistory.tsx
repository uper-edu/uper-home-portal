import { Clock3, MessageSquare, NotebookPen, Activity } from "lucide-react";
import { followupHistoryDay } from "../../utils/crmFollowupOverview";
import { Fragment, useState, useEffect } from "react";
import { CrmSingleSelect } from "./CrmSingleSelect";
import {
  followupHistory,
  historyTouchesTask,
  historyTaskReferences,
  followupHistorySource,
  historyBuyingEvidence,
  historyBuyingLabel,
} from "../../utils/crmFollowupHistory";
import { formatCrmOperatingTime } from "../../utils/crmOperatingTime";
import { presentFollowUpTask } from "../../utils/crmTaskPresentation";
import { crmValue } from "../../utils/crmLanguage";
export function CrmFollowupHistory({
  facts,
  journey,
  tasks,
  lang,
  timezone,
  isLight,
  taskId,
  onClearTask,
  onSource,
  kindLabel,
  historyTasks,
}: any) {
  const t = (en: string, id: string, zh: string) =>
    lang === "zh" ? zh : lang === "id" ? id : en;
  const [filter, setFilter] = useState("all"),
    [limit, setLimit] = useState(20);
  useEffect(() => setLimit(20), [filter, taskId]);
  const rows = followupHistory(facts, journey).filter(
    (r) =>
      (!taskId || historyTouchesTask(r, taskId)) &&
      (taskId || filter === "all" || r.category === filter),
  );
  const [auditId, setAuditId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const taskName = (id: string) =>
    tasks.some((v: any) => v.id === id)
      ? presentFollowUpTask(
          tasks.find((v: any) => v.id === id),
          lang,
          timezone,
        ).action
      : t(
          "Task no longer available",
          "Tugas tidak lagi tersedia",
          "任务暂不可用",
        );
  const label = (f: any) =>
    f.kind === "followup.recorded"
      ? t(
          "Contact / handling record",
          "Catatan kontak / penanganan",
          "联系／处理记录",
        )
      : f.kind === "information.recorded"
        ? t("Information note", "Catatan informasi", "信息记录")
        : f.kind.startsWith("task.")
          ? kindLabel(f.kind.slice(5))
          : f.kind === "stage.changed"
            ? t("Stage change", "Perubahan tahap", "阶段变更")
            : f.kind === "questionnaire.submitted"
              ? t("Questionnaire submitted", "Kuesioner dikirim", "提交问卷")
              : f.kind === "assessment.submitted"
                ? t("Assessment submitted", "Asesmen dikirim", "提交测评")
                : f.kind === "profile.changed"
                  ? t("Profile updated", "Profil diperbarui", "资料更新")
                  : f.kind.startsWith("identity.")
                    ? t("Identity reviewed", "Identitas ditinjau", "身份核实")
                    : t(
                        "Information reviewed",
                        "Informasi ditinjau",
                        "动态处理",
                      );
  return (
    <section
      className="crm-followup-history crm-followup-zone"
      id="crm-task-evidence-history"
      tabIndex={-1}
    >
      <div className="crm-followup-zone-heading">
        <h3>
          {t("Follow-up timeline", "Linimasa tindak lanjut", "跟进时间轴")}
        </h3>
        <CrmSingleSelect
          label={t("Record filter", "Filter catatan", "记录筛选")}
          value={taskId ? "task" : filter}
          onChange={(v) => {
            if (v !== "task") {
              onClearTask();
              setFilter(v);
            }
          }}
          options={[
            ...(taskId
              ? [
                  {
                    value: "task",
                    label: t("Selected task", "Tugas dipilih", "当前任务"),
                  },
                ]
              : []),
            ...["all", "contact", "notes", "tasks", "customer"].map(
              (value, i) => ({
                value,
                label: [
                  t("All records", "Semua catatan", "全部记录"),
                  t(
                    "Contact and handling",
                    "Kontak dan penanganan",
                    "联系与处理",
                  ),
                  t("Information notes", "Catatan informasi", "信息记录"),
                  t("Task changes", "Perubahan tugas", "任务变化"),
                  t("Customer activity", "Aktivitas pelanggan", "客户动态"),
                ][i],
              }),
            ),
          ]}
          lang={lang}
          isLight={isLight}
        />
      </div>
      {taskId && (
        <p>
          {taskName(taskId)}{" "}
          <button type="button" className="crm-work-link" onClick={onClearTask}>
            {t("Show all history", "Tampilkan semua riwayat", "显示全部历史")}
          </button>
        </p>
      )}
      {!rows.length && (
        <p className="crm-work-muted">
          {t(
            "No matching records",
            "Belum ada catatan yang cocok",
            "暂无符合条件的记录",
          )}
        </p>
      )}
      <ol className="crm-followup-history-list">
        {rows.slice(0, limit).map((row: any, index: number) => {
          const f = row.fact,
            d = f?.data,
            e = row.event;
          const taskRefs = historyTaskReferences(row);
          const day = followupHistoryDay(row.at, timezone);
          const source = followupHistorySource(row);
          const buyingEvidence = historyBuyingEvidence(row);
          const newDay =
            index === 0 ||
            day !== followupHistoryDay(rows[index - 1].at, timezone);
          const Icon =
            row.category === "tasks"
              ? Clock3
              : row.category === "notes"
                ? NotebookPen
                : row.category === "contact"
                  ? MessageSquare
                  : Activity;
          const fullTime = day ? formatCrmOperatingTime(row.at, timezone) : "";
          return (
            <Fragment key={row.id}>
              {newDay && (
                <li className="crm-timeline-date">
                  {day ||
                    t("Time not recorded", "Waktu tidak dicatat", "时间未记录")}
                  <span className="crm-work-muted"> · {timezone}</span>
                </li>
              )}
              <li
                className="crm-timeline-event"
                data-history-id={row.id}
                data-category={row.category}
                data-source={source}
              >
                <time
                  className="crm-timeline-time"
                  dateTime={day ? row.at : undefined}
                  title={fullTime}
                >
                  {day ? fullTime.slice(11, 19) : "—"}
                </time>
                <span className="crm-timeline-node" aria-hidden="true">
                  <Icon size={14} />
                </span>
                <div className="crm-timeline-content">
                  <div className="crm-followup-record-meta">
                    <span className="crm-timeline-source" data-source={source}>
                      {
                        {
                          customer: t(
                            "Customer activity",
                            "Aktivitas pelanggan",
                            "客户动态",
                          ),
                          sales: t("Sales record", "Catatan sales", "销售记录"),
                          system: t(
                            "System record",
                            "Catatan sistem",
                            "系统记录",
                          ),
                          unknown: t(
                            "Source not recorded",
                            "Sumber tidak tercatat",
                            "来源未记录",
                          ),
                        }[source]
                      }
                    </span>
                    <strong>{f ? label(f) : e.badgeText}</strong>
                    <span>
                      {f
                        ? f.actor === "visitor"
                          ? t("Customer", "Pelanggan", "客户")
                          : f.actor
                        : e.actorName || e.staffName || ""}
                    </span>
                  </div>
                  {d?.channel && (
                    <p className="crm-work-muted">
                      {crmValue(d.channel, lang)}
                      {d.connectStatus
                        ? ` · ${crmValue(d.connectStatus, lang)}`
                        : ""}
                    </p>
                  )}
                  <p
                    id={`crm-history-text-${row.id}`}
                    className={`crm-followup-record-text ${expandedIds.includes(row.id) ? "" : "crm-history-excerpt"}`}
                  >
                    {f
                      ? d.summary || d.reason || d.purpose || label(f)
                      : e.content || e.title}
                  </p>
                  {String(
                    f
                      ? d.summary || d.reason || d.purpose || ""
                      : e.content || e.title || "",
                  ).length > 220 && (
                    <button
                      type="button"
                      className="crm-work-link"
                      aria-controls={`crm-history-text-${row.id}`}
                      aria-expanded={expandedIds.includes(row.id)}
                      onClick={() =>
                        setExpandedIds((ids) =>
                          ids.includes(row.id)
                            ? ids.filter((id) => id !== row.id)
                            : [...ids, row.id],
                        )
                      }
                    >
                      {expandedIds.includes(row.id)
                        ? t("Show less", "Tutup", "收起")
                        : t("Read full note", "Baca selengkapnya", "展开全文")}
                    </button>
                  )}
                  {buyingEvidence && (
                    <p
                      className="crm-history-buying-evidence"
                      data-evidence-kind={buyingEvidence.kind}
                    >
                      <strong>
                        {buyingEvidence.kind === "questionnaire"
                          ? t(
                              "Questionnaire interests",
                              "Minat dalam kuesioner",
                              "问卷关注内容",
                            )
                          : buyingEvidence.kind === "chat" ? t("Explicit Chat request", "Permintaan Chat eksplisit", "Chat 明确请求") : t(
                              "Buying signal recorded by staff",
                              "Sinyal pembelian yang dicatat staf",
                              "员工记录的购买信号",
                            )}
                      </strong>
                      {" · "}
                      {buyingEvidence.values
                        .map((value) =>
                          historyBuyingLabel(value, buyingEvidence.kind, lang),
                        )
                        .join(" · ")}
                    </p>
                  )}
                  {f?.kind === "stage.changed" && (
                    <p>
                      {crmValue(d.before, lang)} → {crmValue(d.after, lang)}
                    </p>
                  )}
                  {taskRefs.length > 0 && (
                    <div
                      className="crm-history-task-references"
                      aria-label={t(
                        "Tasks in this record",
                        "Tugas dalam catatan ini",
                        "本条记录关联任务",
                      )}
                    >
                      {taskRefs.map((ref) => {
                        const current = tasks.find(
                          (task: any) => task.id === ref.id,
                        );
                        const known = ref.snapshot || current;
                        const view =
                          current &&
                          presentFollowUpTask(current, lang, timezone);
                        const name =
                          ref.action ||
                          (known &&
                            presentFollowUpTask(known, lang, timezone).action);
                        const relation =
                          (
                            {
                              handled: t(
                                "Handled · kept open",
                                "Ditangani · tetap terbuka",
                                "本次处理 · 保持待处理",
                              ),
                              completed: t(
                                "Completed in this record",
                                "Diselesaikan dalam catatan ini",
                                "本次完成",
                              ),
                              create: t(
                                "Task created",
                                "Tugas dibuat",
                                "新建任务",
                              ),
                              next: t(
                                "Next task arranged",
                                "Tugas berikutnya dijadwalkan",
                                "安排下一次任务",
                              ),
                              supplement: t(
                                "Task information added",
                                "Informasi tugas ditambahkan",
                                "已补充任务信息",
                              ),
                              reschedule: t(
                                "Rescheduled",
                                "Dijadwalkan ulang",
                                "本次改期",
                              ),
                              replace: t(
                                "Original task replaced",
                                "Tugas awal diganti",
                                "被替代的原任务",
                              ),
                              replacement: t(
                                "Replacement task",
                                "Tugas pengganti",
                                "替代后的新任务",
                              ),
                              cancel: t(
                                "Cancelled in this record",
                                "Dibatalkan dalam catatan ini",
                                "本次取消",
                              ),
                            } as Record<string, string>
                          )[ref.relation] ||
                          t("Linked task", "Tugas terkait", "关联任务");
                        return (
                          <div
                            key={ref.id}
                            className="crm-history-task-reference"
                            data-linked-task-id={ref.id}
                          >
                            <span className="crm-history-task-relation">
                              {relation}
                            </span>
                            <strong>
                              {name ||
                                t(
                                  "Task details unavailable",
                                  "Detail tugas tidak tersedia",
                                  "任务详情暂不可用",
                                )}
                            </strong>
                            {!name && (
                              <span className="crm-work-muted">
                                {t("Task ID", "ID tugas", "任务编号")} ·{" "}
                                {ref.id}
                              </span>
                            )}
                            {ref.relation === "reschedule" &&
                              d?.scheduledAt && (
                                <span>
                                  {t(
                                    "New time in this change",
                                    "Waktu baru pada perubahan ini",
                                    "本次改约时间",
                                  )}{" "}
                                  ·{" "}
                                  {formatCrmOperatingTime(
                                    d.scheduledAt,
                                    timezone,
                                  )}
                                </span>
                              )}
                            {view && (
                              <div className="crm-history-task-current">
                                <span>
                                  {t(
                                    "Current task",
                                    "Tugas saat ini",
                                    "任务当前情况",
                                  )}{" "}
                                  · {view.status}
                                </span>
                                {view.times.map((time: any, i: number) => (
                                  <span key={i}>
                                    {time.label} · {view.formatTime(time.value)}{" "}
                                    · {timezone}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {!taskRefs.some((ref) => ref.relation === "next") &&
                    (d?.nextAction || e?.nextAction) && (
                      <p>
                        {t("Next step", "Langkah berikutnya", "下一步")}：
                        {d?.nextAction || e.nextAction}
                        {(d?.nextFollowUpAt || e?.nextFollowUpAt) &&
                          ` · ${formatCrmOperatingTime(d?.nextFollowUpAt || e.nextFollowUpAt, timezone)}`}
                      </p>
                    )}
                  {d?.disposition === "keep" && (
                    <p>
                      {t(
                        "Existing arrangements retained",
                        "Pengaturan yang ada dipertahankan",
                        "保留已有安排",
                      )}
                    </p>
                  )}
                  {d?.sourceMessageId && d?.sourceConversationId && (
                    <button
                      type="button"
                      className="crm-work-link"
                      onClick={() => onSource({ details: d })}
                    >
                      {t(
                        "View linked customer message",
                        "Lihat pesan pelanggan terkait",
                        "查看关联客户消息",
                      )}
                    </button>
                  )}
                  <button
                    type="button"
                    className="crm-history-audit-toggle"
                    aria-expanded={auditId === row.id}
                    onClick={() =>
                      setAuditId(auditId === row.id ? null : row.id)
                    }
                  >
                    {t("Record details", "Detail catatan", "记录详情")}
                  </button>
                  {auditId === row.id && (
                    <pre className="crm-record-audit">
                      {JSON.stringify(f || e, null, 2)}
                    </pre>
                  )}
                </div>
              </li>
            </Fragment>
          );
        })}
      </ol>
      {historyTasks}
      {rows.length > limit && (
        <button
          type="button"
          className="crm-work-link"
          onClick={() => setLimit(limit + 20)}
        >
          {t(
            "Show earlier records",
            "Lihat catatan sebelumnya",
            "查看更早记录",
          )}
        </button>
      )}
    </section>
  );
}

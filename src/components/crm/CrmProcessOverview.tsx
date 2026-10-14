import type { ProcessMetrics } from "../../utils/crmProcessMetrics";
import { crmLocale, crmValue, type CrmLanguage } from "../../utils/crmLanguage";
import { formatCrmOperatingTime } from "../../utils/crmOperatingTime";
export function CrmProcessOverview({
  metrics,
  lang,
  isLight,
  timezone,
  leader,
  employees,
  error,
}: {
  metrics: ProcessMetrics | null;
  lang: CrmLanguage;
  isLight: boolean;
  timezone: string;
  leader: boolean;
  employees: any[];
  error?: boolean;
}) {
  const t = (en: string, id: string, zh: string) =>
    lang === "zh" ? zh : lang === "id" ? id : en;
  const number = (n: number) => n.toLocaleString(crmLocale(lang));
  const decimal=(n:number)=>n.toLocaleString(crmLocale(lang),{minimumFractionDigits:1,maximumFractionDigits:1});
  const duration = (ms: number | null) =>
    ms === null
      ? t("Not calculable", "Tidak dapat dihitung", "不可计算")
      : ms < 3600000
        ? `${Math.round(ms / 60000)} ${t("min", "mnt", "分钟")}`
        : ms < 86400000
          ? `${decimal(ms / 3600000)} ${t("h", "jam", "小时")}`
          : `${decimal(ms / 86400000)} ${t("days", "hari", "天")}`;
  if (error || !metrics)
    return (
      <section className="crm-process" data-theme={isLight ? "light" : "dark"}>
        <p role="status">
          {t(
            "Process metrics unavailable; refresh to retry.",
            "Metrik proses tidak tersedia; segarkan untuk mencoba lagi.",
            "过程指标暂不可用，请刷新重试。",
          )}
        </p>
      </section>
    );
  const m = metrics;
  const cards = [
    [
      t("Unassigned customers", "Pelanggan belum ditugaskan", "未分配客户"),
      number(m.unassigned),
      `${t("Longest wait", "Waktu tunggu terlama", "最长未分配时长")}：${duration(m.longestUnassignedMs)} · ${t("Time unknown", "Waktu tidak diketahui", "时间未知")} ${m.unassignedTimeUnknown}`,
    ],
    [
      t(
        "First human contact record",
        "Catatan kontak staf pertama",
        "首条人工联系记录",
      ),
      duration(m.firstContactMedianMs),
      `${t("Median", "Median", "中位数")} · ${m.firstContactSamples} ${t("timed customers", "pelanggan dengan waktu tercatat", "位时间有效客户")} · ${t("No human contact recorded", "Belum ada kontak staf tercatat", "尚无人工联系记录")} ${m.awaitingContact}`,
    ],
    [
      t(
        "No valid next arrangement",
        "Tanpa rencana lanjutan valid",
        "无有效后续安排",
      ),
      number(m.noNext),
      t(
        "Active customers; stopped contact excluded",
        "Pelanggan aktif; kontak dihentikan dikecualikan",
        "活跃客户；不含停止联系客户",
      ),
    ],
    [
      t("Currently overdue", "Saat ini terlambat", "当前逾期"),
      number(m.overdueCustomers),
      `${m.overdueTasks} ${t("open overdue tasks", "tugas terbuka terlambat", "项未完成逾期任务")} · ${t("Completed late", "Selesai terlambat", "逾期后已处理")} ${m.lateCompletedTasks}`,
    ],
    [
      t("Two-way communication", "Komunikasi dua arah", "有效双向沟通"),
      number(m.engagedCustomers),
      `${t("Recorded successful contacts", "Kontak berhasil tercatat", "已接通或回复记录")} ${m.connectedRecords} · ${t("First two-way contact median", "Median kontak dua arah pertama", "首次双向沟通中位数")} ${duration(m.firstResponseMedianMs)} (${m.firstResponseSamples})`,
    ],
    [
      t("Time in current stage", "Waktu pada tahap saat ini", "当前阶段停留"),
      duration(m.stageMedianMs),
      `${t("Median for active customers", "Median pelanggan aktif", "活跃客户中位数")} · ${t("Time unknown", "Waktu tidak diketahui", "时间未知")} ${m.stageTimeUnknown}`,
    ],
  ];
  return (
    <section
      className="crm-process"
      data-theme={isLight ? "light" : "dark"}
      aria-label={t(
        "Sales process overview",
        "Ringkasan proses penjualan",
        "销售过程概览",
      )}
    >
      <p className="crm-process-scope">
        {t(
          "Current filtered customers",
          "Pelanggan dalam filter saat ini",
          "当前筛选客户",
        )}{" "}
        {m.customers} · {t("As of", "Per", "截至")}{" "}
        {formatCrmOperatingTime(m.asOf, timezone)} ({timezone})
      </p>
      <div className="crm-process-grid">
        {cards.map(([label, value, hint], i) => (
          <article
            key={label}
            data-tone={
              i === 3 && m.overdueCustomers > 0 ? "overdue" : "neutral"
            }
          >
            <h3>{label}</h3>
            <strong>{value}</strong>
            <p>{hint}</p>
          </article>
        ))}
      </div>
      <details>
        <summary>
          {t(
            "Definitions and data quality",
            "Definisi dan kualitas data",
            "统计口径与数据完整性",
          )}
        </summary>
        <ul>
          <li>
            {t(
              "All metrics use the visible, currently filtered customer cohort; they are lifetime records and a current snapshot, not a daily sales ranking.",
              "Semua metrik memakai pelanggan yang terlihat dan terfilter; mencakup catatan sejak pendaftaran serta kondisi saat ini, bukan peringkat harian.",
              "全部指标来自权限内的当前筛选客户，是自登记以来的记录及当前快照，不是每日销售排名。",
            )}
          </li>
          <li>
            {t(
              "First human contact: registration to the first submitted contact record, including unanswered attempts. Successful two-way communication is measured separately. AI replies and administrative records do not count. These are record submission times and natural elapsed durations, not exact call times or working-hour SLA.",
              "Kontak staf pertama: dari pendaftaran hingga catatan kontak pertama dikirim, termasuk upaya tanpa balasan. Komunikasi dua arah berhasil diukur terpisah. Balasan AI dan catatan administratif tidak dihitung. Ini waktu pengiriman catatan dan durasi alami, bukan waktu telepon tepat atau SLA jam kerja.",
              "首条人工联系：登记到第一条人工联系记录提交的时长，包含未接通尝试；有效双向沟通单独统计。AI 回复和非联系处理不计入。采用记录提交时间与自然时长，不冒充精确通话时间或工作时间 SLA。",
            )}
          </li>
          <li>
            {t(
              "Unassigned wait starts at the recorded ownership change; old records without this evidence remain unknown. Stage time starts at the recorded stage change; closed customers are excluded.",
              "Waktu belum ditugaskan dimulai dari perubahan penanggung jawab yang tercatat; catatan lama tanpa bukti tetap tidak diketahui. Waktu tahap dimulai dari perubahan tahap; pelanggan tertutup dikecualikan.",
              "未分配时长从明确的归属变化时间起算；历史缺失记录保持未知。阶段停留从明确阶段时间起算，已成交或关闭客户不计入停留中位数。",
            )}
          </li>
          <li>
            {t(
              "Only open tasks with valid deadlines count as current overdue. Late completion uses the recorded processing time; historical events alone are not current overdue.",
              "Hanya tugas terbuka dengan tenggat valid dihitung sebagai terlambat saat ini. Penyelesaian terlambat memakai waktu pemrosesan tercatat; peristiwa historis bukan keterlambatan saat ini.",
              "当前逾期只计算有真实期限的开放任务；逾期后处理使用记录提交时间，历史逾期事件不冒充当前逾期。",
            )}
          </li>
        </ul>
        <p>
          {t(
            "Task evidence pending review",
            "Bukti tugas perlu ditinjau",
            "任务证据待核实",
          )}{" "}
          {m.tasksUnknown} ·{" "}
          {t(
            "Contact time unknown",
            "Waktu kontak tidak diketahui",
            "联系时间未知",
          )}{" "}
          {m.contactTimeUnknown} ·{" "}
          {t(
            "Completion time unknown",
            "Waktu penyelesaian tidak diketahui",
            "完成时间未知",
          )}{" "}
          {m.completionUnknown}
        </p>
        <p>
          {t(
            "Contact attempts are auxiliary, not successful communication",
            "Upaya kontak adalah pendukung, bukan komunikasi berhasil",
            "联系尝试仅为辅助，不等于有效沟通",
          )}
          ：{number(m.attempts)}
        </p>
      </details>
      {leader && (
        <details>
          <summary>
            {t(
              "By customer owner",
              "Menurut penanggung jawab pelanggan",
              "按客户负责人查看",
            )}
          </summary>
          <div
            className="crm-process-table"
            tabIndex={0}
            role="region"
            aria-label={t(
              "Owner metrics table",
              "Tabel metrik penanggung jawab",
              "负责人指标表",
            )}
          >
            <table>
              <thead>
                <tr>
                  {[
                    t("Owner", "Penanggung jawab", "负责人"),
                    t("Customers", "Pelanggan", "客户数"),
                    t(
                      "No next arrangement",
                      "Tanpa rencana lanjutan",
                      "无后续安排",
                    ),
                    t("Overdue customers", "Pelanggan terlambat", "逾期客户"),
                    t(
                      "First contact record median",
                      "Median catatan kontak pertama",
                      "首条联系记录中位数",
                    ),
                    t(
                      "Engaged customers",
                      "Pelanggan berkomunikasi",
                      "有效沟通客户",
                    ),
                  ].map((x) => (
                    <th key={x} scope="col">
                      {x}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {m.owners.map((r) => (
                  <tr key={r.owner}>
                    <th scope="row">
                      {employees.find((e) => e.id === r.owner)?.displayName ||
                        r.owner ||
                        t("Unassigned", "Belum ditugaskan", "未分配")}
                    </th>
                    <td>{r.customers}</td>
                    <td>{r.noNext}</td>
                    <td>{r.overdueCustomers}</td>
                    <td>
                      {duration(r.firstContactMedianMs)} (
                      {r.firstContactSamples})
                    </td>
                    <td>{r.engagedCustomers}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            {t(
              "Groups follow the current customer owner, not the author of past records.",
              "Kelompok mengikuti penanggung jawab saat ini, bukan penulis catatan sebelumnya.",
              "按当前客户负责人分组，不表示历史记录均由该员工处理。",
            )}
          </p>
        </details>
      )}
      <details>
        <summary>
          {t(
            "Current stage distribution",
            "Distribusi tahap saat ini",
            "当前阶段分布",
          )}
        </summary>
        <div
          className="crm-process-table"
          tabIndex={0}
          role="region"
          aria-label={t(
            "Stage metrics table",
            "Tabel metrik tahap",
            "阶段指标表",
          )}
        >
          <table>
            <thead>
              <tr>
                {[
                  t("Stage", "Tahap", "阶段"),
                  t("Customers", "Pelanggan", "客户数"),
                  t("Median duration", "Durasi median", "停留中位数"),
                  t("Unknown time", "Waktu tidak diketahui", "时间未知"),
                ].map((x) => (
                  <th key={x} scope="col">
                    {x}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {m.stages.map((r) => (
                <tr key={r.stage}>
                  <th scope="row">{crmValue(r.stage, lang)}</th>
                  <td>{r.customers}</td>
                  <td>
                    {duration(r.stageMedianMs)} ({r.stageSamples})
                  </td>
                  <td>{r.stageTimeUnknown}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

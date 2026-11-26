import type { ProcessMetrics } from "../../utils/crmProcessMetrics";
import {
  metricSelectionLabel,
  durationBandLabel,
  type MetricSelection,
} from "../../utils/crmLeadAnalytics";
import { humanCommunicationLabel } from "../../utils/crmInteractionLabels";
import { formatCrmEventTime } from "../../utils/crmOperatingTime";
import type { CrmLanguage } from "../../utils/crmLanguage";
export function CrmProcessOverview({
  metrics: m,
  mode = "full",
  lang,
  isLight,
  timezone,
  leader,
  employees,
  error,
  onMetric,
  onCommunication,
  selectedMetrics = [],
  selectedCommunication = [],
}: {
  metrics: ProcessMetrics | null;
  mode?: "full" | "summary" | "analysis";
  lang: CrmLanguage;
  isLight: boolean;
  timezone: string;
  leader: boolean;
  employees: any[];
  error?: boolean;
  onMetric?: (key: string) => void;
  onCommunication?: (key: string) => void;
  selectedMetrics?: string[];
  selectedCommunication?: string[];
}) {
  const t = (en: string, id: string, zh: string) =>
    lang === "zh" ? zh : lang === "id" ? id : en;
  if (error || !m)
    return (
      <section
        className="crm-process crm-lead-process"
        data-theme={isLight ? "light" : "dark"}
      >
        <p role="status">
          {t(
            "Overview unavailable; refresh to retry.",
            "Ringkasan tidak tersedia; segarkan lagi.",
            "客户概况暂不可用，请刷新重试。",
          )}
        </p>
      </section>
    );
  const duration = (ms: number | null) =>
    ms === null
      ? "—"
      : ms < 3600000
        ? `${Math.round(ms / 60000)} ${t("min", "menit", "分钟")}`
        : ms < 86400000
          ? `${(ms / 3600000).toFixed(1)} ${t("h", "jam", "小时")}`
          : `${(ms / 86400000).toFixed(1)} ${t("days", "hari", "天")}`;
  const ratio = (n: number, d: number) =>
    d ? `${Math.round((n / d) * 100)}%` : "—";
  const metricLink = (
    key: MetricSelection,
    label: string,
    count = m.breakdown[key] || 0,
  ) => (
    <button
      key={key}
      type="button"
      className="crm-metric-link"
      aria-pressed={selectedMetrics.includes(key)}
      onClick={() => onMetric?.(key)}
      disabled={!onMetric}
    >
      {label}
      <span>{count}</span>
    </button>
  );
  const bands = (prefix: "contact" | "response") => (
    <div className="crm-analysis-bands">
      {(["fast", "day", "later", "unknown"] as const).map(band =>
        metricLink((prefix + "_" + band) as MetricSelection,durationBandLabel(band,lang)),
      )}
    </div>
  );
  const cards = [
    {
      key: "",
      label: t("Current customers", "Pelanggan saat ini", "当前客户"),
      value: String(m.customers),
      hint: selectedMetrics.length
        ? t(
            "Clear metric conditions",
            "Hapus kondisi metrik",
            "点击清除指标条件",
          )
        : t(
            "Within the current filters",
            "Sesuai filter saat ini",
            "权限内的当前筛选客户",
          ),
    },
    {
      key: "first_pending",
      label: t(
        "First contact pending",
        "Kontak pertama belum selesai",
        "首次联系未完成",
      ),
      value: String(m.firstPending),
      hint: t(
        "Only the first contact requirement",
        "Hanya persyaratan kontak pertama",
        "仅统计首次联系要求",
      ),
    },
    {
      key: "recent_customer",
      label: t(
        "Customers with interactions · 7 days",
        "Pelanggan yang berinteraksi · 7 hari",
        "近7天互动客户",
      ),
      value: String(m.recentCustomer),
      hint: t(
        "Number of customers with post-registration inquiries, assessments or customer-initiated contact/replies; excludes initial registration and profile edits. Each customer counts once, not once per interaction.",
        "Jumlah pelanggan dengan pertanyaan, tes, atau kontak/balasan setelah pendaftaran; tidak termasuk pendaftaran awal dan perubahan profil. Setiap pelanggan dihitung sekali, bukan per interaksi.",
        "登记后的咨询、测评及客户主动联系／回复；不含首次登记和资料修改。统计客户人数，同一客户只计一人，不统计互动次数。",
      ),
    },
    {
      key: "communication",
      label: t("Human conversation coverage", "Cakupan komunikasi dengan staf", "人工沟通覆盖"),
      value: `${m.engagedCustomers} / ${m.customers}`,
      hint: ratio(m.engagedCustomers, m.customers),
    },
  ];
  const communicationRows=[
    {state:'established',count:m.engagedCustomers},
    {state:'unrecorded',count:m.customers-m.engagedCustomers},
  ] as const;
  const communicationButton = ({state,count}:typeof communicationRows[number]) => (
    <button
      type="button"
      className="crm-communication-distribution-item"
      key={state}
      aria-pressed={selectedCommunication.includes(state)}
      onClick={() => onCommunication?.(state)}
      disabled={!onCommunication}
      aria-label={`${humanCommunicationLabel(state,lang)} · ${count} ${t("customers", "pelanggan", "位客户")}`}
    >
      <span>{humanCommunicationLabel(state,lang)}<b>{count}</b></span>
      <span className="crm-communication-share" aria-hidden="true">
        <i style={{width: `${m.customers ? (count / m.customers) * 100 : 0}%`}} />
      </span>
    </button>
  );
  return (
    <section
      className={`crm-process crm-lead-process crm-lead-overview${mode === "summary" ? " crm-overview-strip" : ""}`}
      data-theme={isLight ? "light" : "dark"}
      aria-label={t(
        "Customer overview and analysis",
        "Ringkasan dan analisis pelanggan",
        "客户概况与分析",
      )}
    >
      {mode !== "summary" && <p className="crm-process-scope">
        {t(
          "Current filtered cohort",
          "Pelanggan sesuai filter",
          "当前筛选客户",
        )}{" "}
        · {m.customers} · {t("As of", "Hingga", "截至")}{" "}
        {formatCrmEventTime(m.asOf)}
      </p>}
      {mode !== "analysis" && <div className="crm-overview-cards">
        {cards.map((card) => (
          <article key={card.key || "all"}>
            <button
              type="button"
              title={card.hint}
              className="crm-overview-main"
              aria-pressed={
                card.key === "communication"
                  ? selectedCommunication.includes("established")
                  : card.key
                  ? selectedMetrics.includes(card.key)
                  : selectedMetrics.length === 0
              }
              onClick={() => card.key === "communication" ? onCommunication?.("established") : onMetric?.(card.key)}
              disabled={card.key === "communication" ? !onCommunication : !onMetric}
            >
              <h3>{card.label}</h3>
              <strong>{card.value}</strong>
              {card.key !== "first_pending" && (mode !== "summary" || card.key === "communication") && <span>{card.hint}</span>}
            </button>
            {card.key === "first_pending" && (
              <button
                type="button"
                className="crm-overdue-link"
                data-overdue={m.firstOverdue > 0}
                onClick={() => onMetric?.("first_overdue")}
                disabled={!onMetric}
              >
                {t("Overdue", "Terlambat", "其中逾期")} {m.firstOverdue}
              </button>
            )}
          </article>
        ))}
      </div>}
      {mode !== "summary" && <>
      <div className="crm-communication-distribution-heading">
        <h3>
          {t(
            "Human conversation status",
            "Status komunikasi dengan staf",
            "人工沟通分布",
          )}
        </h3>
        {selectedCommunication.length > 0 && (
          <button
            type="button"
            className="crm-metric-clear"
            onClick={() => onCommunication?.("")}
          >
            {t("Clear conversation filter", "Hapus filter komunikasi", "清除沟通筛选")}
          </button>
        )}
      </div>
      <div className="crm-communication-distribution">{communicationRows.map(communicationButton)}</div>
      <details className="crm-lead-analysis" open={mode === "analysis" ? true : undefined}>
        <summary>
          {t(
            "Contact and progress analysis",
            "Analisis kontak dan perkembangan",
            "联系与推进分析",
          )}
        </summary>
        {selectedMetrics.length > 0 && (
          <p>
            {t("Metric filter", "Filter metrik", "当前指标筛选")}：
            {selectedMetrics
              .map((key) => metricSelectionLabel(key, lang))
              .join(" · ")}{" "}
            <button
              type="button"
              className="crm-metric-clear"
              onClick={() => onMetric?.("")}
            >
              {t("Clear", "Hapus", "清除")}
            </button>
          </p>
        )}
        <div className="crm-analysis-grid">
          <section>
            <h4>
              {t(
                "First requirement execution",
                "Pelaksanaan kontak pertama",
                "首次联系要求执行",
              )}
            </h4>
            <p>
              {t("On-time processing", "Diproses tepat waktu", "按时处理")}{" "}
              <b>{ratio(m.firstOnTime, m.firstTimed)}</b> · {m.firstOnTime}/
              {m.firstTimed}
            </p>
            <p>
              {t(
                "Evaluable: normal completions plus overdue pending requirements; exceptions excluded.",
                "Dinilai dari penyelesaian normal dan persyaratan tertunda yang lewat tenggat; pengecualian dipisahkan.",
                "分母：可判断的正常完成＋已逾期未完成；异常结束单独统计。",
              )}
            </p>
            {metricLink(
              "first_pending",
              t("Pending", "Belum selesai", "未完成"),
            )}
            {metricLink("first_overdue", t("Overdue", "Terlambat", "已逾期"))}
            <p>
              {t(
                "Exceptions / unknown completion timing / unknown pending deadline",
                "Pengecualian / waktu penyelesaian tidak diketahui / tenggat tertunda tidak diketahui",
                "异常结束／处理时效未知／未完成期限未知",
              )}
              ：{m.firstExceptions} / {m.firstTimingUnknown} /{" "}
              {m.firstDeadlineUnknown}
            </p>
          </section>
          <section>
            <h4>
              {t(
                "First actual sales outreach",
                "Kontak aktif pertama",
                "首次实际主动联系",
              )}
            </h4>
            <p>
              {t("Median", "Median", "中位数")}{" "}
              <b>{duration(m.firstContactMedianMs)}</b> ·{" "}
              {t("Valid samples", "Sampel valid", "有效样本")}{" "}
              {m.firstContactSamples}
            </p>
            {bands("contact")}
            <p>
              {t(
                "Unknown occurrence / contact before registration",
                "Waktu tidak diketahui / kontak sebelum pendaftaran",
                "实际时间或登记时间未知／联系早于登记",
              )}
              ：{m.contactTimeUnknown} / {m.contactBeforeRegistration}
            </p>
          </section>
          <section>
            <h4>
              {t(
                "First effective conversation",
                "Komunikasi efektif pertama",
                "首次有效沟通",
              )}
            </h4>
            <p>
              {t("Median", "Median", "中位数")}{" "}
              <b>{duration(m.firstResponseMedianMs)}</b> ·{" "}
              {t("Valid samples", "Sampel valid", "有效样本")}{" "}
              {m.firstResponseSamples}
            </p>
            {bands("response")}
            <p>
              {t(
                "Unknown time / before registration",
                "Waktu tidak diketahui / sebelum pendaftaran",
                "时间未知／早于登记",
              )}
              ：{m.responseUnknown} / {m.responseBeforeRegistration}
            </p>
          </section>
          <section>
            <h4>
              {t(
                "Latest sales contact result",
                "Hasil kontak penjualan terakhir",
                "最近销售联系结果",
              )}
            </h4>
            {(
              [
                "sales_connected",
                "sales_unanswered",
                "sales_wrong_number",
                "sales_none",
              ] as MetricSelection[]
            ).map((key) => metricLink(key, metricSelectionLabel(key, lang)))}
          </section>
          <section>
            <h4>
              {t(
                "Time since last outreach",
                "Waktu sejak kontak terakhir",
                "距上次主动联系",
              )}
            </h4>
            {(
              [
                "outreach_day",
                "outreach_week",
                "outreach_month",
                "outreach_old",
                "outreach_unknown",
                "sales_none",
              ] as MetricSelection[]
            ).map((key) => metricLink(key, metricSelectionLabel(key, lang)))}
          </section>
        </div>
        {leader && (
          <details>
            <summary>
              {t(
                "By current owner",
                "Menurut penanggung jawab saat ini",
                "按当前负责人查看",
              )}
            </summary>
            <div
              className="crm-process-table"
              role="region"
              tabIndex={0}
              aria-label={t(
                "Owner analysis",
                "Analisis penanggung jawab",
                "负责人分析",
              )}
            >
              <table>
                <thead>
                  <tr>
                    {[
                      t("Owner", "Penanggung jawab", "负责人"),
                      t("Customers", "Pelanggan", "客户"),
                      t(
                        "Pending / overdue",
                        "Belum selesai / terlambat",
                        "首次未完成／逾期",
                      ),
                      t(
                        "Conversation coverage",
                        "Cakupan komunikasi",
                        "有效沟通覆盖",
                      ),
                      t(
                        "First outreach median / samples",
                        "Median kontak pertama / sampel",
                        "首次主动联系中位数／样本",
                      ),
                    ].map((v) => (
                      <th key={v}>{v}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {m.owners.map((row) => (
                    <tr key={row.owner}>
                      <th>
                        {employees.find((e) => e.id === row.owner)
                          ?.displayName ||
                          row.owner ||
                          t("Unassigned", "Belum ditugaskan", "未分配")}
                      </th>
                      <td>{row.customers}</td>
                      <td>
                        {row.firstPending} / {row.firstOverdue}
                      </td>
                      <td>
                        {row.engagedCustomers}/{row.customers} ·{" "}
                        {ratio(row.engagedCustomers, row.customers)}
                      </td>
                      <td>
                        {duration(row.firstContactMedianMs)} /{" "}
                        {row.firstContactSamples}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}
      </details>
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
              "All values follow current filters and permissions. Categories overlap; this is not a conversion funnel.",
              "Semua angka mengikuti filter dan izin saat ini. Kategori dapat tumpang tindih; bukan corong konversi.",
              "所有数字跟随当前筛选及权限，客户可重复出现在不同指标中，不是转化漏斗。",
            )}
          </li>
          <li>
            {t(
              "Counts customers with interactions in the last 168 hours, once per customer, not interactions. Initial registration, profile edits, sales-only records and AI replies do not count.",
              "Menghitung pelanggan yang berinteraksi dalam 168 jam terakhir, sekali per pelanggan, bukan jumlah interaksi. Pendaftaran awal, perubahan profil, catatan sales saja, dan balasan AI tidak dihitung.",
              "统计截至现在168小时内有互动的客户人数，同一客户只计一人，不是互动次数；首次登记、资料修改、仅销售操作和AI回复不计入。",
            )}
            {t(
              " Unknown activity time: ",
              " Waktu interaksi tidak diketahui: ",
              " 客户互动时间未知：",
            )}
            {m.customerTimeUnknown}
          </li>
          <li>
            {t(
              "Duration uses actual occurrence and natural elapsed time. Any undated contact prevents a reliable first-contact duration; no recording time substitution.",
              "Durasi memakai waktu kejadian dan waktu kalender. Kontak tanpa waktu membuat durasi pertama tidak pasti; waktu pencatatan tidak menggantikan.",
              "时长采用实际发生时间和自然时长；存在时间未知的相关联系时，不把已知记录冒充最早联系，不用保存时间代替。",
            )}
          </li>
          <li>
            {t(
              "First contact timeliness uses the processing timestamp and deadline of the existing task.",
              "Ketepatan kontak pertama menggunakan waktu pemrosesan dan tenggat tugas yang ada.",
              "首次联系是否按时，按现有待办的处理时间和截止时间计算。",
            )}

          </li>
        </ul>
      </details>
      </>}
    </section>
  );
}

import type { CrmCampaignRecord } from "../../types/crmCampaign";
import { crmLocale, type CrmLanguage } from "../../utils/crmLanguage";
export function CrmCampaignMeasures({
  campaigns,
  lang,
  isLight,
  detail = false,
}: {
  campaigns: CrmCampaignRecord[];
  lang: CrmLanguage;
  isLight: boolean;
  detail?: boolean;
}) {
  const t = (en: string, id: string, zh: string) =>
    lang === "zh" ? zh : lang === "id" ? id : en;
  const sum = (key: string) =>
    campaigns.reduce((n, c) => n + Number(c.stats[key] || 0), 0);
  const registered = sum("leadsCount"),
    enrolled = sum("enrolledCount");
  const ratio = registered
    ? `${((100 * enrolled) / registered).toLocaleString(crmLocale(lang),{minimumFractionDigits:1,maximumFractionDigits:1})}%`
    : t("Not calculable", "Tidak dapat dihitung", "不可计算");
  const cards = [
    [
      t("Registered customers", "Pelanggan terdaftar", "已登记客户"),
      registered,
      t(
        "First campaign attribution; one saved customer record",
        "Atribusi kampanye pertama; satu catatan pelanggan tersimpan",
        "按首次活动归因统计客户记录",
      ),
    ],
    [
      t("Assessments saved", "Asesmen tersimpan", "已保存测评"),
      sum("assessedCount"),
      t(
        "Server assessment evidence; not attendance",
        "Bukti asesmen server; bukan kehadiran",
        "有服务端测评依据；不代表出席",
      ),
    ],
    [
      t("Confirmed participation", "Partisipasi terkonfirmasi", "已确认参与"),
      sum("confirmedAttendanceCount"),
      `${t("Onsite", "Di lokasi", "现场")} ${sum("onsiteAttendanceCount")} · ${t("Online", "Daring", "线上")} ${sum("onlineAttendanceCount")}`,
    ],
    [
      t("Enrollment recorded", "Pendaftaran kelas tercatat", "已记录报名"),
      enrolled,
      t(
        "Enrollment status; payment is separate",
        "Status pendaftaran kelas; pembayaran terpisah",
        "报名状态；缴费单独记录",
      ),
    ],
    [
      t("Enrollment share", "Proporsi pendaftaran kelas", "登记客户报名占比"),
      ratio,
      `${enrolled} / ${registered} · ${t("First-attributed customer cohort", "Kelompok pelanggan atribusi pertama", "首次归因客户群")}`,
    ],
    [
      t("Link opens", "Pembukaan tautan", "链接访问次数"),
      sum("impressions"),
      t(
        "Repeated opens count; not unique visitors or QR scans",
        "Pembukaan berulang dihitung; bukan pengunjung unik atau pemindaian QR",
        "包含重复打开；不等于独立访客或扫码人数",
      ),
    ],
  ];
  return (
    <section
      className="crm-process"
      data-theme={isLight ? "light" : "dark"}
      aria-label={t(
        "Campaign measurement",
        "Pengukuran kampanye",
        "营销统计口径",
      )}
    >
      <p className="crm-process-scope">
        {detail
          ? t("This campaign", "Kampanye ini", "本活动")
          : t(
              "All listed campaigns",
              "Semua kampanye dalam daftar",
              "已列出活动",
            )}{" "}
        ·{" "}
        {t(
          "Customers within your access scope; current lifetime totals",
          "Pelanggan dalam cakupan akses Anda; total kumulatif saat ini",
          "权限内客户；当前累计统计",
        )}
      </p>
      <div className="crm-process-grid">
        {cards.map(([label, value, hint]) => (
          <article key={label}>
            <h3>{label}</h3>
            <strong>
              {typeof value === "number"
                ? value.toLocaleString(crmLocale(lang))
                : value}
            </strong>
            <p>{hint}</p>
          </article>
        ))}
      </div>
      <details>
        <summary>
          {t(
            "Attribution and denominators",
            "Atribusi dan penyebut",
            "归因与分母说明",
          )}
        </summary>
        <p>
          {t(
            "Registration, assessment, participation and enrollment are independent measures, not a mandatory sequence. Repeat assessments count once per sourced customer. Participation requires a staff-confirmed campaign, mode and evidence; it can include customers first registered through another campaign. Across campaigns, participation counts campaign-customer pairs, not unique people.",
            "Pendaftaran awal, asesmen, partisipasi, dan pendaftaran kelas adalah ukuran terpisah, bukan urutan wajib. Asesmen berulang dihitung sekali per pelanggan asal. Partisipasi memerlukan kampanye, mode, dan bukti yang dikonfirmasi staf; dapat mencakup pelanggan yang pertama terdaftar melalui kampanye lain. Antar kampanye, partisipasi menghitung pasangan kampanye-pelanggan, bukan orang unik.",
            "登记、测评、参与、报名是独立指标，不是必须依次经过的漏斗。重复测评按首次归因客户计一次。参与须由员工确认活动、方式和依据，可包含首次登记来自其他活动的客户；跨活动汇总计活动—客户对，不是独立人数。",
          )}
        </p>
        <p>
          {t(
            "Enrollment share = enrollment records in the first-attributed cohort / saved customers in that cohort. It is neither causal marketing lift nor paid conversion. With no customers the rate is not calculable. Ambiguous historical campaign names are excluded until attribution is clarified. Link opens have no unique visitor denominator, so no visitor-to-lead rate is shown.",
            "Proporsi pendaftaran kelas = catatan pendaftaran kelas dalam kelompok atribusi pertama / pelanggan tersimpan dalam kelompok tersebut. Bukan dampak kausal pemasaran atau konversi pembayaran. Tanpa pelanggan, rasio tidak dapat dihitung. Nama kampanye historis yang ambigu dikecualikan sampai atribusi diperjelas. Pembukaan tautan tidak memiliki penyebut pengunjung unik; rasio kunjungan-ke-pelanggan tidak ditampilkan.",
            "报名占比＝首次归因客户中的报名记录／该客户群登记记录，不证明营销增量效果或缴费转化。无登记客户时不可计算。同名活动的历史归因有歧义时不重复计入，须先核实。访问次数没有独立访客分母，因此不展示访客获客率。",
          )}
        </p>
        <p>
          {t("Recorded amount", "Nominal tercatat", "已登记金额")}：Rp{" "}
          {sum("totalRevenue").toLocaleString(crmLocale(lang))} ·{" "}
          {t(
            "Enrollment records without an amount",
            "Pendaftaran kelas tanpa nominal",
            "未登记金额的报名客户",
          )}{" "}
          {sum("revenueMissingCount")}.{" "}
          {t(
            "Planned budget and recorded amounts do not establish actual spend, verified payment, profit or ROI.",
            "Anggaran rencana dan nominal tercatat tidak membuktikan pengeluaran aktual, pembayaran terverifikasi, laba, atau ROI.",
            "计划预算与登记金额不能证明实际花费、已核验收款、利润或投资回报率。",
          )}
        </p>
      </details>
    </section>
  );
}

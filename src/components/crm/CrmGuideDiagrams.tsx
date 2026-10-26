import React, { useState } from "react";
import type { Words } from "./CrmSystemGuide";
export type DiagramKind =
  "classification" | "acquisition" | "sla" | "notification";
const w = (en: string, id: string, zh: string): Words => [en, id, zh];
export const ruleDefinitions = [{"id": "B1", "condition": ["Initial classification", "Klasifikasi awal", "首次登记分类"], "result": ["Only first registration calculates Tier from its saved inputs. Later facts do not automatically recalculate it.", "Hanya registrasi pertama menghitung Tier dari masukan tersimpan. Fakta berikutnya tidak menghitung ulang secara otomatis.", "仅首次登记按当时输入自动分类；后续测评、诉求和阶段变化不自动重算Tier。"]}, {"id": "B2", "condition": ["Fact milestones", "Tonggak fakta", "事实里程碑"], "result": ["Saved assessment completions and explicitly confirmed enrollment retain event time and evidence. Repeated events keep separate records.", "Asesmen tersimpan dan konfirmasi pendaftaran menyimpan waktu serta bukti. Kejadian berulang tetap terpisah.", "真实测评完成与明确确认报名成立保留实际时间和依据，同类事件可重复；AI描述不能证明事件成立。"]}, {"id": "B3", "condition": ["Customer requests and interests", "Permintaan dan minat pelanggan", "客户诉求与意向"], "result": ["A price question, advisor request or assessment interest is an expression, not completed purchase. Questionnaire topics remain separate.", "Pertanyaan harga, permintaan konsultan atau minat asesmen adalah pernyataan, bukan pembelian. Topik kuesioner terpisah.", "询价、请求顾问联系、测评意向是具体表达，不等于购买承诺；问卷关注另行标明。"]}, {"id": "B4", "condition": ["Sales confirmation", "Konfirmasi sales", "销售明确确认"], "result": ["Staff confirm the current sales stage with evidence and effective time. Tier requires its own explicit confirmation. No automatic downgrade.", "Staf mengonfirmasi tahap dengan bukti dan waktu berlaku. Tier memerlukan konfirmasi tersendiri. Tanpa penurunan otomatis.", "销售按依据和生效时间明确确认当前阶段；Tier另行人工确认，R6自动降级已停用。"]}];
export const executionRules = ruleDefinitions.map(r=>r.id);
const journeyStages = [
  {
    title: w("Campaign entry", "Pintu kampanye", "活动入口"),
    customer: w(
      "Open the campaign link",
      "Buka tautan kampanye",
      "打开活动链接",
    ),
    staff: w(
      "Create campaign and share tracking link",
      "Buat kampanye dan bagikan tautan pelacakan",
      "创建活动并分享专属链接",
    ),
    system: w(
      "Record link opens; repeats included",
      "Catat pembukaan tautan; termasuk pengulangan",
      "记录链接打开次数，包含重复",
    ),
    metric: w("Link opens ≠ people", "Pembukaan ≠ orang", "打开次数 ≠ 人数"),
  },
  {
    title: w("Registration", "Registrasi", "问卷登记"),
    customer: w(
      "Submit questionnaire and contact details",
      "Kirim kuesioner dan kontak",
      "提交问卷与联系方式",
    ),
    staff: w(
      "Receive assignment or claim the customer",
      "Terima penugasan atau ambil pelanggan",
      "接受分配或认领客户",
    ),
    system: w(
      "Save customer and attribution",
      "Simpan pelanggan dan atribusi",
      "保存客户与来源归因",
    ),
    metric: w("Saved registrations", "Registrasi tersimpan", "已保存登记数"),
  },
  {
    title: w(
      "Assessment / consultation — optional",
      "Asesmen / konsultasi — opsional",
      "测评／咨询（可选）",
    ),
    customer: w(
      "Take assessment, consult or skip",
      "Ikuti asesmen, konsultasi, atau lewati",
      "测评、咨询或跳过",
    ),
    staff: w(
      "Review the saved evidence",
      "Tinjau bukti tersimpan",
      "查看已保存依据",
    ),
    system: w(
      "Save assessment and chat separately",
      "Simpan asesmen dan chat secara terpisah",
      "分别保存测评与聊天",
    ),
    metric: w(
      "Customers with assessment evidence",
      "Pelanggan dengan bukti asesmen",
      "有测评依据的客户数",
    ),
  },
  {
    title: w(
      "Follow-up / participation",
      "Tindak lanjut / partisipasi",
      "跟进／参与",
    ),
    customer: w(
      "Reply, book or participate onsite / online",
      "Balas, pesan, atau berpartisipasi luring / daring",
      "回复、预约或现场／线上参与",
    ),
    staff: w(
      "Record contact; confirm participation with evidence",
      "Catat kontak; konfirmasi partisipasi dengan bukti",
      "记录联系；凭依据确认参与",
    ),
    system: w(
      "Save tasks, outcomes and participation records",
      "Simpan tugas, hasil, dan partisipasi",
      "保存任务、结果与参与记录",
    ),
    metric: w(
      "Staff-confirmed participation",
      "Partisipasi terkonfirmasi staf",
      "员工确认参与数",
    ),
  },
  {
    title: w("Enrollment record", "Catatan pendaftaran kelas", "报名记录"),
    customer: w(
      "Request or agree to enrollment",
      "Minta atau setujui pendaftaran kelas",
      "提出或确认报名",
    ),
    staff: w(
      "Record enrollment and available business evidence",
      "Catat pendaftaran kelas dan bukti bisnis",
      "记录报名及已有业务依据",
    ),
    system: w(
      "Count saved enrollment; amounts are recorded only",
      "Hitung pendaftaran tersimpan; nominal hanya tercatat",
      "统计已记录报名，金额仅为登记",
    ),
    metric: w(
      "Recorded enrollment ≠ verified payment",
      "Pendaftaran tercatat ≠ pembayaran terverifikasi",
      "已记录报名 ≠ 已核验付款",
    ),
  },
];
export const slaSamples = [
  {
    id: "day",
    title: w("During working hours", "Dalam jam kerja", "工作时间内"),
    input: "2026-10-12T10:00:00+07:00",
    expected: "2026-10-12T13:00:00+07:00",
    steps: [
      {
        time: w("Mon 10:00", "Sen 10:00", "周一 10:00"),
        label: w("Start now", "Mulai sekarang", "立即起算"),
        off: false,
      },
      {
        time: w("10:00 → 13:00", "10:00 → 13:00", "10:00 → 13:00"),
        label: w("3 natural hours", "3 jam berlalu", "自然时长 3 小时"),
        off: false,
      },
      {
        time: w("Mon 13:00", "Sen 13:00", "周一 13:00"),
        label: w(
          "Deadline inside work hours",
          "Tenggat dalam jam kerja",
          "期限位于工作时间内",
        ),
        off: false,
      },
    ],
  },
  {
    id: "night",
    title: w("Night submission", "Kiriman malam", "夜间提交"),
    input: "2026-10-12T23:00:00+07:00",
    expected: "2026-10-13T12:00:00+07:00",
    steps: [
      {
        time: w("Mon 23:00", "Sen 23:00", "周一 23:00"),
        label: w(
          "Outside work hours: wait",
          "Di luar jam kerja: tunggu",
          "非工作时间：等待",
        ),
        off: true,
      },
      {
        time: w("Tue 09:00", "Sel 09:00", "周二 09:00"),
        label: w(
          "Next opening: start counting",
          "Jam buka berikutnya: mulai menghitung",
          "下次上班：开始计时",
        ),
        off: false,
      },
      {
        time: w("Tue 12:00", "Sel 12:00", "周二 12:00"),
        label: w(
          "After 3 natural hours: due",
          "Setelah 3 jam berlalu: jatuh tempo",
          "经过自然时长 3 小时：截止",
        ),
        off: false,
      },
    ],
  },
  {
    id: "weekend",
    title: w(
      "Deadline crosses closing",
      "Tenggat melewati tutup",
      "期限跨过下班时间",
    ),
    input: "2026-10-17T19:00:00+07:00",
    expected: "2026-10-19T09:00:00+07:00",
    steps: [
      {
        time: w("Sat 19:00", "Sab 19:00", "周六 19:00"),
        label: w(
          "Inside work hours: start",
          "Dalam jam kerja: mulai",
          "工作时间内：起算",
        ),
        off: false,
      },
      {
        time: w("Sat 22:00", "Sab 22:00", "周六 22:00"),
        label: w(
          "3 hours later, but closed",
          "3 jam kemudian, tetapi tutup",
          "3 小时后，但已下班",
        ),
        off: true,
      },
      {
        time: w("Mon 09:00", "Sen 09:00", "周一 09:00"),
        label: w(
          "Roll deadline to next opening",
          "Geser tenggat ke jam buka berikutnya",
          "期限顺延至下次上班",
        ),
        off: false,
      },
    ],
  },
  {
    id: "sunday",
    title: w("Non-working day", "Hari tidak bekerja", "非工作日"),
    input: "2026-10-18T10:00:00+07:00",
    expected: "2026-10-19T12:00:00+07:00",
    steps: [
      {
        time: w("Sun 10:00", "Min 10:00", "周日 10:00"),
        label: w(
          "Non-working day: wait",
          "Hari tidak bekerja: tunggu",
          "非工作日：等待",
        ),
        off: true,
      },
      {
        time: w("Mon 09:00", "Sen 09:00", "周一 09:00"),
        label: w(
          "Next opening: start counting",
          "Jam buka berikutnya: mulai menghitung",
          "下次上班：开始计时",
        ),
        off: false,
      },
      {
        time: w("Mon 12:00", "Sen 12:00", "周一 12:00"),
        label: w(
          "After 3 natural hours: due",
          "Setelah 3 jam berlalu: jatuh tempo",
          "经过自然时长 3 小时：截止",
        ),
        off: false,
      },
    ],
  },
];
const notificationSteps = [
  w(
    "Save business data + Outbox event in one transaction",
    "Simpan data bisnis + peristiwa Outbox dalam satu transaksi",
    "同一事务保存业务数据＋Outbox 事件",
  ),
  w(
    "Match enabled policy, conditions and calendar; preserve rule version",
    "Cocokkan kebijakan aktif, kondisi, dan kalender; simpan versi aturan",
    "匹配已启用策略、条件及日历；保存规则版本",
  ),
  w(
    "Create persistent notification jobs and scheduled time",
    "Buat pekerjaan notifikasi tersimpan dan waktu terjadwal",
    "创建持久通知任务及计划发送时间",
  ),
  w(
    "Before sending: check task, recipient and contact arrangement again",
    "Sebelum kirim: periksa lagi tugas, penerima, dan pengaturan kontak",
    "发送前再次核查任务、接收对象及联系安排",
  ),
  w(
    "Execute in-app / Lark sender and save delivery evidence",
    "Jalankan pengirim aplikasi / Lark dan simpan bukti pengiriman",
    "执行站内／Lark 发送器并保存发送证据",
  ),
];
const receipts = [
  {
    tone: "success",
    title: w("API accepted", "Diterima API", "接口接受"),
    body: w(
      "Provider accepted; staff reading and follow-up remain separate",
      "Penyedia menerima; staf membaca dan menindaklanjuti dicatat terpisah",
      "依据客户事实、原始证据和实际进展自主判断；提示不创建任务，无需阅读确认或销单。",
    ),
  },
  {
    tone: "neutral",
    title: w("Explicit simulation", "Simulasi eksplisit", "明确模拟"),
    body: w(
      "No external message; a missing channel is a failure, not simulation",
      "Tidak ada pesan eksternal; kanal hilang berarti gagal, bukan simulasi",
      "没有外发；缺失渠道是失败，不是模拟",
    ),
  },
  {
    tone: "failure",
    title: w("Definite failure", "Kegagalan pasti", "明确失败"),
    body: w(
      "Retry temporary failures by policy; final failure stays visible to Managers",
      "Ulangi gangguan sementara sesuai kebijakan; gagal akhir terlihat oleh Manajer",
      "暂时失败按策略重试；最终失败供管理者查看",
    ),
  },
  {
    tone: "review",
    title: w("Outcome unknown", "Hasil tidak diketahui", "结果未知"),
    body: w(
      "Verify before retrying; do not assume failure or blindly resend",
      "Periksa sebelum mengulang; jangan anggap gagal atau kirim ulang sembarangan",
      "核查后再决定重试，不假定失败或盲目重发",
    ),
  },
];
export const diagramSearchText = {
  classification: ruleDefinitions,
  acquisition: journeyStages,
  sla: slaSamples,
  notification: [notificationSteps, receipts],
};
function Arrow({ down = false }: { down?: boolean }) {
  return (
    <svg
      className={down ? "crm-diagram-arrow down" : "crm-diagram-arrow"}
      aria-hidden="true"
      viewBox="0 0 30 24"
    >
      <path
        d="M2 12H26M18 4L26 12L18 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  );
}
export function CrmGuideDiagram({
  kind,
  col,
}: {
  kind: DiagramKind;
  col: number;
}) {
  const t = (en: string, id: string, zh: string) => [en, id, zh][col];
  const [sampleId, setSampleId] = useState("night");
  if (kind === "classification") return <figure className="crm-business-diagram" data-diagram={kind}><figcaption>{t('Facts, intent and sales decisions have different responsibilities','Fakta, minat dan keputusan sales memiliki peran berbeda','事实、诉求与销售决策各有边界')}</figcaption><ol className="crm-doc-flow">{ruleDefinitions.map(r=><li key={r.id} data-boundary={r.id}><strong>{r.condition[col]}</strong><p>{r.result[col]}</p></li>)}</ol></figure>;
  if (kind === "acquisition")
    return (
      <figure className="crm-business-diagram" data-diagram={kind}>
        <figcaption>
          {t(
            "Who acts, what is saved, and what is counted",
            "Siapa bertindak, apa tersimpan, apa dihitung",
            "谁行动、保存什么、统计什么",
          )}
        </figcaption>
        <p className="crm-journey-shortcut">
          {t(
            "Assessment is optional. Customers may consult or enroll without passing through every stage.",
            "Asesmen opsional. Pelanggan dapat berkonsultasi atau mendaftar kelas tanpa melewati semua tahap.",
            "测评可选。客户可以直接咨询或报名，不必经历所有阶段。",
          )}
        </p>
        <table className="crm-swimlane">
          <caption className="sr-only">
            {t(
              "Campaign acquisition responsibility swimlane",
              "Alur tanggung jawab akuisisi kampanye",
              "活动获客职责泳道",
            )}
          </caption>
          <thead>
            <tr>
              <th>{t("Role", "Peran", "角色")}</th>
              {journeyStages.map((s, i) => (
                <th key={i} scope="col">
                  <span className="crm-diagram-step">{i + 1}</span>
                  {s.title[col]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(["customer", "staff", "system"] as const).map((role, i) => (
              <tr key={role}>
                <th scope="row">
                  {
                    [
                      w("Customer", "Pelanggan", "客户"),
                      w(
                        "Sales / Manager",
                        "Staf penjualan / Manajer",
                        "销售／管理者",
                      ),
                      w("System", "Sistem", "系统"),
                    ][i][col]
                  }
                </th>
                {journeyStages.map((s, j) => (
                  <td key={j}>
                    {s[role][col]}
                    {role === "system" && (
                      <small className="crm-diagram-metric">
                        {s.metric[col]}
                      </small>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <ol
          className="crm-swimlane-mobile"
          aria-label={t(
            "Acquisition stages and responsibilities",
            "Tahap akuisisi dan tanggung jawab",
            "获客阶段及职责",
          )}
        >
          {journeyStages.map((s, i) => (
            <li key={i}>
              <h5>
                {i + 1} · {s.title[col]}
              </h5>
              <dl>
                {(["customer", "staff", "system"] as const).map((role, j) => (
                  <div key={role}>
                    <dt>
                      {
                        [
                          w("Customer", "Pelanggan", "客户"),
                          w(
                            "Sales / Manager",
                            "Staf penjualan / Manajer",
                            "销售／管理者",
                          ),
                          w("System", "Sistem", "系统"),
                        ][j][col]
                      }
                    </dt>
                    <dd>{s[role][col]}</dd>
                  </div>
                ))}
              </dl>
              <small>{s.metric[col]}</small>
            </li>
          ))}
        </ol>
        <p className="crm-diagram-note">
          {t(
            "These are separate evidence counts, not a strict conversion funnel. Registration or assessment does not confirm attendance, and enrollment does not confirm payment.",
            "Jumlah bukti ini terpisah, bukan corong konversi ketat. Registrasi atau asesmen tidak mengonfirmasi kehadiran; pendaftaran kelas tidak mengonfirmasi pembayaran.",
            "各项依据分别计数，不是严格转化漏斗。登记或测评不证明参与，报名不证明付款。",
          )}
        </p>
      </figure>
    );
  if (kind === "sla") {
    const sample = slaSamples.find((s) => s.id === sampleId)!;
    return (
      <figure className="crm-business-diagram" data-diagram={kind}>
        <figcaption>
          {t(
            "Sample calendar: Asia/Jakarta · Mon–Sat 09:00–20:00 · 3 natural hours",
            "Kalender contoh: Asia/Jakarta · Sen–Sab 09:00–20:00 · 3 jam berlalu",
            "示例日历：Asia/Jakarta · 周一至周六 09:00–20:00 · 自然时长 3 小时",
          )}
        </figcaption>
        <div
          className="crm-sla-cases"
          role="group"
          aria-label={t(
            "Timeline examples",
            "Contoh garis waktu",
            "时间轴案例",
          )}
        >
          {slaSamples.map((s) => (
            <button
              key={s.id}
              aria-pressed={sampleId === s.id}
              onClick={() => setSampleId(s.id)}
            >
              {s.title[col]}
            </button>
          ))}
        </div>
        <ol
          className="crm-sla-timeline"
          aria-label={sample.title[col]}
          data-sla-sample={sample.id}
        >
          {sample.steps.map((step, i) => (
            <li key={i} className={step.off ? "off-hours" : "work-hours"}>
              <span className="crm-diagram-step">{i + 1}</span>
              <strong>{step.time[col]}</strong>
              <p>{step.label[col]}</p>
              {i < sample.steps.length - 1 && <Arrow />}
            </li>
          ))}
        </ol>
        <p className="crm-diagram-note">
          {t(
            "Outside-hours submissions start at the next opening. Add natural duration, then roll a closed-time deadline to the next opening. This is not accumulated business hours. The diagram is schematic, not to scale; changing policy does not rewrite saved deadlines.",
            "Kiriman di luar jam kerja dimulai saat buka berikutnya. Tambahkan durasi berlalu, lalu geser tenggat di waktu tutup ke buka berikutnya. Ini bukan akumulasi jam kerja. Diagram tidak berskala; perubahan kebijakan tidak mengubah tenggat tersimpan.",
            "非工作时间提交从下次上班起算；加自然时长后，若期限落在非工作时间，再顺延至下次上班。不是累计工作小时。图示不按时间比例绘制，修改策略不重写已有期限。",
          )}
        </p>
      </figure>
    );
  }
  return (
    <figure className="crm-business-diagram" data-diagram="notification">
      <figcaption>
        {t(
          "From business save to delivery evidence",
          "Dari penyimpanan bisnis ke bukti pengiriman",
          "从业务保存到发送证据",
        )}
      </figcaption>
      <ol
        className="crm-notification-chain"
        aria-label={t(
          "Notification execution chain",
          "Rantai eksekusi notifikasi",
          "通知执行链",
        )}
      >
        {notificationSteps.map((step, i) => (
          <li key={i}>
            <span className="crm-diagram-step">{i + 1}</span>
            {step[col]}
            {i < notificationSteps.length - 1 && <Arrow down />}
            {i === 2 && (
              <div className="crm-notification-routing">
                <strong>
                  {t("Recipient route", "Rute penerima", "接收对象路由")}
                </strong>
                <dl>
                  <div>
                    <dt>
                      {t("Valid owner", "Penanggung jawab valid", "有效负责人")}
                    </dt>
                    <dd>
                      <Arrow />
                      {t("Owner", "Penanggung jawab", "负责人")}
                    </dd>
                  </div>
                  <div>
                    <dt>
                      {t(
                        "Unassigned / invalid owner",
                        "Kosong / penanggung jawab tidak valid",
                        "未分配／负责人无效",
                      )}
                    </dt>
                    <dd>
                      <Arrow />
                      {t(
                        "Authorized CRM Managers",
                        "Manajer CRM berizin",
                        "有权限的 CRM 管理者",
                      )}
                    </dd>
                  </div>
                </dl>
              </div>
            )}
            {i === 3 && (
              <p className="crm-diagram-note">
                {t(
                  "Completed linked task → cancel its pending notification. A message already accepted externally is not recalled.",
                  "Tugas terkait selesai → batalkan notifikasi tertunda terkait. Pesan yang sudah diterima penyedia tidak ditarik kembali.",
                  "关联任务已完成 → 取消该任务待发通知。已经被外部接口接受的消息不伪装撤回。",
                )}
              </p>
            )}
          </li>
        ))}
      </ol>
      <div className="crm-receipt-branches">
        <h5>
          {t(
            "Delivery result branches",
            "Cabang hasil pengiriman",
            "发送结果分支",
          )}
        </h5>
        <div>
          {receipts.map((r) => (
            <section key={r.tone} className={"crm-receipt " + r.tone}>
              <h6>{r.title[col]}</h6>
              <p>{r.body[col]}</p>
            </section>
          ))}
        </div>
      </div>
      <p className="crm-diagram-note">
        {t(
          "Staff reading and actual follow-up are recorded independently. Historical frozen failures remain in audit without automatic replay.",
          "Staf membaca dan tindak lanjut dicatat terpisah. Kegagalan lama yang dibekukan tetap diaudit tanpa pengiriman ulang otomatis.",
          "依据客户事实、原始证据和实际进展自主判断；提示不创建任务，无需阅读确认或销单。",
        )}
      </p>
    </figure>
  );
}

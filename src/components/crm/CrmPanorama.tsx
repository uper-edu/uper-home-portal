import React, { useState } from "react";
import {
  panoramaNodes,
  panoramaRoles,
  panoramaModules,
  panoramaData,
  panoramaStates,
  panoramaCases,
  panoramaLesson,
} from "./CrmPanoramaContent";
import type { Words } from "./CrmSystemGuide";

export function CrmPanorama({ col }: { col: number }) {
  const [selected, setSelected] = useState(2);
  const [scenario, setScenario] = useState(0);
  const t = (en: string, id: string, zh: string) => [en, id, zh][col];
  const c = panoramaCases[scenario];
  const groups: [string, typeof panoramaRoles, Words][] = [
    [
      t("Where to work", "Tempat bekerja", "模块与工作入口"),
      panoramaModules,
      [
        "Modules share customer evidence while retaining distinct responsibilities.",
        "Modul berbagi bukti pelanggan dengan tanggung jawab berbeda.",
        "各模块关联客户依据，并分别承担不同职责。",
      ],
    ],
    [
      t("Roles and boundaries", "Peran dan batasan", "角色与权限边界"),
      panoramaRoles,
      [
        "Actual role grants determine access. Owner responsibility and user roles are separate. CMS and recruitment responsibilities belong to separate workspaces.",
        "Izin peran aktual menentukan akses. Tanggung jawab penanggung jawab dan peran pengguna berbeda. CMS dan rekrutmen berada di ruang kerja terpisah.",
        "实际角色授权决定权限；负责人关系与用户角色分开。CMS和招聘属于其他工作区。",
      ],
    ],
    [
      t("Data and relationships", "Data dan hubungan", "数据与关系"),
      panoramaData,
      [
        "Records connect through the customer without replacing one another. The follow-up tab, conversation tab, profile and assessment present different evidence.",
        "Catatan terhubung melalui pelanggan tanpa saling menggantikan. Tab tindak lanjut, percakapan, profil, dan asesmen menyajikan bukti berbeda.",
        "不同记录通过客户关联，不能互相替代。跟进、对话、客户资料和测评四个页签分别呈现不同依据。",
      ],
    ],
    [
      t(
        "Six independent state dimensions",
        "Enam dimensi status terpisah",
        "六个独立状态维度",
      ),
      panoramaStates,
      [
        "High intent, waiting for review and an overdue task can coexist. Waiting does not erase the original deadline.",
        "Minat tinggi, menunggu peninjauan, dan tugas terlambat dapat terjadi bersamaan. Menunggu tidak menghapus tenggat asli.",
        "高意向、等待复查和任务逾期可以同时成立；等待不抹去原期限。",
      ],
    ],
  ];
  return (
    <div className="crm-panorama">
      <p className="crm-learning-answer">{panoramaLesson.answer[col]}</p>
      <figure className="crm-panorama-main">
        <p className="crm-learning-hint">
          {t(
            "Select a module to explore its responsibility. Arrows show relationships, not mandatory steps.",
            "Pilih modul untuk melihat tanggung jawabnya. Panah menunjukkan hubungan, bukan tahapan wajib.",
            "选择模块查看职责；箭头表示关系，不表示人人必经的步骤。",
          )}
        </p>
        <ol
          className="crm-panorama-flow"
          aria-label={t("Business flow", "Alur bisnis", "业务主线")}
        >
          {panoramaNodes.slice(0, 5).map((n, i) => (
            <li key={i}>
              <button
                type="button"
                aria-pressed={selected === i}
                aria-controls="crm-panorama-module-detail"
                onClick={() => setSelected(i)}
              >
                {n.label[col]}
              </button>
              {i < 4 && (
                <span aria-hidden="true" className="crm-panorama-arrow">
                  →
                </span>
              )}
            </li>
          ))}
        </ol>
        <p className="crm-panorama-loop">
          ↶{" "}
          {t(
            "Recorded outcome → keep, add or explicitly adjust the next arrangement",
            "Hasil tercatat → pertahankan, tambah, atau sesuaikan pengaturan berikutnya secara eksplisit",
            "记录结果 → 保留、新增或明确调整后续安排",
          )}
        </p>
        <div className="crm-panorama-async">
          <span>
            {t(
              "Events and checks →",
              "Peristiwa dan pemeriksaan →",
              "事件与校验 →",
            )}
          </span>
          {panoramaNodes.slice(5).map((n, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span aria-hidden="true">→</span>}
              <button
                type="button"
                aria-pressed={selected === i + 5}
                aria-controls="crm-panorama-module-detail"
                onClick={() => setSelected(i + 5)}
              >
                {n.label[col]}
              </button>
            </React.Fragment>
          ))}
        </div>
        <div
          className="crm-learning-selected"
          id="crm-panorama-module-detail"
          aria-live="polite"
        >
          <strong>{panoramaNodes[selected].label[col]}</strong>
          <p>{panoramaNodes[selected].detail[col]}</p>
        </div>
        <figcaption>{panoramaLesson.caption[col]}</figcaption>
      </figure>
      {groups.map(([title, items, caption], group) => (
        <section className="crm-panorama-group" key={group}>
          <h4>{title}</h4>
          <figure>
            <dl className={`crm-panorama-grid crm-panorama-grid-${group}`}>
              {items.map((item, i) => (
                <div key={i}>
                  <dt>{item.label[col]}</dt>
                  <dd>{item.detail[col]}</dd>
                </div>
              ))}
            </dl>
            <figcaption>{caption[col]}</figcaption>
          </figure>
        </section>
      ))}
      <section className="crm-panorama-group">
        <h4>
          {t(
            "Decisions when information changes",
            "Keputusan saat informasi berubah",
            "信息变化后的决策",
          )}
        </h4>
        <figure>
          <div className="crm-panorama-scenarios">
            <div
              className="crm-panorama-options"
              role="group"
              aria-label={t(
                "Choose a scenario",
                "Pilih skenario",
                "选择业务情境",
              )}
            >
              {panoramaCases.map((item, i) => (
                <button
                  type="button"
                  key={i}
                  aria-pressed={scenario === i}
                  aria-controls="crm-panorama-scenario"
                  onClick={() => setScenario(i)}
                >
                  {item.title[col]}
                </button>
              ))}
            </div>
            <div id="crm-panorama-scenario" aria-live="polite">
              <h5>{c.title[col]}</h5>
              <dl>
                {[
                  [t("Trigger", "Pemicu", "触发条件"), c.trigger],
                  [
                    t("System handling", "Penanganan sistem", "系统处理"),
                    c.system,
                  ],
                  [t("Human decision", "Keputusan staf", "人工决定"), c.human],
                  [t("Boundary", "Batasan", "保护边界"), c.boundary],
                ].map(([label, copy], i) => (
                  <div key={i}>
                    <dt>{label as string}</dt>
                    <dd>{(copy as Words)[col]}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
          <figcaption>
            {t(
              "These examples explain current rules. They do not infer customer intent from arbitrary chat text.",
              "Contoh ini menjelaskan aturan saat ini. Sistem tidak menyimpulkan niat pelanggan dari sembarang teks chat.",
              "这些情境说明现有规则，不代表从任意聊天文字自行推断客户意图。",
            )}
          </figcaption>
        </figure>
      </section>
      <aside className="crm-learning-boundary">
        <h4>{t("Capability boundary", "Batas kemampuan", "当前能力边界")}</h4>
        <p>{panoramaLesson.boundary[col]}</p>
        <p>
          {t(
            "Prices, class schedules, availability and promotions need reliable evidence before staff present an offer. The diagram does not promise automatic offer selection.",
            "Harga, jadwal kelas, ketersediaan, dan promosi memerlukan bukti yang andal sebelum staf menawarkan. Diagram ini tidak menjanjikan pemilihan penawaran otomatis.",
            "价格、班期、席位及优惠需有可靠依据，再向客户提出方案；本图不承诺自动选择最合适的优惠。",
          )}
        </p>
      </aside>
      <nav
        className="crm-panorama-related"
        aria-label={t(
          "Explore the mechanisms",
          "Pelajari mekanisme",
          "继续理解机制",
        )}
      >
        {[
          [
            "architecture",
            t(
              "Purpose and architecture",
              "Tujuan dan arsitektur",
              "系统定位与架构",
            ),
          ],
          [
            "acquisition",
            t(
              "Acquisition and attribution",
              "Akuisisi dan atribusi",
              "获客与归因",
            ),
          ],
          [
            "classification",
            t("Classification rules", "Aturan klasifikasi", "客户分类规则"),
          ],
          [
            "tasks-sla",
            t("Tasks and deadlines", "Tugas dan tenggat", "任务与期限"),
          ],
          [
            "notification-system",
            t("Notification mechanism", "Mekanisme notifikasi", "通知机制"),
          ],
          [
            "followup",
            t("Record a follow-up", "Catat tindak lanjut", "记录跟进操作"),
          ],
        ].map(([key, label]) => (
          <a href={"#crm-guide-" + key} key={key}>
            {label} →
          </a>
        ))}
      </nav>
    </div>
  );
}

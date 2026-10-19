import React, { useState } from "react";
import {
  panoramaNodes,
  panoramaRoles,
  panoramaModules,
  panoramaConcepts,
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
        "CRM handles customer work. CMS manages website content; System management maintains accounts and permissions. Their operating instructions belong to their own workspaces.",
        "CRM menangani pekerjaan pelanggan. CMS mengelola konten situs; Manajemen sistem mengelola akun dan izin. Petunjuk operasinya berada di ruang kerja masing-masing.",
        "CRM负责客户业务；CMS管理网站内容，系统管理维护账号与权限，具体操作在各自工作区查阅。",
      ],
    ],
    [
      t("Roles and boundaries", "Peran dan batasan", "角色与权限边界"),
      panoramaRoles,
      [
        "Actual grants determine access. Owner responsibility is separate from a user's roles.",
        "Izin aktual menentukan akses. Tanggung jawab penanggung jawab berbeda dari peran pengguna.",
        "实际授权决定权限；客户负责人关系与用户角色分开。",
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
      <div className="crm-learning-value">
        <h4>
          {t("Why this helps sales", "Manfaat bagi sales", "它解决什么问题")}
        </h4>
        <p>{panoramaLesson.value[col]}</p>
      </div>
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
            "Concepts to keep separate",
            "Konsep yang perlu dibedakan",
            "需要分清的概念",
          )}
        </h4>
        <figure>
          <dl className="crm-panorama-grid crm-panorama-concepts">
            {panoramaConcepts.map((item, i) => (
              <div key={i}>
                <dt>{item.label[col]}</dt>
                <dd>
                  {item.detail[col]}{" "}
                  <a href={"#crm-guide-" + item.chapter}>
                    {t("Read the explanation", "Baca penjelasan", "深入理解")} →
                  </a>
                </dd>
              </div>
            ))}
          </dl>
          <figcaption>
            {t(
              "Use the linked chapters for definitions and rules; this overview only introduces the distinctions.",
              "Gunakan bab tertaut untuk definisi dan aturan; gambaran ini hanya memperkenalkan perbedaannya.",
              "定义与规则在对应章节展开，总览只提示概念之间的区别。",
            )}
          </figcaption>
        </figure>
      </section>
      <details className="crm-panorama-details">
        <summary>
          {t(
            "Explore seven decision scenarios",
            "Jelajahi tujuh skenario keputusan",
            "按需查看七个决策情境",
          )}
        </summary>
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
      </details>
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
            "entities",
            t(
              "Core concepts and relationships",
              "Konsep inti dan hubungan",
              "核心概念与关系",
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
            "data-implementation",
            t("Data and implementation", "Data dan implementasi", "数据与实现"),
          ],
          [
            "access",
            t(
              "Accounts and version checks",
              "Akun dan pemeriksaan versi",
              "账号与版本核对",
            ),
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

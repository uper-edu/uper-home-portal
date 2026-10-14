import React, { useEffect, useState } from "react";
import { guideSections, type GuideLanguage } from "./CrmGuideContent";
import { systemChapters, type Words } from "./CrmSystemGuide";
import { dictionaryMeaning, dictionaryWriter } from "./CrmDictionaryMeaning";
import dictionary from "./crmDictionary.json";
export const oldChapterKeys = [
  "architecture",
  "acquisition",
  "classification",
  "ai-assessment",
  "lifecycle",
  "tasks-sla",
  "followup",
  "data-implementation",
  "support",
  "ai-assessment",
];
export const operationGroups = [
  ["access"],
  ["workspace", "efficient-followup", "filters", "visual-status"],
  ["followup"],
  ["chat"],
  ["assessment"],
  ["campaigns"],
  ["operations"],
  ["notifications"],
  ["support", "failure-and-accessibility", "process-and-marketing-metrics"],
];
const concepts: Record<string, string> = {
  access: "architecture",
  workspace: "entities",
  "efficient-followup": "lifecycle",
  filters: "classification",
  "visual-status": "tasks-sla",
  followup: "tasks-sla",
  chat: "entities",
  assessment: "ai-assessment",
  campaigns: "acquisition",
  operations: "tasks-sla",
  notifications: "notification-system",
  support: "data-implementation",
  "failure-and-accessibility": "data-implementation",
  "process-and-marketing-metrics": "measurement",
};
export function resolveGuideAnchor(hash: string) {
  const value = hash.replace(/^#/, "");
  const old = value.match(/^chapter-(\d+)$/);
  let key = old
    ? oldChapterKeys[Number(old[1]) - 1]
    : value.replace(/^crm-guide-/, "");
  if (key === "fields") key = "data-implementation";
  if (systemChapters.some((s) => s.key === key)) return { part: "system", key };
  if (guideSections.some((s) => s.key === key))
    return { part: "operations", key };
  return null;
}
export function CrmUserGuide({
  isLight,
  lang,
  onNavigateTab,
}: {
  isLight: boolean;
  lang: GuideLanguage;
  onNavigateTab?: (tab: "leads" | "campaigns" | "policy" | "docs") => void;
}) {
  const col = lang === "zh" ? 2 : lang === "id" ? 1 : 0,
    t = (en: string, id: string, zh: string) => [en, id, zh][col];
  const initialHash = typeof window === "undefined" ? "" : window.location.hash;
  const initialChapter = resolveGuideAnchor(initialHash);
  const [part, setPart] = useState(() => initialChapter?.part || "system"),
    [query, setQuery] = useState(""),
    [invalid, setInvalid] = useState(
      () => !!initialHash && !initialChapter && initialHash !== "#crm-main",
    ),
    [target, setTarget] = useState(() => initialChapter?.key || "");
  useEffect(() => {
    const locate = () => {
      if (!location.hash || location.hash === "#crm-main") {
        setInvalid(false);
        return;
      }
      const resolved = resolveGuideAnchor(location.hash);
      setInvalid(!resolved);
      if (resolved) {
        setPart(resolved.part);
        setQuery("");
        setTarget(resolved.key);
      }
    };
    window.addEventListener("hashchange", locate);
    return () => window.removeEventListener("hashchange", locate);
  }, []);
  useEffect(() => {
    if (!target) return;
    const id = requestAnimationFrame(() => {
      const el = document.getElementById("crm-guide-" + target);
      el?.scrollIntoView({ block: "start" });
      el?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(id);
  }, [target, part]);
  const terms = query.trim().toLocaleLowerCase();
  const includes = (data: unknown) =>
    JSON.stringify(data).toLocaleLowerCase().includes(terms);
  const fieldMatches = dictionary.filter((r) =>
    includes([
      r.key,
      r.object,
      r.type,
      dictionaryMeaning(r)[col],
      dictionaryWriter(r)[col],
    ]),
  );
  const system = systemChapters.filter(
    (s) =>
      includes([
        s.title[col],
        s.intro[col],
        s.technical[col],
        s.blocks.map((b) => [b.title[col], b.items.map((i) => i[col])]),
      ]) ||
      (s.key === "data-implementation" && fieldMatches.length > 0),
  );
  const operations = operationGroups
    .flat()
    .map((key) => guideSections.find((s) => s.key === key)!)
    .filter((s) => includes([s.title[col], s.body.map((r) => r[col])]));
  const visible = terms
    ? [
        ...system.map((s) => ({ ...s, part: "system" })),
        ...operations.map((s) => ({ ...s, part: "operations" })),
      ]
    : part === "system"
      ? system.map((s) => ({ ...s, part }))
      : operationGroups.map((group) => ({
          ...guideSections.find((s) => s.key === group[0])!,
          part,
        }));
  const link = (key: string) => "#crm-guide-" + key;
  const choose = (key: string) => {
    const resolved = resolveGuideAnchor(key);
    if (resolved) {
      setPart(resolved.part);
      setQuery("");
      setTarget("");
      requestAnimationFrame(() => setTarget(resolved.key));
    }
  };
  const fieldsByObject: Record<string, typeof dictionary> = {};
  for (const row of fieldMatches)
    (fieldsByObject[`${row.layer}:${row.object}`] ??= []).push(row);
  return (
    <article className="crm-docs" data-theme={isLight ? "light" : "dark"}>
      <header className="crm-doc-card">
        <h2 className="text-xl font-bold">
          {t("CRM documentation", "Dokumentasi CRM", "CRM 系统文档")}
        </h2>
        <p>
          {t(
            "Understand the system, then handle customers confidently. Implementation reviewed: 14 October 2026.",
            "Pahami sistem, lalu tangani pelanggan dengan yakin. Implementasi ditinjau: 14 Oktober 2026.",
            "理解系统，再准确处理客户。实现核对日期：2026 年 10 月 14 日。",
          )}
        </p>
        <div
          className="crm-doc-tabs"
          role="group"
          aria-label={t(
            "Documentation parts",
            "Bagian dokumentasi",
            "文档部分",
          )}
        >
          {["system", "operations"].map((p, i) => (
            <button
              key={p}
              aria-pressed={part === p}
              onClick={() => {
                setPart(p);
                setQuery("");
                setTarget("");
                setInvalid(false);
                window.history.replaceState(
                  window.history.state,
                  "",
                  link(p === "system" ? "architecture" : "access"),
                );
              }}
            >
              {i === 0
                ? t("System explanation", "Penjelasan sistem", "系统说明")
                : t("Operating guide", "Panduan operasi", "操作指南")}
            </button>
          ))}
        </div>
        <label>
          {t(
            "Search both parts, rules and fields",
            "Cari kedua bagian, aturan, dan kolom",
            "搜索两部分、规则与字段",
          )}
          <input
            className="crm-doc-search"
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setTarget("");
            }}
          />
        </label>
        <div className="crm-doc-links">
          <button onClick={() => onNavigateTab?.("leads")}>
            {t(
              "Open customer worklist",
              "Buka daftar pelanggan",
              "打开客户工作列表",
            )}
          </button>
          <button onClick={() => onNavigateTab?.("campaigns")}>
            {t("Open campaigns", "Buka kampanye", "打开营销活动")}
          </button>
        </div>
      </header>
      {invalid && (
        <p role="status">
          {t(
            "Chapter link not found. Choose a chapter below.",
            "Tautan bab tidak ditemukan. Pilih bab di bawah.",
            "章节链接不存在，请选择下方章节。",
          )}
        </p>
      )}
      <div className="crm-doc-layout">
        <nav
          className="crm-doc-card crm-doc-nav"
          aria-label={t("Guide chapters", "Bab panduan", "文档章节")}
        >
          {visible.map((s) => (
            <a
              key={s.key}
              href={link(s.key)}
              onClick={(event) => {
                if (terms) {
                  event.preventDefault();
                  setPart(s.part);
                  setTarget(s.key);
                  window.history.replaceState(
                    window.history.state,
                    "",
                    link(s.key),
                  );
                } else choose(s.key);
              }}
            >
              {terms && (
                <small>
                  {s.part === "system"
                    ? t("System", "Sistem", "系统")
                    : t("Operations", "Operasi", "操作")}{" "}
                  ·{" "}
                </small>
              )}
              {s.title[col]}
            </a>
          ))}
        </nav>
        <div className="min-w-0">
          {visible.length === 0 && (
            <p role="status">
              {t(
                "No matching chapters",
                "Tidak ada bab yang cocok",
                "没有匹配的章节",
              )}
            </p>
          )}
          {(terms || part === "system") &&
            system.map((s) => (
              <section
                className="crm-doc-card crm-doc-section"
                tabIndex={-1}
                id={"crm-guide-" + s.key}
                key={s.key}
              >
                <h3>{s.title[col]}</h3>
                <p>{s.intro[col]}</p>
                {s.blocks.map((b, i) => (
                  <div key={i}>
                    <h4>{b.title[col]}</h4>
                    {b.kind === "flow" ? (
                      <ol className="crm-doc-flow" aria-label={b.title[col]}>
                        {b.items.map((item, j) => (
                          <li key={j}>
                            <b>{j + 1}</b>
                            {item[col]}
                            {j < b.items.length - 1 && (
                              <svg aria-hidden="true" viewBox="0 0 28 18">
                                <path
                                  d="M1 9H25M17 2L25 9L17 16"
                                  stroke="currentColor"
                                  fill="none"
                                  strokeWidth="2"
                                />
                              </svg>
                            )}
                          </li>
                        ))}
                      </ol>
                    ) : b.kind === "table" ? (
                      <table className="crm-doc-table">
                        <caption className="sr-only">{b.title[col]}</caption>
                        <tbody>
                          {b.items.map((item, j) => (
                            <tr key={j}>
                              <th scope="row">{j + 1}</th>
                              <td>{item[col]}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="crm-doc-example">
                        {b.items.map((item, j) => (
                          <p key={j}>{item[col]}</p>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                <details open={!!terms}>
                  <summary>
                    {t(
                      "Implementation and limitations",
                      "Implementasi dan batasan",
                      "技术实现与限制",
                    )}
                  </summary>
                  <p>{s.technical[col]}</p>
                  <small>
                    {t(
                      "Implementation references",
                      "Referensi implementasi",
                      "实现依据",
                    )}
                    : {s.sources.join(" · ")}
                  </small>
                  {s.key === "data-implementation" && (
                    <div className="crm-doc-dict">
                      <h4>
                        {t(
                          "Current contracts and storage fields",
                          "Kontrak dan kolom penyimpanan saat ini",
                          "当前契约与存储字段",
                        )}{" "}
                        · {fieldMatches.length}/{dictionary.length}
                      </h4>
                      <p>
                        {t(
                          "Search above to locate fields. Expand an object to read its fields. Types and internal values remain code identifiers; optional means omission/null in the declaration, not permission to skip a required business step. Nested JSON properties use dotted paths. Descriptions are guidance; the source declaration defines the contract.",
                          "Cari kolom melalui pencarian di atas. Buka objek untuk membaca kolomnya. Tipe dan nilai internal tetap berupa kode; opsional berarti kosong/null dalam deklarasi, bukan izin melewati langkah wajib. Properti JSON bertingkat memakai jalur bertitik. Deskripsi adalah panduan; deklarasi sumber menentukan kontrak.",
                          "通过顶部搜索定位字段，展开对象查看字段。类型及内部取值保留代码标识；可选表示声明允许缺省／空值，不表示可跳过必需业务步骤。嵌套 JSON 使用点路径。说明供理解，具体契约以源码声明为准。",
                        )}
                      </p>
                      {Object.entries(fieldsByObject).map(([object, rows]) => (
                        <details open={!!terms} key={object}>
                          <summary>
                            {rows[0].layer === "storage"
                              ? t("Storage", "Penyimpanan", "存储")
                              : t("Contract", "Kontrak", "契约")}{" "}
                            · {rows[0].object} · {rows.length}
                          </summary>
                          <p>{dictionaryWriter(rows[0])[col]}</p>
                          <div
                            className="crm-doc-table-scroll"
                            tabIndex={0}
                            aria-label={t(
                              "Scrollable field table",
                              "Tabel kolom dapat digeser",
                              "可滚动字段表",
                            )}
                          >
                            <table className="crm-doc-table">
                              <caption className="sr-only">
                                {rows[0].object}
                              </caption>
                              <thead>
                                <tr>
                                  {[
                                    t(
                                      "Field and meaning",
                                      "Kolom dan makna",
                                      "字段与含义",
                                    ),
                                    t(
                                      "Type / values",
                                      "Tipe / nilai",
                                      "类型／取值",
                                    ),
                                    t("Optional", "Opsional", "可选"),
                                    t(
                                      "Declaration source",
                                      "Sumber deklarasi",
                                      "声明来源",
                                    ),
                                  ].map((v) => (
                                    <th scope="col" key={v}>
                                      {v}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {rows.map((r) => (
                                  <tr key={r.key}>
                                    <th scope="row">
                                      <code>{r.key}</code>
                                      <p>{dictionaryMeaning(r)[col]}</p>
                                    </th>
                                    <td>
                                      <code>{r.type}</code>
                                    </td>
                                    <td>
                                      {r.optional
                                        ? t("Yes", "Ya", "是")
                                        : t("No", "Tidak", "否")}
                                    </td>
                                    <td>{r.source}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </details>
                      ))}
                    </div>
                  )}
                </details>
                <div className="crm-doc-links">
                  <a href={link(s.related)} onClick={() => choose(s.related)}>
                    {t(
                      "Related operating instructions",
                      "Petunjuk operasi terkait",
                      "相关操作说明",
                    )}
                  </a>
                </div>
              </section>
            ))}
          {(terms || part === "operations") &&
            operations.map((s) => (
              <section
                id={"crm-guide-" + s.key}
                tabIndex={-1}
                key={s.key}
                className="crm-doc-card crm-doc-section"
              >
                <h3>{s.title[col]}</h3>
                <div className="crm-doc-instructions">
                  {s.body.map((row, i) => (
                    <div key={i}>
                      <span aria-hidden="true">{i + 1}</span>
                      <p>{row[col]}</p>
                    </div>
                  ))}
                </div>
                <a
                  href={link(concepts[s.key] || "architecture")}
                  onClick={() => choose(concepts[s.key] || "architecture")}
                >
                  {t(
                    "Related system concepts",
                    "Konsep sistem terkait",
                    "相关系统概念",
                  )}
                </a>
              </section>
            ))}
        </div>
      </div>
    </article>
  );
}

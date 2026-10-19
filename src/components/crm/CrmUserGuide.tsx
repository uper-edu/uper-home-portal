import {
  panoramaRoles,
  panoramaModules,
  panoramaData,
  panoramaStates,
  panoramaCases,
} from "./CrmPanoramaContent";
import { guideLessons } from "./CrmGuideLearning";
import { LessonOpening } from "./CrmGuideLearningVisual";
import React, { useEffect, useRef, useState } from "react";
import { guideSections, type GuideLanguage } from "./CrmGuideContent";
import { systemChapters } from "./CrmSystemGuide";
import { CrmGuideDiagram, diagramSearchText } from "./CrmGuideDiagrams";
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
  [
    "workspace",
    "efficient-followup",
    "filters",
    "visual-status",
    "buying-evidence-sources",
  ],
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
export const crmDocumentationFields = dictionary.filter(
  (row) =>
    !["cms_collections", "cms_media", "site_submissions"].includes(row.object),
);
export function resolveGuideAnchor(hash: string) {
  const value = hash.replace(/^#/, ""),
    old = value.match(/^chapter-(\d+)$/);
  let key = old
    ? oldChapterKeys[Number(old[1]) - 1]
    : value.replace(/^crm-guide-/, "");
  if (key === "fields") key = "data-implementation";
  if (systemChapters.some((s) => s.key === key)) return { part: "system", key };
  if (guideSections.some((s) => s.key === key))
    return { part: "operations", key };
  return null;
}
function localizedText(value: unknown, col: number): string {
  if (Array.isArray(value)) {
    if (value.length === 3 && value.every((v) => typeof v === "string"))
      return value[col];
    return value.map((v) => localizedText(v, col)).join(" ");
  }
  if (value && typeof value === "object")
    return Object.values(value)
      .map((v) => localizedText(v, col))
      .join(" ");
  return String(value ?? "");
}
export function CrmUserGuide({
  isLight,
  lang,
  onNavigateTab,
  initialChapter,
}: {
  isLight: boolean;
  lang: GuideLanguage;
  initialChapter?: string;
  onNavigateTab?: (tab: "leads" | "campaigns" | "policy" | "docs") => void;
}) {
  const col = lang === "zh" ? 2 : lang === "id" ? 1 : 0,
    t = (en: string, id: string, zh: string) => [en, id, zh][col];
  const initialHash = initialChapter
    ? "#crm-guide-" + initialChapter
    : typeof window === "undefined"
      ? ""
      : window.location.hash;
  const [selectedKey, setSelectedKey] = useState(() => {
    const direct = resolveGuideAnchor(initialHash);
    if (direct) return direct.key;
    try {
      const saved = resolveGuideAnchor(
        window.localStorage.getItem("uper_crm_docs_chapter") || "",
      );
      if (saved) return saved.key;
    } catch {}
    return "panorama";
  });
  const part = resolveGuideAnchor(selectedKey)!.part;
  const [query, setQuery] = useState(""),
    [searchMode, setSearchMode] = useState(false),
    [invalid, setInvalid] = useState(
      () =>
        !!initialHash &&
        initialHash !== "#crm-main" &&
        !resolveGuideAnchor(initialHash),
    );
  const [expanded, setExpanded] = useState({
      system: part === "system",
      operations: part === "operations",
    }),
    [isNarrow, setIsNarrow] = useState(false),
    [navOpen, setNavOpen] = useState(false),
    [focusRequest, setFocusRequest] = useState(
      !initialChapter && resolveGuideAnchor(initialHash) ? 1 : 0,
    );
  const directoryButton = useRef<HTMLButtonElement>(null);
  const guide = useRef<HTMLElement>(null);
  const layout = useRef<HTMLDivElement>(null);
  const directory = useRef<HTMLElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const lastFocusRequest = useRef(0);
  useEffect(() => {
    const header = document.querySelector(
      "[data-admin-header], [data-crm-header]",
    );
    const measure = () => {
      guide.current?.style.setProperty(
        "--doc-header-height",
        `${Math.ceil(header?.getBoundingClientRect().height || 0)}px`,
      );
      guide.current?.style.setProperty(
        "--doc-toggle-height",
        `${Math.ceil(directoryButton.current?.getBoundingClientRect().height || 0)}px`,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (header) observer.observe(header);
    if (directoryButton.current) observer.observe(directoryButton.current);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 900px)"),
      change = () => {
        setIsNarrow(media.matches);
        setNavOpen(false);
      };
    change();
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  useEffect(() => {
    const locate = () => {
      if (!location.hash || location.hash === "#crm-main") {
        setInvalid(false);
        return;
      }
      const next = resolveGuideAnchor(location.hash);
      setInvalid(!next);
      if (next) {
        setSelectedKey(next.key);
        setQuery("");
        setSearchMode(false);
        setExpanded((v) => ({ ...v, [next.part]: true }));
        setFocusRequest((v) => v + 1);
        setNavOpen(false);
      }
    };
    window.addEventListener("hashchange", locate);
    window.addEventListener("popstate", locate);
    return () => {
      window.removeEventListener("hashchange", locate);
      window.removeEventListener("popstate", locate);
    };
  }, []);
  useEffect(() => {
    if (!focusRequest || lastFocusRequest.current === focusRequest) return;
    const request = requestAnimationFrame(() => {
      lastFocusRequest.current = focusRequest;
      const pane = content.current;
      const node = document.getElementById("crm-guide-" + selectedKey);
      if (!pane || !layout.current) return;
      const narrow = window.matchMedia("(max-width: 900px)").matches;
      if (narrow) {
        // The closed directory toggle remains above the chapter on small screens.
        pane.scrollIntoView({ block: "start", behavior: "instant" });
      } else {
        const header = document.querySelector(
          "[data-admin-header], [data-crm-header]",
        );
        const offset = (header?.getBoundingClientRect().bottom || 0) + 12;
        const delta = layout.current.getBoundingClientRect().top - offset;
        if (Math.abs(delta) > 2)
          window.scrollBy({ top: delta, behavior: "instant" });
        pane.scrollTop = 0;
      }
      // Direct subsection links still locate the requested subsection, within the pane.
      if (
        !searchMode &&
        node &&
        node !== pane.querySelector(".crm-doc-section")
      ) {
        if (narrow)
          node.scrollIntoView({ block: "start", behavior: "instant" });
        else
          pane.scrollTop =
            node.getBoundingClientRect().top - pane.getBoundingClientRect().top;
      }
      (searchMode ? pane : node)?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(request);
  }, [selectedKey, focusRequest, searchMode]);
  useEffect(() => {
    if (query.trim()) {
      if (content.current) content.current.scrollTop = 0;
      return;
    }
    const nav = directory.current;
    if (!nav) return;
    const revealSelection = () => {
      const selected = nav.querySelector<HTMLElement>('[aria-current="page"]');
      if (!selected || nav.hidden || !selected.getClientRects().length) return;
      const bounds = nav.getBoundingClientRect(),
        item = selected.getBoundingClientRect();
      // Move only the directory, and only as far as needed to reveal the selection.
      if (item.top < bounds.top + 8) nav.scrollTop += item.top - bounds.top - 8;
      else if (item.bottom > bounds.bottom - 8)
        nav.scrollTop += item.bottom - bounds.bottom + 8;
    };
    const frame = requestAnimationFrame(revealSelection);
    const observer = new ResizeObserver(revealSelection);
    observer.observe(nav);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [selectedKey, expanded, lang, query, isNarrow, navOpen]);
  useEffect(() => {
    if (!navOpen || !isNarrow) return;
    const frame = requestAnimationFrame(() =>
      layout.current?.scrollIntoView({ block: "start", behavior: "instant" }),
    );
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setNavOpen(false);
        directoryButton.current?.focus({ preventScroll: true });
      }
    };
    window.addEventListener("keydown", close);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", close);
    };
  }, [navOpen, isNarrow]);
  const terms = query.trim().toLocaleLowerCase(),
    includes = (value: unknown) =>
      JSON.stringify(value).toLocaleLowerCase().includes(terms);
  const fieldMatches = crmDocumentationFields.filter((r) =>
    includes([
      r.key,
      r.object,
      r.type,
      dictionaryMeaning(r)[col],
      dictionaryWriter(r)[col],
    ]),
  );
  const matchesSystem = systemChapters.filter(
    (s) =>
      includes([
        s.title[col],
        localizedText(guideLessons[s.key], col),
        s.key === "panorama"
          ? localizedText(
              [panoramaModules, panoramaRoles, panoramaData, panoramaStates, panoramaCases],
              col,
            )
          : "",
        s.intro[col],
        s.technical[col],
        s.blocks.map((b) => [
          b.title[col],
          b.items.map((i) => i[col]),
          b.diagram ? localizedText(diagramSearchText[b.diagram], col) : "",
        ]),
      ]) ||
      (s.key === "data-implementation" && fieldMatches.length > 0),
  );
  const matchesOperations = guideSections.filter((s) =>
    includes([
      s.title[col],
      localizedText(guideLessons[s.key], col),
      s.body.map((row) => row[col]),
    ]),
  );
  const resultKeys = new Set(
    [...matchesSystem, ...matchesOperations].map((s) => s.key),
  );
  const navSystem = systemChapters.filter(
    (s) => !terms || resultKeys.has(s.key),
  );
  const navOperations = operationGroups
    .map((group) => {
      const match = group.find((key) => resultKeys.has(key));
      return {
        key: terms ? match || group[0] : group[0],
        group,
        title:
          guideSections.find((s) => s.key === (terms ? match : group[0]))
            ?.title || guideSections.find((s) => s.key === group[0])!.title,
      };
    })
    .filter((item) => !terms || item.group.some((key) => resultKeys.has(key)));
  const system = systemChapters.filter((s) => s.key === selectedKey);
  const selectedGroup =
    operationGroups.find((group) => group.includes(selectedKey)) || [];
  const operations = guideSections
    .filter((s) => s.key === selectedKey)
    .sort(
      (a, b) => selectedGroup.indexOf(a.key) - selectedGroup.indexOf(b.key),
    );
  const fieldsByObject: Record<string, typeof dictionary> = {};
  for (const row of fieldMatches)
    (fieldsByObject[`${row.layer}:${row.object}`] ??= []).push(row);
  const link = (key: string) => "#crm-guide-" + key;
  const choose = (key: string) => {
    const next = resolveGuideAnchor(key);
    if (!next) return;
    setSelectedKey(next.key);
    setQuery("");
    setInvalid(false);
    setSearchMode(false);
    setExpanded((v) => ({ ...v, [next.part]: true }));
    setNavOpen(false);
    setFocusRequest((v) => v + 1);
    try {
      window.localStorage.setItem("uper_crm_docs_chapter", next.key);
    } catch {}
    window.history.pushState(window.history.state, "", link(next.key));
  };
  const fullNavigation = [
      ...systemChapters.map((s) => s.key),
      ...operationGroups.flat(),
    ],
    position = fullNavigation.indexOf(selectedKey);
  const chapterTitle = (
    guideLessons[selectedKey] ||
    [...systemChapters, ...guideSections].find((s) => s.key === selectedKey)!
  ).title[col];
  const navResults = [
    ...matchesSystem.map((s) => ({ ...s, part: "system" })),
    ...matchesOperations.map((s) => ({ ...s, part: "operations" })),
  ];
  return (
    <article
      ref={guide}
      className="crm-docs"
      data-theme={isLight ? "light" : "dark"}
    >
      <header className="crm-doc-card crm-doc-intro">
        <h2>{t("CRM documentation", "Dokumentasi CRM", "CRM 系统文档")}</h2>
        <p>
          {t(
            "Customer acquisition, sales follow-up and operations. Concepts explain why; instructions explain how.",
            "Akuisisi pelanggan, tindak lanjut penjualan, dan operasional. Konsep menjelaskan alasan; panduan menjelaskan cara.",
            "聚焦客户获客、销售跟进与运营。系统说明解释逻辑，操作指南说明做法。",
          )}
        </p>
        {onNavigateTab && (
          <div className="crm-doc-links">
            <button onClick={() => onNavigateTab("leads")}>
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
        )}
      </header>
      {invalid && (
        <p role="status">
          {t(
            "Chapter link not found. Choose a chapter from the directory.",
            "Tautan bab tidak ditemukan. Pilih bab dari daftar isi.",
            "章节链接不存在，请从目录选择章节。",
          )}
        </p>
      )}
      <button
        className="crm-doc-mobile-toggle"
        ref={directoryButton}
        aria-expanded={navOpen}
        aria-controls="crm-doc-chapter-nav"
        onClick={() => setNavOpen((v) => !v)}
      >
        {t("Chapters and search", "Bab dan pencarian", "章节目录与搜索")}{" "}
        {navOpen ? "−" : "+"}
      </button>
      <div ref={layout} className="crm-doc-layout">
        <nav
          ref={directory}
          id="crm-doc-chapter-nav"
          className="crm-doc-card crm-doc-nav"
          hidden={isNarrow && !navOpen}
          aria-label={t("Guide chapters", "Bab panduan", "文档章节")}
        >
          <label className="crm-doc-search-label">
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
                setSearchMode(!!e.target.value.trim());
              }}
            />
          </label>
          {terms && (
            <button
              className="crm-doc-clear"
              onClick={() => {
                setQuery("");
                setSearchMode(false);
              }}
            >
              {t("Clear search", "Hapus pencarian", "清除搜索")}
            </button>
          )}
          {terms && isNarrow && (
            <button
              className="crm-doc-clear"
              onClick={() => {
                setNavOpen(false);
                setFocusRequest((v) => v + 1);
              }}
            >
              {t(
                "View search results",
                "Lihat hasil pencarian",
                "查看搜索结果",
              )}
            </button>
          )}
          {(["system", "operations"] as const).map((root) => (
            <section key={root} className="crm-doc-nav-group">
              <button
                type="button"
                aria-expanded={!!terms || expanded[root]}
                aria-controls={"crm-doc-nav-" + root}
                onClick={() => setExpanded((v) => ({ ...v, [root]: !v[root] }))}
              >
                <span aria-hidden="true">
                  {terms || expanded[root] ? "▾" : "▸"}
                </span>
                {root === "system"
                  ? t("System explanation", "Penjelasan sistem", "系统说明")
                  : t("Operating guide", "Panduan operasi", "操作指南")}
              </button>
              <ol id={"crm-doc-nav-" + root} hidden={!terms && !expanded[root]}>
                {(root === "system"
                  ? navSystem.map((s) => ({ ...s, group: [s.key] }))
                  : navOperations
                ).map((s, index) => (
                  <li key={s.key}>
                    <a
                      href={link(s.key)}
                      aria-label={s.title[col]}
                      aria-current={s.key === selectedKey ? "page" : undefined}
                      onClick={(e) => {
                        e.preventDefault();
                        choose(s.key);
                      }}
                    >
                      <span className="crm-doc-nav-number" aria-hidden="true">
                        {index + 1}.
                      </span>
                      {s.title[col]}
                    </a>
                    {root === "operations" &&
                      !terms &&
                      s.group.length > 1 &&
                      s.group.includes(selectedKey) && (
                        <ul className="crm-doc-subchapters">
                          {s.group.slice(1).map((key) => (
                            <li key={key}>
                              <a
                                href={link(key)}
                                aria-current={
                                  key === selectedKey ? "page" : undefined
                                }
                                onClick={(e) => {
                                  e.preventDefault();
                                  choose(key);
                                }}
                              >
                                {
                                  guideSections.find((row) => row.key === key)!
                                    .title[col]
                                }
                              </a>
                            </li>
                          ))}
                        </ul>
                      )}
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </nav>
        <div
          ref={content}
          className="crm-doc-content min-w-0"
          role="region"
          tabIndex={0}
          aria-label={t("Chapter content", "Isi bab", "章节正文")}
        >
          {searchMode ? (
            <section className="crm-doc-card">
              <h3>
                {t("Search results", "Hasil pencarian", "搜索结果")} ·{" "}
                {navResults.length}
              </h3>
              {navResults.length === 0 && (
                <p role="status">
                  {t(
                    "No matching chapters",
                    "Tidak ada bab yang cocok",
                    "没有匹配的章节",
                  )}
                </p>
              )}
              <ul className="crm-doc-search-results">
                {navResults.map((s) => (
                  <li key={s.key}>
                    <small>
                      {s.part === "system"
                        ? t(
                            "System explanation",
                            "Penjelasan sistem",
                            "系统说明",
                          )
                        : t("Operating guide", "Panduan operasi", "操作指南")}
                    </small>
                    <a
                      href={link(s.key)}
                      onClick={(e) => {
                        e.preventDefault();
                        choose(s.key);
                      }}
                    >
                      {s.title[col]}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            <>
              <p className="crm-doc-breadcrumb">
                {part === "system"
                  ? t("System explanation", "Penjelasan sistem", "系统说明")
                  : t("Operating guide", "Panduan operasi", "操作指南")}{" "}
                <span aria-hidden="true">›</span> {chapterTitle}
              </p>
              {part === "system" &&
                system.map((s) => (
                  <section
                    className="crm-doc-card crm-doc-section"
                    tabIndex={-1}
                    id={"crm-guide-" + s.key}
                    key={s.key}
                  >
                    <h3>{(guideLessons[s.key]?.title || s.title)[col]}</h3>
                    <LessonOpening chapterKey={s.key} col={col} />
                    {s.blocks
                      .filter((b) => b.kind === "diagram")
                      .map((b, i) => (
                        <CrmGuideDiagram key={i} kind={b.diagram!} col={col} />
                      ))}
                    <details className="crm-doc-reference">
                      <summary>
                        {t(
                          "Detailed rules and examples",
                          "Aturan rinci dan contoh",
                          "规则细节与例外查阅",
                        )}
                      </summary>
                      {s.blocks
                        .filter((b) => b.kind !== "diagram")
                        .map((b, i) => (
                          <div key={i}>
                            {b.kind !== "diagram" && <h4>{b.title[col]}</h4>}
                            {b.kind === "diagram" ? (
                              <CrmGuideDiagram kind={b.diagram!} col={col} />
                            ) : b.kind === "flow" ? (
                              <ol
                                className="crm-doc-flow"
                                aria-label={b.title[col]}
                              >
                                {b.items.map((item, j) => (
                                  <li key={j}>
                                    <b>{j + 1}</b>
                                    {item[col]}
                                    {j < b.items.length - 1 && (
                                      <svg
                                        aria-hidden="true"
                                        viewBox="0 0 28 18"
                                      >
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
                                <caption className="sr-only">
                                  {b.title[col]}
                                </caption>
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
                    </details>
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
                              "CRM contracts and storage fields",
                              "Kontrak dan kolom penyimpanan CRM",
                              "CRM 契约与存储字段",
                            )}{" "}
                            · {fieldMatches.length}/
                            {crmDocumentationFields.length}
                          </h4>
                          <p>
                            {t(
                              "Use the chapter-directory search to locate fields. Expand an object to read its fields. Types and internal values remain code identifiers; optional means omission/null in the declaration, not permission to skip a required business step. Nested JSON properties use dotted paths. Descriptions are guidance; the source declaration defines the contract.",
                              "Gunakan pencarian daftar isi untuk menemukan kolom. Buka objek untuk membaca kolomnya. Tipe dan nilai internal tetap berupa kode; opsional berarti kosong/null dalam deklarasi, bukan izin melewati langkah wajib. Properti JSON bertingkat memakai jalur bertitik. Deskripsi adalah panduan; deklarasi sumber menentukan kontrak.",
                              "通过目录搜索定位字段，展开对象查看字段。类型及内部取值保留代码标识；可选表示声明允许缺省／空值，不表示可跳过必需业务步骤。嵌套 JSON 使用点路径。说明供理解，具体契约以源码声明为准。",
                            )}
                          </p>
                          {Object.entries(fieldsByObject).map(
                            ([object, rows]) => (
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
                            ),
                          )}
                        </div>
                      )}
                    </details>
                    <div className="crm-doc-links">
                      <a
                        href={link(s.related)}
                        onClick={(e) => {
                          e.preventDefault();
                          choose(s.related);
                        }}
                      >
                        {t(
                          "Related operating instructions",
                          "Petunjuk operasi terkait",
                          "相关操作说明",
                        )}
                      </a>
                    </div>
                  </section>
                ))}
              {part === "operations" &&
                operations.map((s) => (
                  <section
                    id={"crm-guide-" + s.key}
                    tabIndex={-1}
                    key={s.key}
                    className="crm-doc-card crm-doc-section"
                  >
                    <h3>{(guideLessons[s.key]?.title || s.title)[col]}</h3>
                    <LessonOpening chapterKey={s.key} col={col} />
                    <details className="crm-doc-reference">
                      <summary>
                        {t(
                          "Details and exceptions",
                          "Rincian dan pengecualian",
                          "操作细节与例外查阅",
                        )}
                      </summary>
                      <div className="crm-doc-instructions">
                        {s.body.map((row, i) => (
                          <div key={i}>
                            <span aria-hidden="true">{i + 1}</span>
                            <p>{row[col]}</p>
                          </div>
                        ))}
                      </div>
                    </details>
                    <a
                      href={link(concepts[s.key] || "architecture")}
                      onClick={(e) => {
                        e.preventDefault();
                        choose(concepts[s.key] || "architecture");
                      }}
                    >
                      {t(
                        "Related system concepts",
                        "Konsep sistem terkait",
                        "相关系统概念",
                      )}
                    </a>
                  </section>
                ))}

              <div className="crm-doc-page-controls">
                <button
                  disabled={position <= 0}
                  onClick={() => {
                    setQuery("");
                    choose(fullNavigation[position - 1]);
                  }}
                >
                  {t("Previous chapter", "Bab sebelumnya", "上一章")}
                </button>
                <small>
                  {t(
                    "Print / PDF exports the current chapter.",
                    "Cetak / PDF mengekspor bab saat ini.",
                    "打印／PDF 导出当前章节。",
                  )}
                </small>
                <button
                  disabled={position >= fullNavigation.length - 1}
                  onClick={() => {
                    setQuery("");
                    choose(fullNavigation[position + 1]);
                  }}
                >
                  {t("Next chapter", "Bab berikutnya", "下一章")}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

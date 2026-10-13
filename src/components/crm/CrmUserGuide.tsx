import React, { useState } from "react";
import { guideSections, type GuideLanguage } from "./CrmGuideContent";
import { customerFields } from "../../utils/crmWorkspace";
const fieldId = [
  "Nomor prospek",
  "Nama",
  "Pemilik",
  "Tanggal pendaftaran",
  "Identitas pelanggan",
  "WhatsApp",
  "Email",
  "Kota",
  "Format belajar",
  "Tujuan belajar",
  "Hasil asesmen",
  "Kelompok pelanggan",
  "Tahap penjualan",
  "Sinyal pembelian",
  "Hasil kontak",
  "Jumlah kontak",
  "Kontak terakhir",
  "Tindak lanjut",
  "Sumber pertama",
  "Kampanye",
  "Hasil bisnis",
];
interface Props {
  isLight: boolean;
  lang: GuideLanguage;
  onNavigateTab?: (tab: "leads" | "campaigns" | "policy" | "docs") => void;
}
export function CrmUserGuide({ isLight, lang, onNavigateTab }: Props) {
  const [query, setQuery] = useState("");
  const column = lang === "zh" ? 2 : lang === "id" ? 1 : 0;
  const t = (en: string, id: string, zh: string) => [en, id, zh][column];
  const sections = guideSections.filter((section) =>
    (
      section.title[column] +
      " " +
      section.body.map((row) => row[column]).join(" ")
    )
      .toLocaleLowerCase()
      .includes(query.toLocaleLowerCase().trim()),
  );
  const surface = isLight
    ? "bg-white border-slate-200 text-slate-800"
    : "bg-slate-900 border-slate-700 text-slate-100";
  return (
    <div className="space-y-5 pb-12">
      <header className={`rounded-2xl border p-5 ${surface}`}>
        <h2 className="text-xl font-bold">
          {t("CRM operating guide", "Panduan operasional CRM", "CRM 操作指南")}
        </h2>
        <p className="text-sm mt-2">
          {t(
            "Current workflows, permissions, task deadlines and notification behavior. Updated 13 October 2026.",
            "Alur kerja, izin akses, tenggat tugas, dan perilaku notifikasi saat ini. Diperbarui 13 Oktober 2026.",
            "现行工作流程、权限、任务截止时间及通知行为。更新于 2026 年 10 月 13 日。",
          )}
        </p>
        <label className="block mt-4 text-sm">
          {t("Search the guide", "Cari dalam panduan", "搜索手册")}
          <input
            type="search"
            className="block w-full rounded-lg border bg-transparent p-2 mt-1"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div className="flex gap-3 mt-3 print:hidden">
          <button
            type="button"
            className="text-primary-600 underline"
            onClick={() => onNavigateTab?.("leads")}
          >
            {t(
              "Open customer worklist",
              "Buka daftar kerja pelanggan",
              "打开客户工作列表",
            )}
          </button>
          <button
            type="button"
            className="text-primary-600 underline"
            onClick={() => onNavigateTab?.("campaigns")}
          >
            {t("Open campaigns", "Buka kampanye", "打开营销活动")}
          </button>
        </div>
      </header>
      <div className="grid lg:grid-cols-[230px_minmax(0,1fr)] gap-5">
        <nav
          aria-label={t("Guide chapters", "Bab panduan", "手册章节")}
          className={`rounded-2xl border p-4 h-fit ${surface}`}
        >
          <ol className="space-y-3">
            {sections.map((s, i) => (
              <li key={s.key}>
                <a
                  href={`#crm-guide-${s.key}`}
                  className="text-sm hover:underline"
                >
                  {guideSections.findIndex((x) => x.key === s.key) + 1}.{" "}
                  {s.title[column]}
                </a>
              </li>
            ))}
            <li>
              <a href="#crm-guide-fields" className="text-sm hover:underline">
                {t(
                  "Visible fields reference",
                  "Referensi bidang tampilan",
                  "显示字段参考",
                )}
              </a>
            </li>
          </ol>
        </nav>
        <main className="space-y-5 min-w-0">
          {!sections.length && (
            <p role="status">
              {t(
                "No matching chapters",
                "Tidak ada bab yang cocok",
                "没有匹配的章节",
              )}
            </p>
          )}
          {sections.map((s) => (
            <section
              key={s.key}
              id={`crm-guide-${s.key}`}
              className={`rounded-2xl border p-5 scroll-mt-40 ${surface}`}
            >
              <h3 className="font-bold text-lg mb-3">
                {guideSections.findIndex((x) => x.key === s.key) + 1}.{" "}
                {s.title[column]}
              </h3>
              {s.body.map((row, i) => (
                <p key={i} className="text-sm leading-7 mb-3 last:mb-0">
                  {row[column]}
                </p>
              ))}
            </section>
          ))}
          <section
            id="crm-guide-fields"
            className={`rounded-2xl border p-5 scroll-mt-40 ${surface}`}
          >
            <h3 className="font-bold text-lg">
              {t(
                "Visible fields reference",
                "Referensi bidang tampilan",
                "显示字段参考",
              )}
            </h3>
            <p className="text-sm mt-2 mb-4">
              {t(
                "These are display fields, not a database schema. The same record supplies both views. Technical keys are shown for troubleshooting.",
                "Ini adalah bidang tampilan, bukan skema database. Catatan yang sama menyediakan kedua tampilan. Kunci teknis ditampilkan untuk pemecahan masalah.",
                "以下为显示字段，并非数据库全部字段；两种视图使用同一记录。技术标识用于排错。",
              )}
            </p>
            <dl className="grid sm:grid-cols-2 gap-3">
              {customerFields.map((field, i) => (
                <div key={field[0]} className="rounded-lg border p-3">
                  <dt className="font-semibold text-sm">
                    {lang === "id" ? fieldId[i] : field[lang === "zh" ? 2 : 1]}
                  </dt>
                  <dd className="text-xs opacity-70 mt-1 font-mono">
                    {field[0]}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        </main>
      </div>
    </div>
  );
}

import React from "react";
import content from "./marketingPlaybook.json";
import type { GuideLanguage } from "./CrmGuideContent";

export const marketingPlaybookTitle = [
  "Marketing acquisition & CRM feedback",
  "Akuisisi pemasaran & umpan balik CRM",
  "营销获客与CRM转化反馈体系",
];
const sectionTitles = [
  ["Executive summary", "Ringkasan eksekutif"],
  ["Architecture and data flow", "Arsitektur dan alur data"],
  ["Concepts and UPER examples", "Konsep dan contoh UPER"],
  ["Ad placements and consultation channels", "Penempatan iklan dan kanal konsultasi"],
  ["Lead qualification and feedback boundaries", "Kualifikasi Lead dan batas umpan balik"],
  ["Customers, opportunities, states and events", "Pelanggan, peluang, status, dan peristiwa"],
  ["Meta events and CRM mapping", "Peristiwa Meta dan pemetaan CRM"],
  ["Three interfaces and five checks", "Tiga antarmuka dan lima pemeriksaan"],
  ["Example: from ad to payment", "Contoh: dari iklan hingga pembayaran"],
  ["Review of 245 conversations and 46 uploaded rows", "Tinjauan 245 percakapan dan 46 baris unggahan"],
  ["Measurement and experiments", "Pengukuran dan eksperimen"],
  ["Roadmap, responsibilities and open questions", "Rencana, tanggung jawab, dan pertanyaan terbuka"],
  ["Appendix, revisions and sources", "Lampiran, revisi, dan sumber"],
];
export const marketingPlaybookSections = content.sections.map((section, index) => ({
  ...section,
  title: [...sectionTitles[index], section.title],
  searchText: (index === 0 ? content.preamble : "") + section.html,
}));
const referenceKeys = new Set(
  content.sections.flatMap(section => [...section.html.matchAll(/id="crm-guide-(marketing-playbook-ref-[SW]\d+)"/g)].map(match => match[1])),
);
export const isMarketingPlaybookAnchor = (key: string) =>
  key === "marketing-playbook" || marketingPlaybookSections.some(section => section.key === key) || referenceKeys.has(key);
export const marketingPlaybookNavKey = (key: string) => referenceKeys.has(key)
  ? marketingPlaybookSections[marketingPlaybookSections.length - 1].key : key;

export function CrmMarketingPlaybook({ lang, onChoose }: {
  lang: GuideLanguage;
  onChoose: (key: string) => void;
}) {
  return (
    <section className="crm-doc-card crm-doc-section" id="crm-guide-marketing-playbook" tabIndex={-1}>
      <h3>{content.title}</h3>
      <div className="crm-doc-playbook-overview" lang="zh-CN">
        <p className="crm-doc-playbook-subtitle">从概念澄清、数据流转，到现状诊断与行动路线</p>
        <p className="crm-doc-playbook-meta">v2.0 · 2026-10-30 · 管理／运营／销售／工程 · 事实／建议／待验证分开</p>
        <dl className="crm-doc-playbook-stats">
          <div><dt>Campaign</dt><dd><strong>3</strong><p>报告涉及的广告活动</p></dd></div>
          <div><dt>Conversations</dt><dd><strong>245</strong><p>确切指标口径仍需核实</p></dd></div>
          <div><dt>CSV行接收成功</dt><dd><strong>46</strong><p>不等于匹配、归因或优化成功</p></dd></div>
        </dl>
        <p className="crm-doc-playbook-stat-note">以上为广告团队阶段报告陈述，非后台独立审计。详见第10节证据台账。</p>
      </div>
      {lang !== "zh" && <p className="crm-doc-source-language">
        {lang === "en"
          ? "Source document in Chinese · Integrated review edition. The text describes facts, proposals and items pending verification; it does not confirm implementation."
          : "Dokumen sumber berbahasa Mandarin · Edisi tinjauan terpadu. Teks membedakan fakta, usulan, dan hal yang perlu diverifikasi; bukan konfirmasi implementasi."}
      </p>}
      <div className="crm-doc-playbook" lang="zh-CN" onClick={event => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        const target = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href^="#crm-guide-marketing-playbook"]') : null;
        if (!target) return;
        const key = target.hash.replace(/^#crm-guide-/, "");
        if (isMarketingPlaybookAnchor(key)) {
          event.preventDefault();
          onChoose(key);
        }
      }}>
        {/* Build-time reviewed, allowlisted HTML snapshot; never runtime/user HTML. */}
        <div dangerouslySetInnerHTML={{ __html: content.preamble
          .replace(/^\s*<p>[\s\S]*?<\/p>/, '')
          .replace('<br>\n<strong>主文件：Markdown；配套 HTML 为同一内容的离线图文阅读版。</strong>', '')
          .replace('；Markdown 阅读器不支持 Mermaid 时，可打开配套 HTML 阅读已渲染的流程图。', '。') }} />
        {marketingPlaybookSections.map((section, index) => <section
          key={section.key} id={"crm-guide-" + section.key} tabIndex={-1}
          className="crm-doc-section"
        >
          <h4><span className="crm-doc-playbook-number">{index + 1}.</span> {section.title[2]}</h4>
          <div dangerouslySetInnerHTML={{ __html: section.html.replace(/<hr>\s*$/, "") }} />
        </section>)}
      </div>
    </section>
  );
}

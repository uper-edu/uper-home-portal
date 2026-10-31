import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import content from "./whatsappGuide.json";
import type { GuideLanguage } from "./CrmGuideContent";
import type { SystemChapter } from "./CrmSystemGuide";

export const whatsAppChapter: SystemChapter = {
  key: "whatsapp-hybrid",
  title: [
    "WhatsApp integration, ads and Hybrid",
    "Integrasi WhatsApp, iklan, dan Hybrid",
    "WhatsApp接入、广告获客与Hybrid方案",
  ],
  intro: [
    "Proposed receive-only Hybrid model: account options, Lead identity, advertising, costs and acceptance gates. Not yet integrated.",
    "Usulan Hybrid penerimaan saja: akun, identitas Lead, iklan, biaya, dan syarat penerimaan. Belum terintegrasi.",
    "规划中的Hybrid只接收归档方案：账号与模式比较、Lead关联、广告获客、收费参考及接入验收；尚未实现。",
  ],
  // Keep the entire document discoverable through the existing chapter search.
  blocks: [
    {
      kind: "example",
      title: ["Reference", "Referensi", "方案参考"],
      items: [[content.en, content.id, content.zh]],
    },
  ],
  technical: [
    "Planning only. No account registration, API sending or business-rule change.",
    "Hanya perencanaan. Tanpa registrasi akun, kirim API, atau perubahan aturan bisnis.",
    "仅方案文档，不代表账号已开通或消息已接入，不授权API发送和业务规则变更。",
  ],
  sources: [
    "docs/crm/whatsapp-hybrid.md",
    "src/components/crm/whatsappGuide.json",
  ],
  related: "chat",
};

const sectionKeys = [
  "whatsapp-hybrid",
  "whatsapp-accounts",
  "whatsapp-modes",
  "whatsapp-acquisition",
  "whatsapp-pricing",
  "whatsapp-providers",
  "whatsapp-windows",
  "whatsapp-implementation",
  "whatsapp-acceptance",
  "whatsapp-sources",
];
export const whatsAppSections = sectionKeys.map((key, index) => {
  const values = (["en", "id", "zh"] as const).map((lang) => {
    const [opening, ...sections] = content[lang].split(/^## /m);
    const section = sections[index];
    if (!section || sections.length !== sectionKeys.length)
      throw new Error(`WhatsApp section mismatch: ${lang}`);
    const newline = section.indexOf("\n");
    return {
      title: section.slice(0, newline),
      body: (index === 0 ? opening : "") + section.slice(newline + 1).trim(),
    };
  });
  const body = { en: values[0].body, id: values[1].body, zh: values[2].body };
  const chapter: SystemChapter = {
    ...whatsAppChapter,
    key,
    title: values.map(
      (value) => value.title,
    ) as unknown as SystemChapter["title"],
    blocks: [
      {
        kind: "example",
        title: ["Reference", "Referensi", "方案参考"],
        items: [[body.en, body.id, body.zh]],
      },
    ],
  };
  return { ...chapter, body };
});
export const isWhatsAppChapter = (key: string) =>
  whatsAppSections.some((section) => section.key === key);

export function CrmWhatsAppGuide({ lang }: { lang: GuideLanguage }) {
  const col = lang === "zh" ? 2 : lang === "id" ? 1 : 0;
  return (
    <div className="crm-doc-whatsapp">
      {whatsAppSections.map((section, index) => (
        <section
          key={section.key}
          id={"crm-guide-" + section.key}
          tabIndex={-1}
          className="crm-doc-section"
        >
          <h4><span className="crm-doc-playbook-number">{index + 1}.</span> {section.title[col]}</h4>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              p: ({ children }) => <p className="my-3">{children}</p>,
              ul: ({ children }) => (
                <ul className="my-3 list-disc pl-5">{children}</ul>
              ),
              ol: ({ children }) => (
                <ol className="my-3 list-decimal pl-5">{children}</ol>
              ),
              h2: ({ children }) => <h4>{children}</h4>,
              h3: ({ children }) => <h5>{children}</h5>,
              table: ({ children }) => (
                <div className="crm-doc-table-scroll my-3">
                  <table className="crm-doc-table">{children}</table>
                </div>
              ),
              th: ({ children }) => <th scope="col">{children}</th>,
              a: ({ href, children }) => (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2"
                >
                  {children}
                </a>
              ),
            }}
          >
            {section.body[lang]}
          </ReactMarkdown>
          {index === 0 && (
            <figure className="my-6">
              <a
                href="/docs-assets/whatsapp-hybrid-v1.png"
                target="_blank"
                rel="noopener noreferrer"
                aria-label={
                  lang === "zh"
                    ? "查看Hybrid系统方案信息图原图"
                    : lang === "id"
                      ? "Buka infografik Hybrid ukuran penuh"
                      : "Open the full-size Hybrid infographic"
                }
              >
                <img
                  src="/docs-assets/whatsapp-hybrid-v1.png"
                  width={1536}
                  height={1024}
                  className="h-auto w-full rounded-xl"
                  alt={
                    lang === "zh"
                      ? "Hybrid系统方案：销售通过Business App接待，客户来信与App回显通过Meta共存Webhook归档到CRM；第一期API发送关闭。"
                      : lang === "id"
                        ? "Arsitektur Hybrid: sales membalas di Business App. Pesan masuk dan echo App diarsipkan ke CRM melalui webhook Coexistence Meta. Pengiriman API mati pada tahap pertama."
                        : "Hybrid architecture: sales reply in Business App; incoming messages and App echoes reach CRM through Meta Coexistence webhooks. API sending is off in phase one."
                  }
                />
              </a>
              <figcaption className="mt-2">
                <small>
                  {lang === "zh"
                    ? "建议架构，尚未接入。图中英文为技术短标签；单击可查看原图。账号资格、实际设备与消息覆盖范围、发送员工身份仍需验收。"
                    : lang === "id"
                      ? "Arsitektur usulan, belum terintegrasi. Label teknis berbahasa Inggris; klik untuk ukuran penuh. Verifikasi kelayakan akun, cakupan perangkat/pesan, dan identitas staf pengirim."
                      : "Proposed architecture, not integrated. Click for full size. Verify account eligibility, device/message coverage and employee sender identity."}
                </small>
              </figcaption>
            </figure>
          )}
        </section>
      ))}
    </div>
  );
}

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import content from "./analyticsGuide.json";
import environments from "../../data/analyticsEnvironments.json";
import type { GuideLanguage } from "./CrmGuideContent";

export const analyticsGuideTitle = content.title;
export function analyticsEnvironmentTable(col: number) {
  const headers = [
    [
      "Environment",
      "Property / ID",
      "Stream / ID",
      "Measurement ID",
      "Allowed hosts",
    ],
    [
      "Lingkungan",
      "Properti / ID",
      "Aliran / ID",
      "ID pengukuran",
      "Host yang diizinkan",
    ],
    ["环境", "属性／ID", "数据流／ID", "衡量ID", "允许主机"],
  ][col];
  const labels = [
    ["Local3000", "Staging", "Production"],
    ["Local3000", "Staging", "Produksi"],
    ["本地3000", "测试站", "生产站"],
  ][col];
  const rows = Object.values(environments.environments).map((env, i) => [
    labels[i],
    `${env.propertyName} · ${env.propertyId}`,
    `${env.streamName} · ${env.streamId}`,
    `\`${env.measurementId}\``,
    [
      ...env.allowedHosts,
      ...(env.allowLocalSubdomains ? ["*.localhost"] : []),
    ].join(", ") + (env.requireHttps ? " (HTTPS)" : ""),
  ]);
  return [headers, headers.map(() => "---"), ...rows]
    .map((row) => `| ${row.join(" | ")} |`)
    .join("\n");
}
export const analyticsGuideSections = content.sections.map((section) => ({
  ...section,
  body: section.body.map((body, col) =>
    body.replace("{{ENVIRONMENTS}}", analyticsEnvironmentTable(col)),
  ),
}));
export const isAnalyticsGuideAnchor = (key: string) =>
  analyticsGuideSections.some((section) => section.key === key);

/** Read-only documentation. Public IDs come from the same mapping used by the build guard. */
export function CrmAnalyticsGuide({ lang }: { lang: GuideLanguage }) {
  const col = lang === "zh" ? 2 : lang === "id" ? 1 : 0;
  return (
    <section
      id="crm-analytics-document"
      className="crm-doc-card crm-doc-section"
    >
      {analyticsGuideSections.map((section, index) => (
        <section
          key={section.key}
          id={"crm-guide-" + section.key}
          tabIndex={-1}
          className="crm-doc-section"
        >
          {index === 0 && <h3>{analyticsGuideTitle[col]}</h3>}
          <h4>
            <span className="crm-doc-playbook-number">5.{index + 1}</span>{" "}
            {section.title[col]}
          </h4>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              code: ({ children }) => (
                <code
                  className={
                    String(children).startsWith("G-")
                      ? "whitespace-nowrap"
                      : undefined
                  }
                >
                  {children}
                </code>
              ),
              p: ({ children }) => <p className="my-3">{children}</p>,
              ul: ({ children }) => (
                <ul className="my-3 list-disc pl-5">{children}</ul>
              ),
              ol: ({ children }) => (
                <ol className="my-3 list-decimal pl-5">{children}</ol>
              ),
              table: ({ children }) => (
                <div className="crm-doc-table-scroll my-3">
                  <table className="crm-doc-table">{children}</table>
                </div>
              ),
              th: ({ children }) => <th scope="col">{children}</th>,
              a: ({ href, children }) => (
                <a href={href} target="_blank" rel="noopener noreferrer">
                  {children}
                </a>
              ),
            }}
          >
            {section.body[col]}
          </ReactMarkdown>
        </section>
      ))}
    </section>
  );
}

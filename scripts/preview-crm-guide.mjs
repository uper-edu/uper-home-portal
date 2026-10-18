import fs from "node:fs/promises";
import path from "node:path";
import { build } from "esbuild";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CrmUserGuide } from "../src/components/crm/CrmUserGuide.tsx";
import { guideLessons } from "../src/components/crm/CrmGuideLearning.ts";

const root = process.cwd();
const out = process.argv[2] && path.resolve(process.argv[2]);
if (
  !out ||
  out === root ||
  out.startsWith(path.join(root, "dist")) ||
  out.startsWith(path.join(root, "data"))
) {
  throw new Error(
    "Provide an independent preview output directory, outside runtime data and dist.",
  );
}
await fs.mkdir(out, { recursive: true });
const entry = `import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {CrmUserGuide} from ${JSON.stringify(path.join(root, "src/components/crm/CrmUserGuide.tsx"))};
import ${JSON.stringify(path.join(root, "src/components/crm/crm-documentation.css"))};
function Preview(){const initial=new URLSearchParams(location.search).get('lang')||document.documentElement.lang;const [lang,setLang]=useState(['en','id','zh'].includes(initial)?initial:'zh');const [light,setLight]=useState(document.documentElement.dataset.theme!=='dark');const col={en:0,id:1,zh:2}[lang];const t=(a,b,c)=>[a,b,c][col];document.documentElement.lang=lang;document.documentElement.dataset.theme=light?'light':'dark';document.title=t('CRM visual guide · UPER','Panduan visual CRM · UPER','CRM 可视化在线文档 · UPER');return <><header className="guide-preview-header" data-admin-header><strong>UPER <span>{t('CRM learning centre','Pusat panduan CRM','CRM 学习中心')}</span></strong><div aria-label={t('Language and appearance','Bahasa dan tampilan','语言与外观')}>{[['en','EN'],['id','ID'],['zh','中文']].map(([id,label])=><button key={id} aria-pressed={lang===id} onClick={()=>{setLang(id);const url=new URL(location.href);url.searchParams.set('lang',id);history.replaceState(null,'',url)}}>{label}</button>)}<button aria-pressed={!light} onClick={()=>setLight(!light)}>{t(light?'Dark':'Light',light?'Gelap':'Terang',light?'深色':'浅色')}</button></div></header><p className="guide-preview-banner">{t('Independent documentation preview · Synthetic examples · No CRM writes or notifications','Pratinjau dokumentasi mandiri · Contoh simulasi · Tanpa penulisan CRM atau notifikasi','独立文档预览 · 全部为模拟实例 · 不写入 CRM、不发送通知')}</p><main className="guide-preview-main"><CrmUserGuide isLight={light} lang={lang} initialChapter={document.documentElement.dataset.chapter}/></main></>};if(!location.hash&&document.documentElement.dataset.chapter)history.replaceState(null,'','#crm-guide-'+document.documentElement.dataset.chapter);createRoot(document.getElementById('root')).render(<Preview/>);`;
await build({
  stdin: {
    contents: entry,
    resolveDir: root,
    sourcefile: "crm-guide-preview.tsx",
    loader: "tsx",
  },
  bundle: true,
  platform: "browser",
  format: "iife",
  target: "es2022",
  minify: true,
  define: { "process.env.NODE_ENV": '"production"' },
  outfile: path.join(out, "preview.js"),
  logLevel: "warning",
});
await fs.appendFile(
  path.join(out, "preview.css"),
  "\n.guide-preview-main{display:block}.guide-preview-main>.crm-docs,.js-motion .guide-preview-main>.crm-docs{opacity:1;transform:none}\n",
);
const html = `<!doctype html><html lang="zh" data-register="paper" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>CRM 可视化在线文档 · UPER</title><link rel="stylesheet" href="kit.css" data-ve-kit><link rel="stylesheet" href="preview.css"><style>
*{box-sizing:border-box}body{margin:0;background:#f5f8fa;color:#172b45;font-family:'Source Sans 3','Noto Sans SC',sans-serif;font-size:14px}button,input,textarea{font:inherit}button{cursor:pointer;border:0;background:none}a{color:inherit;text-decoration:none}h1,h2,h3,h4,h5,p,figure{margin:0}ul,ol{margin:0}button:focus-visible,a:focus-visible{outline:3px solid #007b74;outline-offset:3px}.sr-only{position:absolute;width:1px;height:1px;padding:0;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap}.guide-preview-header{position:sticky;top:0;z-index:30;background:#fff;border-bottom:1px solid #cbd5e1;display:flex;justify-content:space-between;align-items:center;padding:14px 24px;gap:14px}.guide-preview-header>strong{font-size:21px;display:flex;align-items:center;gap:16px;color:#007b74}.guide-preview-header>strong>span{font-size:14px;color:#435a75;border-left:1px solid #cbd5e1;padding-left:16px;font-weight:500}.guide-preview-header>div{display:flex;gap:3px}.guide-preview-header button{padding:9px 12px;border:1px solid transparent;border-radius:7px;min-height:40px}.guide-preview-header button[aria-pressed=true]{border-color:#007b74;color:#007b74;background:#e6f6f3}.guide-preview-banner{padding:9px 24px;color:#435a75;font-size:12px;border-bottom:1px solid #cbd5e1}.guide-preview-main{padding:20px;max-width:1600px;margin:auto}html[data-theme=dark] body{background:#101a29;color:#f1f5f9}html[data-theme=dark] .guide-preview-header{background:#0f172a}html[data-theme=dark] .guide-preview-header>strong{color:#5eead4}html[data-theme=dark] .guide-preview-header>strong>span,html[data-theme=dark] .guide-preview-banner{color:#cbd5e1}html[data-theme=dark] .guide-preview-header button{color:#f1f5f9}html[data-theme=dark] .guide-preview-header button[aria-pressed=true]{background:#134e4a;color:#ccfbf1}@media(max-width:600px){.guide-preview-header{padding:10px 12px;flex-wrap:wrap}.guide-preview-header>strong{font-size:18px}.guide-preview-header>strong>span{font-size:12px}.guide-preview-main{padding:12px}.guide-preview-banner{padding:8px 12px}}
html[data-render-sheet] .crm-doc-layout{height:auto}html[data-render-sheet] .crm-doc-content{overflow:visible;height:auto}html[data-render-sheet] .crm-doc-nav{align-self:start}
</style></head><body><div id="root"></div><script defer src="preview.js"></script></body></html>`;
function page(lang, chapter, theme = "light") {
  const content = renderToStaticMarkup(
    React.createElement(CrmUserGuide, {
      lang,
      isLight: theme === "light",
      initialChapter: chapter,
    }),
  );
  return html
    .replace(
      'lang="zh"',
      `lang="${lang}"${chapter ? ` data-chapter="${chapter}" data-render-sheet="true"` : ""}`,
    )
    .replace('data-theme="light"', `data-theme="${theme}"`)
    .replace('<div id="root"></div>', `<div id="root">${content}</div>`);
}
await fs.writeFile(path.join(out, "index.src.html"), page("zh"));
for (const lang of ["en", "id", "zh"]) {
  for (const chapter of Object.keys(guideLessons)) {
    await fs.writeFile(
      path.join(out, `${lang}-${chapter}.src.html`),
      page(lang, chapter),
    );
  }
}
for (const chapter of ["tasks-sla", "followup", "lifecycle"]) {
  await fs.writeFile(
    path.join(out, `id-${chapter}-dark.src.html`),
    page("id", chapter, "dark"),
  );
}
console.log(`Built isolated CRM guide preview: ${out}`);

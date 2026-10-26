import {useCrmUiText} from './CrmUiLanguage';
import type {ProfileFieldResult} from '../../utils/crmProfileSaveResult';
import {crmValue} from '../../utils/crmLanguage';
const show=(v:any)=>v===null?'明确清空':Array.isArray(v)?v.map(x=>crmValue(x,'zh')||x).join('、'):crmValue(String(v),'zh')||String(v);
export function CrmProfileSaveResult({results}:{results?:ProfileFieldResult[]}){
 const ui=useCrmUiText();
if(!results?.length)return null;return <section aria-label={ui("本次资料保存结果")}><h4>{ui("本次资料保存结果")}</h4><ul className="space-y-2">{results.map(r=><li key={r.field}><strong>{r.label} · {({applied:'已采用（本次保存时）',difference:'仅保留为不同记录，未覆盖',unchanged:'保持保存前的值'}as const)[r.status]}</strong><p>{r.status==='difference' ? (((ui("本次记录：") + show(r.requestedValue)) + ui("；保存时保留：")) + show(r.currentValue)) : (ui("保存时采用值：") + show(r.currentValue))}</p>{r.status==='difference'&&<p>{r.reason}{ui("。可在客户资料中对照原始依据后明确采用。")}</p>}</li>)}</ul></section>;}

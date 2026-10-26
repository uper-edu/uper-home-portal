import {useCrmUiText,crmUiText} from './CrmUiLanguage';
import {isSalesProgressStage} from '../../utils/crmSalesProgress';
import {crmValue} from '../../utils/crmLanguage';
import {formatCrmOperatingTime,viewerTimeZone} from '../../utils/crmOperatingTime';
export function progressSourceText(source:any,lang='zh'){if(source.type!=='assessment')return source.text||'';try{const r=JSON.parse(source.text);return crmUiText('真实测评记录',lang)+' · '+crmUiText(r.attempt?.mode==='full'?'完整测评':'快速／历史测评',lang)+(r.score!==undefined?' · '+r.score+'/'+(r.maxScore??'满分未知'):'');}catch{return crmUiText('真实测评记录',lang);}}
export function progressSourceTiming(s:any,lang='zh'){const format=(v:any)=>formatCrmOperatingTime(v,viewerTimeZone());const label=s.timeBasis==='reported_completion'?'完成时间（设备上报）':s.timeBasis==='linked_interaction'?'原互动发生时间':s.timeBasis==='staff_reported'?'实际发生时间':'依据记录时间（性质未注明）';return (s.occurredAt?crmUiText(label,lang)+'：'+format(s.occurredAt):crmUiText('实际发生时间未知',lang))+(s.receivedAt?' · '+crmUiText('接收：',lang)+format(s.receivedAt):'');}
export function CrmSalesProgressHistory({context,lang}:any){
 const ui=useCrmUiText(lang);

 const time=(v:any)=>v?formatCrmOperatingTime(v,viewerTimeZone()):'实际发生时间未知';
 const source=(s:any)=><div className="crm-stage-basis-original"><strong>{ui(s.label)}</strong><span>{progressSourceTiming(s,lang)}</span><p>{progressSourceText(s,lang)}</p>{s.amendments?.length>0&&<div role="note"><strong>{ui("此依据后有补充／修正；阶段未自动改变，请结合新信息核对。")}</strong>{s.amendments.map((a:any)=><p key={a.id}>{a.kind==='correction' ? ui("修正") : ui("补充")} · {time(a.recordedAt)}：{a.text}{a.reason?'（'+a.reason+'）':''}</p>)}</div>}</div>;
 return <div className="crm-stage-records"><details><summary>{ui("阶段历史（")}{context.history.length}）</summary>{!context.history.length?<p>{ui("尚无阶段调整记录。")}{!isSalesProgressStage(context.current.stage)&&'旧阶段保留原值，未自动映射。'}</p>:context.history.map((h:any)=><article key={h.id}><strong>{crmValue(h.before,lang)} → {crmValue(h.after,lang)}</strong><p>{ui("生效：")}{time(h.occurredAt)}</p><p>{h.reason}</p><small>{h.actor} {ui("· 录入")}{time(h.recordedAt)}</small>{h.basis?.length>0&&<details><summary>{ui("查看关联依据（")}{h.basis.length}）</summary>{h.basis.map((s:any)=><div key={s.type+':'+s.id}>{source(s)}</div>)}</details>}</article>)}</details>
 </div>;
}

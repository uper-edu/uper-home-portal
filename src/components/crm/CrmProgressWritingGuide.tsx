import {useCrmUiText} from './CrmUiLanguage';
import {AdminField} from '../AdminForm';
import {useState,useId,type ReactNode} from 'react';
import {BookOpen,ChevronDown} from 'lucide-react';
/** Examples are guidance only: never prefill customer facts or require every dimension. */
export function CrmProgressWritingGuide({children,lang='zh',inputId,label='进展记录 *'}:{children?:ReactNode;lang?:string;inputId?:string;label?:string}){
 const ui=useCrmUiText(lang);

 const [open,setOpen]=useState(false),id=useId();
 const examples=[
 ['学习目标与计划','学习目的、目标等级、考试计划、希望开始时间','客户计划明年3月参加HSK 3考试，希望下个月开始学习。'],
 ['上课条件','城市、授课方式、可上课时段','客户目前住万隆，只能周六晚上参加线上课。'],
 ['预算与顾虑','预算金额、币种、计价周期和明确表达的顾虑','客户每月预算不超过150万印尼盾，担心加班影响出勤。'],
 ['沟通偏好','首选沟通语言、首选联系渠道','客户希望用印尼语沟通，白天不方便接电话，可以发WhatsApp。'],
 ['阶段相关事实','咨询、测评、试听、报名或付款的实际进展','客户询问报名步骤，尚未提交报名信息，也未付款；不能记为已报名。'],
 ['购买信号','客户具体询问或表达了什么','客户主动询问分期方式，并希望查看周六班时间表。'],
 ['销售行动与结果','你实际做了什么，客户如何回应','我已发送现行价目表；客户回复会和家人讨论。发送资料不是客户购买信号。'],
 ['客户约定','双方明确同意的事项与时间','双方约定周五由我通过WhatsApp回复排期查询结果；请在客户约定中确认日期。'],
 ['信息变化或纠正','变化前后、发生时间、原记录误记之处','客户原计划下个月开始，现在改为明年1月；上一条150万是每月预算，不是整门课程预算。']
 ];
 return <section className="crm-progress-writing"><div className="crm-progress-writing-heading"><AdminField htmlFor={inputId}>{label}</AdminField>{<button type="button" className="crm-progress-reference-button" aria-expanded={open} aria-controls={id} onClick={()=>setOpen(v=>!v)}><BookOpen size={15}/>{ui("记录参考")}<ChevronDown size={14} aria-hidden="true"/></button>}</div>{children}
 {<div id={id} hidden={!open} className="crm-progress-writing-reference"><p>{ui("按“发生了什么 → 客户表达了什么 → 我做了什么 → 结果或约定”自然记录。有新信息才写，不必逐项回答，也不要补写客户没说过的内容。")}</p>{[['需求与条件',examples.slice(0,4)],['沟通与进展',examples.slice(4,7)],['约定与变化',examples.slice(7)]].map(([title,rows]:any)=><section key={title}><h4>{ui(title)}</h4><dl>{rows.map(([name,scope,example]:string[])=><div key={name}><dt>{ui(name)}<span> · {ui(scope)}</span></dt><dd>{ui(example)}</dd></div>)}</dl></section>)}<p><strong>{ui("未接通也可以很简短：")}</strong>{ui("今天下午主动拨打电话，未接通，尚未获得新信息。")}</p></div>}
 </section>;
}

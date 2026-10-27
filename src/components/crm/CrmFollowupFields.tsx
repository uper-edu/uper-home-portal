import {useCrmUiText} from './CrmUiLanguage';
import {profileDisplay} from './CrmSalesBrief';
import {profileFields} from '../../utils/crmDynamicProfile';
import {sameProfileValue} from '../../utils/crmFieldValues';
import {budgetPresentation} from '../../utils/crmLeadPresentation';
export type FollowupField={id:string;field:string;value:any;before?:any;beforeKnown?:boolean;batch:string;currentOnly?:boolean};
const empty=(v:any)=>v==null||v===''||Array.isArray(v)&&!v.length;
const shortLabels:Record<string,string>={availability:'时段',preferredStart:'开始',concerns:'顾虑',budgetAmount:'课程总预算'};
/** Compose only recorded fields in the same adoption batch; never fill units from today's profile. */
export function followupFieldRows(items:FollowupField[],lang:any){
 const rows:any[]=[],done=new Set<string>();
 for(const item of items){
  if(done.has(item.id))continue;
  const changed=item.beforeKnown&&!empty(item.before)&&!sameProfileValue(item.field,item.before,item.value);
  done.add(item.id);rows.push({id:item.id,label:shortLabels[item.field]||profileFields[item.field]||item.field,value:empty(item.value)?'已清空':(item.field==='budgetAmount'?budgetPresentation({budgetAmount:item.value},lang)?.value||profileDisplay(item.value,lang):profileDisplay(item.value,lang)),before:changed?(item.field==='budgetAmount'?budgetPresentation({budgetAmount:item.before},lang)?.value||profileDisplay(item.before,lang):profileDisplay(item.before,lang)):undefined,currentOnly:item.currentOnly});
 }
 return rows;
}
export function CrmFollowupFields({items,lang}: {items:FollowupField[];lang:any}){
 const ui=useCrmUiText(lang);
 return <dl className="crm-grouped-field-changes crm-followup-field-results">{followupFieldRows(items,lang).map(row=><div key={row.id}><dt>{ui(row.label)}</dt><dd>{row.before!==undefined?<><span className="crm-profile-value-before">{row.before}</span><span aria-label={ui('变为')}> → </span><span>{row.value}</span></>:row.value}{row.currentOnly&&<small className="crm-followup-value-scope">{ui('当前资料，非当次记录值')}</small>}</dd></div>)}</dl>;
}

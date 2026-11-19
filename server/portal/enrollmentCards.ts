import { enrollmentPreviewOrigin } from './enrollmentEmail.ts';
import { formatCurrency } from '../../src/utils/currency.ts';

export function enrollmentCard(kind:'class'|'payment'|'report',id:string,title:string,fields:Record<string,string|number>) {
  const labels={class:'查看 CRM 班次',payment:'查看 CRM 核款记录',report:'查看 CRM 经营明细'};
  const field={class:'classId',payment:'orderId',report:'weekStart'}[kind];
  const url=enrollmentPreviewOrigin+'/crm?'+new URLSearchParams({tab:'enrollment',view:kind,[field]:id});
  return {url,card:{schema:'2.0',header:{title:{tag:'plain_text',content:title}},
    body:{elements:[
      {tag:'markdown',content:Object.entries(fields).map(([label,value])=>`**${label}**　${value}`).join('\n')},
      {tag:'button',text:{tag:'plain_text',content:labels[kind]},type:'primary',
        behaviors:[{type:'open_url',default_url:url}]},
    ]},
  }};
}
export const cardMoney=(value:number|null)=>value===null?'金额未知':formatCurrency(value,'zh');

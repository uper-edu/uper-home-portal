import {createHash} from 'node:crypto';
import {fact} from './trustWorkflow.ts';
import {validateInsightDimension,type InsightDimension} from '../../src/utils/crmCustomerInsights.ts';
import {buildDimensionCatalog} from '../../src/utils/crmDimensionCatalog.ts';
export async function customerDimensionCatalog(c:any){return buildDimensionCatalog(await insightCatalog(c));}
/** Shared vocabulary only. This query never returns another customer's values or quotations. */
export async function insightCatalog(c:any):Promise<InsightDimension[]>{
 const rows=(await c.query("SELECT id,data FROM crm_facts WHERE kind='insight.dimension_created' ORDER BY created_at,id")).rows;
 return rows.map((r:any)=>r.data.dimension).filter(Boolean);
}
export function insightDimensionId(key:string){const h=createHash('sha256').update('crm-insight-dimension-v1:'+key).digest('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20,32)}`;}
export async function resolveInsightDimension(c:any,leadId:string,o:any,catalog?:InsightDimension[]):Promise<InsightDimension>{
 catalog=catalog||await insightCatalog(c);const known=catalog.find(d=>d.key===o.field);
 if(known)return known;
 const proposed=validateInsightDimension(o.dimension,o.field);
 const identical=catalog.find(d=>['en','id','zh'].every(k=>d.labels[k].trim().toLowerCase()===proposed.labels[k].trim().toLowerCase()));
 if(identical)return identical;
 const id=insightDimensionId(proposed.key);
 await fact(c,leadId,'insight.dimension_created','ai',{dimension:proposed},id);
 // Exact-key concurrent inserts share an immutable registry fact; read the committed definition.
 const saved=(await c.query('SELECT data FROM crm_facts WHERE id=:p1 FOR SHARE',[id])).rows[0];
 if(!saved?.data?.dimension)throw Error('洞察维度暂不可用');
 catalog.push(saved.data.dimension);return saved.data.dimension;
}

import { promotionAttribution } from './attribution.ts';
import { promotionEntryPoint, promotionEvidenceKeys, promotionIdentity } from '../../src/utils/promotionNavigation.ts';

type Client = { query:(sql:string,params?:unknown[])=>Promise<{rows:any[]}> };

export async function recordEnrollmentAttribution(c:Client, kind:string, id:string, query:unknown) {
  const params=new URLSearchParams(typeof query==='string'&&query.length<=4096?query:'');
  const {p,invalid}=promotionIdentity(params);
  const attribution=await promotionAttribution(c,{},{
    promotionLinkId:p??(params.has('p')?'':undefined),
    promotionParametersInvalid:invalid,
    promotionParameters:promotionEvidenceKeys.flatMap(key=>params.getAll(key).map(value=>({key,value}))),
    utmCampaign:params.get('utm_campaign')||undefined,
  },true);
  const entry=promotionEntryPoint(params.get('entry_point')) ?? 'direct';
  const language=params.get('lang');
  const via=params.get('enrollment_via');
  await c.query(`INSERT INTO enrollment_record_attribution(kind,record_id,attribution)
    VALUES(:p1,:p2,:p3) ON DUPLICATE KEY UPDATE record_id=record_id`, [kind,id,{
    entry,via:via==='ai_chat'||via==='whatsapp'?via:undefined,lang:['zh','id','en'].includes(language??'')?language:undefined,
    campaignId:attribution.campaignId,campaign:attribution.campaign,
    promotionId:attribution.promotionLinkId,verified:attribution.promotionLinkStatus==='verified',
    source:attribution.promotionSnapshot?.source,medium:attribution.promotionSnapshot?.medium,
    evidence:promotionEvidenceKeys.flatMap(key=>params.getAll(key).slice(0,4).map(value=>({key,value:value.slice(0,191)}))),
  }]);
}

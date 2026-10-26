/** Only an explicit, quoted request is routed; interest and a hypothetical are not requests. */
export function explicitAdvisorRequest(o:any){
 return o.kind==='signal'&&o.field==='advisor_request'&&o.subject==='customer'&&o.temporality==='current'&&
 !/不要|不必|不需要|暂不|以后再|如果|假如|可能|not yet|do not|don't|might|jangan|belum/i.test(o.quote)&&
 /(?:请|希望|要求|麻烦|想让).{0,30}(?:联系|回电)|(?:顾问|老师).{0,12}(?:联系我|回电)|(?:please|want|would like).{0,40}(?:contact|call)|(?:mohon|tolong|ingin).{0,30}(?:hubungi|telepon)/i.test(o.quote);
}

/** A narrowly explicit command must not silently disappear as just a preferred channel. */
export function requireExplicitAdvisorEvidence(text:string,observations:any[]){
 const statements=text.split(/[。！？!?；;\n]/).map(v=>v.trim());
 const required=statements.some(s=>/^(?:请|麻烦)(?:让)?(?:顾问|老师).{0,25}(?:联系我|给我回电)/.test(s)&&!/不要|不必|不需要|暂不|以后|如果|假如|可能/.test(s));
 if(required&&!observations.some(explicitAdvisorRequest))throw Error('明确顾问联系请求未完整提取');
}

/** Compare only explicitly edited leaves; runtime counters never participate. */
export function campaignEditLeaves(fields:any){
 return Object.entries(fields).filter(([k])=>!['requestId','expectedFields'].includes(k)).flatMap(([k,v])=>['stats','boundUtm'].includes(k)&&v&&typeof v==='object'?Object.keys(v).map(sub=>`${k}.${sub}`):[k]);
}
export function campaignEditValue(record:any,path:string):any{
 const value=path.split('.').reduce((v,k)=>v?.[k],record);
 if(value===undefined||value===null)return path==='stats.budgetCost'?null:'';
 return value;
}
export function campaignEditBase(record:any,fields:any){return Object.fromEntries(campaignEditLeaves(fields).map(k=>[k,campaignEditValue(record,k)]));}
export function campaignEditConflicts(record:any,fields:any,expected:any){
 if(!expected||typeof expected!=='object'||Array.isArray(expected))return ['invalid'];
 return campaignEditLeaves(fields).filter(k=>!Object.hasOwn(expected,k)||JSON.stringify(campaignEditValue(record,k))!==JSON.stringify(expected[k]));
}

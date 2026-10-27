const cities:Record<string,string>={'雅加达':'Jakarta','jakarta':'Jakarta','泗水':'Surabaya','surabaya':'Surabaya','万隆':'Bandung','bandung':'Bandung'};
export function canonicalFieldValue(field:string,value:any){return field==='city'&&typeof value==='string'?cities[value.trim().toLowerCase()]||value.trim():value;}
export function sameProfileValue(field:string,a:any,b:any){const normalized=(v:any)=>{const x=canonicalFieldValue(field,v);return Array.isArray(x)?[...x].sort():x??null};return JSON.stringify(normalized(a))===JSON.stringify(normalized(b));}

/** Semantic compatibility is deliberately narrow; unknown meanings remain differences. */
export function compatibleProfileValue(field:string,a:any,b:any){
 if(sameProfileValue(field,a,b))return true;
 if(field!=='goal'||typeof a!=='string'||typeof b!=='string')return false;
 const hsk=(s:string)=>/HSK|汉语水平考试/i.test(s)&&!/不.{0,4}(?:HSK|考试)|不再|放弃|instead|no longer|not interested|tidak/i.test(s);
 return hsk(a)&&hsk(b);
}

/** The questionnaire's Other bucket means outside Greater Jakarta, not a conflicting city. */
export function isCityRefinement(previous:any,next:any){
 const vague=new Set(['other','其他','其它','其他地区','其它地区','其他城市','其他省市','其他地区/海外','lainnya']);
 const normalize=(v:any)=>typeof v==='string'?v.trim().toLowerCase():'';
 const from=normalize(previous),to=normalize(next);
 return vague.has(from)&&!!to&&!vague.has(to)&&canonicalFieldValue('city',next)!=='Jakarta'&&!['unknown','未注明','未知','不清楚','尚未确定','not sure'].includes(to);
}

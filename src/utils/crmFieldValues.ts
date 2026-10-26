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

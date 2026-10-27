const cities:Record<string,string>={'雅加达':'Jakarta','jakarta':'Jakarta','泗水':'Surabaya','surabaya':'Surabaya','万隆':'Bandung','bandung':'Bandung'};
export function canonicalFieldValue(field:string,value:any){return field==='city'&&typeof value==='string'?cities[value.trim().toLowerCase()]||value.trim():value;}
export function sameProfileValue(field:string,a:any,b:any){const normalized=(v:any)=>{const x=canonicalFieldValue(field,v);return Array.isArray(x)?[...x].sort():x??null};return JSON.stringify(normalized(a))===JSON.stringify(normalized(b));}

/** Compatibility changes presentation/adoption classification, never erases either source. */
const negativeMeaning = (s:string)=>/不再|不想|不考|放弃|不准备|instead|no longer|not interested|tidak|bukan/i.test(s);
function goalMeaning(s:string){
 const v=s.trim().toLowerCase().replace(/[。.!！]$/,'');
 if(negativeMeaning(v))return '';
 if(/^(study in china or scholarship|赴华留学或申请奖学金|赴华留学|申请中国大学奖学金|申请中国大学|赴华留学 \/ 申请全额奖学金|留学中国|中国留学或奖学金)$/.test(v))return 'scholarship';
 if(v==='work in china'||v==='赴华工作'||v==='直接赴华工作发展')return 'career-china';
 if(v==='work at a chinese or china-indonesia joint venture company in indonesia'||/^(在印尼中资或合资企业工作|印尼本地中资 \/ 合资企业就业 \(职场中文\))$/.test(v))return 'career-indonesia';
 if(/^(学习职场中文|职场中文|为了工作学习中文|提升职场中文|workplace mandarin|business chinese)$/.test(v))return 'career-general';
 if(/^(improve my mandarin skills|提升中文能力|提高中文沟通能力|提升日常中文口语与听说技能|提升课堂交流能力)$/.test(v))return 'skills';
 if(/HSK|汉语水平考试/i.test(v))return 'hsk';
 return '';
}
function availabilityMeaning(s:string){
 if(/不|不能|不要|未定|未知|可能|not|except|tidak|belum/i.test(s))return null;
 const days=[...s.matchAll(/(?:周|星期)([一二三四五六日天])/g)].map(m=>m[1]==='天'?'日':m[1]);
 const parts=s.match(/早上|上午|中午|下午|晚上|晚间/g)||[];
 const times=s.match(/[一二两三四五六七八九十\d]+(?:点|时|:)(?:半|[一二三四五六七八九十\d]+分?)?/g)||[];
 return days.length&&parts.length?{days:[...new Set(days)].sort().join(''),parts:[...new Set(parts.map(x=>x==='晚间'?'晚上':x))].sort().join(''),times:times.sort().join('|')}:null;
}
export function compatibleProfileValue(field:string,a:any,b:any){
 if(sameProfileValue(field,a,b))return true;
 if(typeof a!=='string'||typeof b!=='string')return false;
 if(field==='goal'){
  const x=goalMeaning(a),y=goalMeaning(b);
  if(x==='hsk'&&y==='hsk'){const first=a.match(/HSK\s*([1-6])/i)?.[1],second=b.match(/HSK\s*([1-6])/i)?.[1];if(first&&second&&first!==second)return false;}
  return !!x&&!!y&&(x===y||x==='career-general'&&y.startsWith('career-')||y==='career-general'&&x.startsWith('career-'));
 }
 if(field==='availability'){
  const x=availabilityMeaning(a),y=availabilityMeaning(b);
  return !!x&&!!y&&x.days===y.days&&x.parts===y.parts&&(!x.times||!y.times||x.times===y.times);
 }
 return false;
}

/** The questionnaire's Other bucket means outside Greater Jakarta, not a conflicting city. */
export function isCityRefinement(previous:any,next:any){
 const vague=new Set(['other','其他','其它','其他地区','其它地区','其他城市','其他省市','其他地区/海外','lainnya']);
 const normalize=(v:any)=>typeof v==='string'?v.trim().toLowerCase():'';
 const from=normalize(previous),to=normalize(next);
 return vague.has(from)&&!!to&&!vague.has(to)&&canonicalFieldValue('city',next)!=='Jakarta'&&!['unknown','未注明','未知','不清楚','尚未确定','not sure'].includes(to);
}

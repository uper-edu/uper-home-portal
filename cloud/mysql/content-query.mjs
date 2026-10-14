export const collections=['partners','news','newsPage','trendingPrograms','studentStories','campaigns','admissionsList'];
const types={partner:'partners',news:'news',newspage:'newsPage',trendingprogram:'trendingPrograms',studentstory:'studentStories',campaign:'campaigns',admissionslist:'admissionsList'};
export function collectionFor(query){
  if(typeof query!=='string'||query.length>3000)throw Error('Invalid content query');
  const type=query.match(/_type\s*==\s*["'](\w+)["']/i)?.[1]?.toLowerCase();
  if(!types[type])throw Error('Unsupported content type');
  return types[type];
}
export function projectContent(items,query,params={}){
  let result=[...items];
  if(/isActive\s*==\s*true/i.test(query))result=result.filter(x=>x.isActive!==false);
  if(/slug\.current/.test(query)||params?.slug){return result.find(x=>(x.slug?.current||x.slug)===params.slug)||null;}
  const order=query.match(/order\(([^)]+)\)/i)?.[1];
  if(order){const fields=order.split(',').map(x=>x.trim().split(/\s+/));
    if(fields.some(([f,d])=>!['order','name','publishedAt','_createdAt'].includes(f)||!['asc','desc'].includes(d)))throw Error('Unsupported content order');
    result.sort((a,b)=>{for(const [field,direction] of fields){const av=a[field]??(field==='order'?0:''),bv=b[field]??(field==='order'?0:'');const n=typeof av==='number'&&typeof bv==='number'?av-bv:String(av).localeCompare(String(bv));if(n)return direction==='desc'?-n:n;}return String(a._id).localeCompare(String(b._id));});
  }
  const limit=query.match(/\[0\.\.\.(\d+)\]/);if(limit)result=result.slice(0,Math.min(Number(limit[1]),500));
  return result;
}

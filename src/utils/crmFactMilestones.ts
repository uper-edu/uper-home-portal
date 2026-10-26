/** Display only explicitly established events, never AI statements or stage labels. */
export function groupFactMilestones(items:any[]=[]){
 const groups=new Map<string,any>(),seen=new Set<string>();
 for(const item of items){
  if(item.established!==true||item.aiDerived||!['assessment','enrollment_confirmation'].includes(item.factType))continue;
  const key=item.factType==='assessment'?'assessment:'+(['express','full'].includes(item.data?.attempt?.mode)?item.data.attempt.mode:'legacy'):'enrollment_confirmation';
  const identity=item.factType==='assessment'?item.basis?.type==='assessment'&&item.basis?.id:item.id;
  if(!identity||seen.has(item.factType+':'+identity))continue;seen.add(item.factType+':'+identity);
  if(!groups.has(key))groups.set(key,{key,title:key==='assessment:express'?'完成快速测评':key==='assessment:full'?'完成完整测评':key==='assessment:legacy'?'完成测评':'人工确认报名成立',records:[]});
  groups.get(key).records.push(item);
 }
 const instant=(v:any)=>typeof v==='string'&&Number.isFinite(Date.parse(v))?Date.parse(v):null;
 for(const group of groups.values()){
  group.records.sort((a:any,b:any)=>{const at=instant(a.occurredAt),bt=instant(b.occurredAt);if(at!==null&&bt!==null)return bt-at||String(a.id).localeCompare(String(b.id));if(at===null&&bt!==null)return 1;if(at!==null&&bt===null)return -1;return String(a.id).localeCompare(String(b.id));});
  group.enrollmentScope=group.key==='enrollment_confirmation'&&group.records.every((r:any)=>r.enrollmentScope==='course')?'course':undefined;
  if(group.key==='enrollment_confirmation')group.title=enrollmentMilestoneLabel(group);
  group.latest=group.records[0];group.count=group.records.length;group.unknownCount=group.records.filter((r:any)=>instant(r.occurredAt)===null).length;
  group.countLabel=group.key==='enrollment_confirmation'?`确认记录${group.count}条`:`${group.count}次`;
 }
 return [...groups.values()].sort((a,b)=>(instant(b.latest.occurredAt)??-Infinity)-(instant(a.latest.occurredAt)??-Infinity)||a.key.localeCompare(b.key));
}

/** New explicit course confirmations stay distinct from unclassified historical records. */
export function enrollmentMilestoneLabel(group:any){return group.enrollmentScope==='course'?'课程报名已确认':'报名确认（对象未注明）';}

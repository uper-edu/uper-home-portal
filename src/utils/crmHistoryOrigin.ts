/** Only explicit source metadata determines the lane. Never classify free-text semantics. */
export function historyOrigin(group:any){
 const root=group.root||{},log=group.log;
 const customer=['message','questionnaire','assessment'].includes(group.category);
 const staff=!!log||['followup.recorded','record.amended','stage.changed'].includes(root.eventType)||root.payload?.sourceType==='sales_edit'||root.payload?.adoption==='explicit_sales_edit'||root.actor&&!['visitor','system','ai'].includes(root.actor);
 const lane=customer?'customer':staff?'staff':'system';
 const author=customer?'客户':log?.staffName||root.payload?.staffName||root.actorName||({visitor:'客户',system:'系统',ai:'AI整理'}as Record<string,string>)[root.actor]||root.actor||'记录者未注明';
 const format=({message:'客户对话',questionnaire:'客户问卷',assessment:'测评记录',sales:'销售记录',stage:'销售阶段',profile:'资料编辑',ownership:'负责人变更'}as Record<string,string>)[group.category]||'系统记录';
 // A recorded contact channel is not a preference or an inferred integration.
 const channel=log?.channel||(group.category==='message'?'网站AI咨询':group.category==='questionnaire'?'网站':group.category==='assessment'?'在线测评':undefined);
 return {lane,author,format,channel};
}

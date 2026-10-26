/** Presentation only: keep the original source distinct from the processing method. */
export function crmSourcePresentation(sourceType?:string){
 const labels:Record<string,string>={ai_customer_text:'客户对话',ai_sales_text:'销售记录',customer_message:'客户对话',sales_record:'销售记录',sales_amendment:'补充／修正',questionnaire:'客户问卷',sales_contact:'销售记录',sales_edit:'资料编辑',legacy:'既有资料'};
 return {label:sourceType?labels[sourceType]||'来源待识别':'来源未注明',aiDerived:sourceType==='ai_customer_text'||sourceType==='ai_sales_text'};
}

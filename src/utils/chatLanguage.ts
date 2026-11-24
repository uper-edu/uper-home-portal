export function chatLanguage(preferred?:string,search=''): 'en'|'id'|'zh' {
 const requested=new URLSearchParams(search).get('lang');
 if(requested==='en'||requested==='id'||requested==='zh')return requested;
 return preferred==='id'||preferred==='zh'?preferred:'en';
}


export function chineseChatInput(message: string) {
  const han = message.match(/\p{Script=Han}/gu)?.length ?? 0;
  const latin = message.match(/\p{Script=Latin}/gu)?.length ?? 0;
  return han >= 3 && han >= latin;
}

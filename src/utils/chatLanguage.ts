export function chatLanguage(preferred?:string,search=''): 'en'|'id'|'zh' {
 const requested=new URLSearchParams(search).get('lang');
 if(requested==='en'||requested==='id'||requested==='zh')return requested;
 return preferred==='id'||preferred==='zh'?preferred:'en';
}

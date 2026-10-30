import {questionnaireAnswers} from './crmQuestionnaireEvidence';
import {crmUiText} from './crmUiText';
import {crmValue} from './crmLanguage';

/** Fixed questionnaire keys and enumerated placeholders only; never infer meaning from answers. */
export function questionnaireSalesRows(source:any){
 const answers=questionnaireAnswers(source),rows:{key:string;label:string;values:string[];fields:string[]}[]=[];
 const values=(key:string):string[]=>answers[key]==null?[]:Array.isArray(answers[key])?answers[key]:[answers[key]];
 const goals=[...new Set([...values('goal'),...values('goals')])];
 if(goals.length)rows.push({key:'goals',label:'学习目标',values:goals,fields:['goal','goals']});
 const fields=[['reportedLevel','自报水平'],['mode','授课方式'],['nextStepInterest','希望了解的内容'],['buyingSignals','问卷关注内容'],['city','城市'],['currentStatus','客户身份']];
 for(const[key,label]of fields){let list=values(key);if(key==='city')list=list.filter(v=>!['Other','other','其他','其它','Lainnya','lainnya'].includes(v));if(list.length)rows.push({key,label,values:[...new Set(list)],fields:[key]});}
 return rows;
}

/** Same controlled-value presentation as the complete original; free text stays unchanged. */
export function questionnaireAnswerText(key:string,value:string,lang:string){
 if(['fullName','whatsapp','email','campaignName'].includes(key))return value;
 if(key==='city'&&value==='Jakarta')return lang==='zh'?'雅加达':'Jakarta';
 return ({standalone_chat:crmUiText('学习咨询入口',lang),chat:crmUiText('学习咨询入口',lang),website:crmUiText('官网',lang),organic:crmUiText('自然访问',lang)}as Record<string,string>)[value]||crmValue(value,lang as 'zh'|'en'|'id');
}

export function questionnaireSalesPreview(source:any,lang:string){
 return questionnaireSalesRows(source).slice(0,3).map(row=>crmUiText(row.label,lang)+(lang==='zh'?'：':': ')+row.values.map(value=>questionnaireAnswerText(row.key,value,lang)).join(lang==='zh'?'、':', ')).join(' · ');
}

import {contactStatistics} from './crmContact';
import {crmAssessmentSummary} from './crmAssessment';

export const identityComparisonFields=['name','phone','email','owner','registered','source','background','language','goals','location','stage','assessment','tasks','contact'] as const;
type Field=typeof identityComparisonFields[number];
const present=(v:unknown):boolean=>Array.isArray(v)?v.some(present):typeof v==='string'?!!v.trim()&&!['unknown','not sure','beginner / not sure','unconfirmed','not provided','not recorded','none','—','-'].includes(v.trim().toLowerCase()):v!==undefined&&v!==null;
/** Classify raw evidence before localization: equal fallback labels are not common facts. */
export function identityComparisonFieldPresent(side:any,field:Field):boolean{
  const p=side.profile;
  switch(field){
    case 'name':return present(p.fullName||p.name);
    case 'phone':return present(p.whatsapp);
    case 'email':return present(p.email);
    case 'owner':return present(p.owner);
    case 'registered':return present(p.submittedAt);
    case 'source':return present(p.entryPoint)||present(p.campaign);
    case 'background':return present(p.currentStatus);
    case 'language':return ['en','id','zh'].includes(p.communicationLanguage);
    case 'goals':return present(p.goals)||present(p.goal);
    case 'location':return present(p.city)&&present(p.mode);
    case 'stage':return present(p.currentStage)&&present(p.tier);
    case 'assessment':{
      const summary=crmAssessmentSummary(p,'en');
      return summary.kind==='self'?present(p.reportedLevel):summary.kind==='teacher'?present(p.levelConfirmed):Boolean(p.latestAssessment&&Object.keys(p.latestAssessment).length)||typeof p.quizScore==='number'||present(p.levelConfirmed);
    }
    case 'tasks':return (side.tasks||[]).some((v:any)=>['open','overdue','migration_hold'].includes(v.status));
    case 'contact':return Boolean(contactStatistics(p).lastAttempt);
  }
}

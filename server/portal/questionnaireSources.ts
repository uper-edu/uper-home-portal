import {questionnaireBasicSources} from '../../src/utils/crmQuestionnaireSources';
export async function attachQuestionnaireBasicSources(db:any,leads:any[]){
 if(!leads.length)return;
 const rows=(await db.query("SELECT id,lead_id,kind,data,created_at FROM crm_facts WHERE kind IN ('questionnaire.submitted','profile.fields_updated') AND JSON_CONTAINS(:p1,JSON_QUOTE(lead_id))",[JSON.stringify(leads.map(l=>l.id))])).rows;
 for(const lead of leads)Object.assign(lead,questionnaireBasicSources(lead,rows));
}

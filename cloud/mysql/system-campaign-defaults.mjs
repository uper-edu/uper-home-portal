import evergreenLinks from '../../src/data/evergreenPromotionLinks.json' with {type:'json'};
import defaults from '../../src/data/system-defaults/index.ts';

export function systemCampaignDefaults(at){
 const records=JSON.parse(JSON.stringify(defaults.campaigns).replaceAll('SYSTEM_INITIALIZED_AT',at));
 const social = records.find(record => record.id === 'social-bio');
 social.promotionLinks = evergreenLinks.map(link=>({...link,language:'id',promotionKind:'unpaid',experience:'questionnaire_assessment_consultation',createdAt:at}));
 return records;
}

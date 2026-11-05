import evergreenLinks from '../../src/data/evergreenPromotionLinks.json' with {type:'json'};
import defaults from './system-defaults.json' with {type:'json'};

export function systemCampaignDefaults(at){
 const records=JSON.parse(JSON.stringify(defaults.campaigns).replaceAll('SYSTEM_INITIALIZED_AT',at));
 const instagram = records.find(record => record.id === 'instagram-bio');
 records.push({
  ...instagram, id:'social-bio', code:'social-bio', presetKey:'social_bio_v1',
  name:'日常自然推广', nameEn:'Evergreen unpaid promotion', nameId:'Promosi rutin tanpa biaya',
  boundUtm:{...instagram.boundUtm,utm_source:'',utm_medium:'',utm_campaign:'social-bio'},
  systemManaged:true,
  promotionLinks:evergreenLinks.map(link=>({...link,language:'id',promotionKind:'unpaid',experience:'questionnaire_assessment_consultation',createdAt:at})),
 });
 return records;
}

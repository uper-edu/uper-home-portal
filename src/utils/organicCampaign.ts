export const ORGANIC_CAMPAIGN_ID='organic';
export function canonicalCampaignId(value?:string|null){const key=(value||'').trim();return !key||['home','organic'].includes(key.toLowerCase())?ORGANIC_CAMPAIGN_ID:key;}
export function isOrganicCampaign(c:{id?:string;code?:string}){return [c.id,c.code].some(v=>v?.toLowerCase()==='organic');}
export function organicCampaignName(lang:string){return lang==='zh'?'自然流量':lang==='id'?'Trafik organik':'Organic traffic';}
export function assertEditableCampaign(input:{id?:string;code?:string;systemManaged?:boolean}){if([input.id,input.code].some(v=>v&&['home','organic'].includes(v.trim().toLowerCase())))throw Object.assign(Error('System organic campaign is permanent and read-only'),{status:403});}
export function organicCampaignRecord(at=new Date().toISOString()){
  return {id:ORGANIC_CAMPAIGN_ID,code:ORGANIC_CAMPAIGN_ID,name:'自然流量',nameEn:'Organic traffic',nameId:'Trafik organik',systemManaged:true,type:'other',status:'active',organizer:'',startDate:'',endDate:'',startTime:'',endTime:'',city:'',venue:'',locationType:'online',address:'',targetAudience:[],keyTopics:[],speakers:[],
    boundUtm:{utm_source:'organic',utm_medium:'website',utm_campaign:ORGANIC_CAMPAIGN_ID,defaultHook:'hsk_assessment',defaultContext:'website',defaultLang:'id'},
    aiAssets:{posterHeading:'',posterSubheading:'',socialCopy:'',whatsappInvitation:'',chatWelcomeGreeting:'',presentationOutline:'',deskTentBullets:[]},stats:{impressions:0,budgetCost:0},createdAt:at,updatedAt:at};
}

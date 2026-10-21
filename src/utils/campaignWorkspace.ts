import type { CrmCampaignRecord } from '../types/crmCampaign';
export type CampaignLanguage = 'en' | 'id' | 'zh';
export const campaignText = (lang: CampaignLanguage, en: string, id: string, zh: string) => ({en,id,zh})[lang];
export const campaignName = (c: CrmCampaignRecord, lang: CampaignLanguage) =>
  c.name;
export const campaignAssetKeys = ['posterHeading','posterSubheading','socialCopy','whatsappInvitation','chatWelcomeGreeting','presentationOutline'] as const;
export type CampaignAssetKey = typeof campaignAssetKeys[number];
export type CampaignDraft = Partial<Record<CampaignAssetKey,string>>;
export const campaignAssetLabel = (key: CampaignAssetKey, lang: CampaignLanguage) => {
 const labels: Record<CampaignAssetKey,[string,string,string]> = {
  posterHeading:['Poster headline','Judul poster','海报标题'], posterSubheading:['Poster details','Detail poster','海报说明'],
  socialCopy:['Social post','Posting media sosial','社交媒体文案'],whatsappInvitation:['WhatsApp invitation','Undangan WhatsApp','WhatsApp邀请'],
  chatWelcomeGreeting:['Welcome message draft','Draf pesan sambutan','欢迎语草稿'],presentationOutline:['Talking points','Poin pembicaraan','讲解要点']};
 return campaignText(lang,...labels[key]);
};
export function campaignTemplate(c: CrmCampaignRecord, lang: CampaignLanguage): CampaignDraft {
 const t=(en:string,id:string,zh:string)=>campaignText(lang,en,id,zh);
 const title=campaignName(c,lang);
 const date=[c.startDate,c.startTime].filter(Boolean).join(' ');
 const details=[date ? `${t('Schedule','Jadwal','时间')}: ${date}${c.startTime?' (Asia/Jakarta)':''}` : '',c.venue?`${t('Venue','Tempat','地点')}: ${c.venue}`:'',c.city||''].filter(Boolean).join('\n');
 // Customer-authored facts are never translated or expanded into promises.
 const link='{{campaign_link}}';
 return {posterHeading:title,posterSubheading:details,
 socialCopy:[title,details,t('Learn more and register your interest:','Pelajari lebih lanjut dan daftarkan minat Anda:','了解详情并登记意向：'),link].filter(Boolean).join('\n'),
 whatsappInvitation:[t('Hello!','Halo!','您好！'),title,details,t('You can learn more here:','Anda dapat melihat informasi lebih lanjut di sini:','您可以通过以下链接了解详情：'),link].filter(Boolean).join('\n'),
 chatWelcomeGreeting:t(`Welcome! What would you like to know about ${title}?`,`Selamat datang! Apa yang ingin Anda ketahui tentang ${title}?`,`您好！关于${title}，您希望了解什么？`),
 presentationOutline:(c.keyTopics||[]).map(x=>`• ${x}`).join('\n')};
}
export function campaignScheduleError(v: Record<string,any>): boolean {
 const {startDate:s,endDate:e,startTime:st,endTime:et}=v;
 if ((st&&!s)||(et&&!e)) return true;
 if ((s&&!/^\d{4}-\d{2}-\d{2}$/.test(s))||(e&&!/^\d{4}-\d{2}-\d{2}$/.test(e))) return true;
 if ((st&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(st))||(et&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(et))) return true;
 return Boolean(s&&e&&(e<s||(s===e&&st&&et&&et<st)));
}

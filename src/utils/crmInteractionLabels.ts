import type {InteractionTrack} from './crmInteractionTimeline';
/** Shared list/detail headings. Longer definitions belong in accessible empty-state context. */
const trackLabels:Record<InteractionTrack,readonly[string,string,string]>={
 communication:['有效沟通','Conversation','Komunikasi'],
 customer:['客户互动','Customer interactions','Interaksi pelanggan'],
 sales:['销售联系','Sales outreach','Kontak sales'],
};
export function interactionTrackLabel(track:InteractionTrack,lang='zh'){return trackLabels[track][lang==='zh'?0:lang==='id'?2:1];}

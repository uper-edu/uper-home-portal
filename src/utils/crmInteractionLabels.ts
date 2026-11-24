import type {InteractionTrack} from './crmInteractionTimeline';
/** Shared list/detail headings. Longer definitions belong in accessible empty-state context. */
const trackLabels:Record<InteractionTrack,readonly[string,string,string]>={
 communication:['有效沟通','Conversation','Komunikasi'],
 customer:['客户互动','Customer interactions','Interaksi pelanggan'],
 sales:['销售联系','Sales outreach','Kontak sales'],
};
export function interactionTrackLabel(track:InteractionTrack,lang='zh'){return trackLabels[track][lang==='zh'?0:lang==='id'?2:1];}

export const humanCommunicationLabels={
 established:['已建立人工沟通','Human conversation established','Sudah berkomunikasi dengan staf'],
 unrecorded:['暂无有效人工沟通记录','No effective human conversation recorded','Belum ada catatan komunikasi efektif dengan staf'],
} as const;
export function humanCommunicationLabel(state:keyof typeof humanCommunicationLabels,lang='zh'){
 return humanCommunicationLabels[state][lang==='zh'?0:lang==='id'?2:1];
}

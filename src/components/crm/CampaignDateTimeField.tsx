import {AdminDateField} from '../admin/AdminDateField';
import {AdminRowAction} from '../admin/AdminListControl';
import {campaignDateTimeValue, campaignViewerSchedule} from '../../utils/campaignScheduleInput';
import {campaignUi, type CampaignUiLanguage} from '../../utils/campaignI18n';

export function CampaignDateTimeField({label,date,time,draft,error,onChange,lang='en'}:{
  lang?:CampaignUiLanguage;
  label:string;
  date:string;
  time:string;
  draft?:string;
  error?:string;
  onChange:(value:string)=>void;
}){
  const u=campaignUi(lang);
  const shown=campaignViewerSchedule(date,time);
  const value=campaignDateTimeValue(shown.date,shown.time);
  const partial=draft===undefined&&Boolean((date||time)&&!value);
  return <div className="campaign-datetime-field">
    <AdminDateField label={label} lang={lang} withTime value={draft??value} error={error} onChange={onChange}/>
    {partial&&<div className="campaign-datetime-partial">
      <p>{u('Recorded: {date} · {time}. Kept until replaced or cleared.', {
        date:date||u('Date not recorded'),time:time||u('Time not recorded'),
      })}</p>
      <AdminRowAction onClick={()=>onChange('')}>{u('Clear {label}',{label:lang==='en'?label.toLowerCase():label})}</AdminRowAction>
    </div>}
  </div>;
}

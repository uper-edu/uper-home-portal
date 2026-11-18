import {useId} from 'react';
import {AdminField,AdminFieldLabel} from '../AdminForm';
import {AdminRowAction} from './AdminListControl';
import {AdminCalendarPicker} from './AdminCalendarPicker';
import type {CrmLanguage} from '../../utils/crmLanguage';

const labels = {
  zh:{date:'日期',time:'时间',select:'选择日期',clear:'清除日期与时间'},
  en:{date:'Date',time:'Time',select:'Select date',clear:'Clear date and time'},
  id:{date:'Tanggal',time:'Waktu',select:'Pilih tanggal',clear:'Hapus tanggal dan waktu'},
};

export const completeAdminDateTime = (value:string) =>
  /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);

export function AdminDateField({label,value,onChange,lang,withTime=false,required=false,disabled=false,error}:{
  label:string; value:string; onChange:(value:string)=>void; lang:CrmLanguage;
  withTime?:boolean; required?:boolean; disabled?:boolean; error?:string;
}){
  const errorId=useId();
  const ui=labels[lang];
  const [date='',time='']=value.split('T');
  return <AdminField as="div" role="group" aria-label={label}>
    <AdminFieldLabel required={required}>{label}</AdminFieldLabel>
    <div className={withTime?'admin-schedule-date-time':undefined}>
      <AdminCalendarPicker label={withTime?`${label} · ${ui.date}`:label}
        placeholder={ui.select} value={date?[date]:[]} lang={lang} disabled={disabled}
        invalid={!!error} describedBy={error?errorId:undefined}
        onChange={([next])=>onChange(withTime?`${next}T${time}`:next)}/>
      {withTime&&<input type="text" aria-label={`${label} · ${ui.time}`} placeholder="HH:mm"
        aria-invalid={!!error||undefined} aria-describedby={error?errorId:undefined}
        required={required} maxLength={5} value={time} disabled={disabled}
        onChange={event=>onChange(`${date}T${event.target.value}`)}/>}
    </div>
    {withTime&&!required&&value&&<div><AdminRowAction disabled={disabled} onClick={()=>onChange('')}>{ui.clear}</AdminRowAction></div>}
    {error&&<small id={errorId} role="alert">{error}</small>}
  </AdminField>;
}

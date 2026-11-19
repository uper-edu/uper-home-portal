import {useId,useState} from 'react';
import {AdminField,AdminFieldLabel} from '../AdminForm';
import {AdminRowAction} from './AdminListControl';
import {AdminCalendarPicker} from './AdminCalendarPicker';
import type {CrmLanguage} from '../../utils/crmLanguage';

const labels = {
  zh:{date:'日期',time:'时间',select:'选择日期',clear:'清除日期与时间',clearDate:'清除日期'},
  en:{date:'Date',time:'Time',select:'Select date',clear:'Clear date and time',clearDate:'Clear date'},
  id:{date:'Tanggal',time:'Waktu',select:'Pilih tanggal',clear:'Hapus tanggal dan waktu',clearDate:'Hapus tanggal'},
};

export const completeAdminDateTime = (value:string) =>
  /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);

export function AdminDateField({label,value:controlled,defaultValue="",name,onChange,lang,withTime=false,required=false,disabled=false,clearable=withTime&&!required,error}:{
  label:string; value?:string; defaultValue?:string; name?:string; onChange?:(value:string)=>void; lang:CrmLanguage;
  withTime?:boolean; required?:boolean; disabled?:boolean; clearable?:boolean; error?:string;
}){
  const [internal,setInternal]=useState(defaultValue);
  const value=controlled??internal;
  const change=(next:string)=>{
    if(controlled===undefined)setInternal(next);
    onChange?.(next);
  };
  const errorId=useId();
  const ui=labels[lang];
  const [date='',time='']=value.split('T');
  return <AdminField as="div" role="group" aria-label={label}>
    <AdminFieldLabel required={required}>{label}</AdminFieldLabel>
    {name&&<input type="hidden" name={name} value={value} disabled={disabled}/>}
    <div className={withTime?'admin-schedule-date-time':undefined}>
      <AdminCalendarPicker label={withTime?`${label} · ${ui.date}`:label}
        placeholder={ui.select} value={date?[date]:[]} lang={lang} disabled={disabled}
        invalid={!!error} describedBy={error?errorId:undefined}
        onChange={([next])=>change(withTime?`${next}T${time}`:next)}/>
      {withTime&&<input type="text" aria-label={`${label} · ${ui.time}`} placeholder="HH:mm"
        aria-invalid={!!error||undefined} aria-describedby={error?errorId:undefined}
        required={required} maxLength={5} value={time} disabled={disabled}
        onChange={event=>change(`${date}T${event.target.value}`)}/>}
    </div>
    {clearable&&value&&<div><AdminRowAction disabled={disabled} onClick={()=>change('')}>{withTime?ui.clear:ui.clearDate}</AdminRowAction></div>}
    {error&&<small id={errorId} role="alert">{error}</small>}
  </AdminField>;
}

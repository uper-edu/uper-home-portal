import {useId,useState,type ComponentProps} from 'react';
import {AdminField,AdminFieldLabel} from '../AdminForm';
import {AdminRowAction} from './AdminListControl';
import {AdminCalendarPicker} from './AdminCalendarPicker';
import {AdminSingleSelect} from './AdminSingleSelect';
import {useAdminTheme} from '../../utils/adminPreferences';
import type {CrmLanguage} from '../../utils/crmLanguage';

const labels = {
  zh:{date:'日期',hour:'小时',minute:'分钟',select:'选择日期',clear:'清除日期与时间',clearDate:'清除日期'},
  en:{date:'Date',hour:'Hour',minute:'Minute',select:'Select date',clear:'Clear date and time',clearDate:'Clear date'},
  id:{date:'Tanggal',hour:'Jam',minute:'Menit',select:'Pilih tanggal',clear:'Hapus tanggal dan waktu',clearDate:'Hapus tanggal'},
};
const timeChoices=(count:number)=>Array.from({length:count},(_,index)=>{
  const value=String(index).padStart(2,'0');
  return {value,label:value};
});
const hours=timeChoices(24);
const minutes=timeChoices(60);

export const completeAdminDateTime = (value:string) =>
  /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);

type TimeProps={
  label:string; value:string; onChange:(value:string)=>void; lang:CrmLanguage;
  required?:boolean; disabled?:boolean; invalid?:boolean; describedBy?:string;
};
function AdminTimePicker({label,value,onChange,lang,required,disabled,invalid,describedBy}:TimeProps){
  const {isLight}=useAdminTheme();
  const id=useId();
  const ui=labels[lang];
  const [hour='',minute='']=value.split(':');
  return <div className="admin-schedule-time">
    <AdminSingleSelect controlId={id+'-hour'} label={`${label} · ${ui.hour}`} emptyLabel={ui.hour}
      lang={lang} isLight={isLight} options={hours} value={hour} onChange={next=>onChange(`${next}:${minute}`)}
      required={required} disabled={disabled} invalid={invalid} describedBy={describedBy}/>
    <AdminSingleSelect controlId={id+'-minute'} label={`${label} · ${ui.minute}`} emptyLabel={ui.minute}
      lang={lang} isLight={isLight} options={minutes} value={minute} onChange={next=>onChange(`${hour}:${next}`)}
      required={required} disabled={disabled} invalid={invalid} describedBy={describedBy}/>
  </div>;
}

export function AdminTimeField(props:TimeProps){
  return <AdminField as="div" role="group" aria-label={props.label}>
    <AdminFieldLabel required={props.required}>{props.label}</AdminFieldLabel>
    <AdminTimePicker {...props}/>
  </AdminField>;
}

type CalendarOptions=Pick<ComponentProps<typeof AdminCalendarPicker>,'anchorDate'|'isDateSelectable'>;
export function AdminDateField({label,value:controlled,defaultValue="",name,onChange,lang,withTime=false,required=false,disabled=false,clearable=withTime&&!required,error,calendar}:{
  label:string; value?:string; defaultValue?:string; name?:string; onChange?:(value:string)=>void; lang:CrmLanguage;
  withTime?:boolean; required?:boolean; disabled?:boolean; clearable?:boolean; error?:string;
  calendar?:CalendarOptions;
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
        {...calendar}
        onChange={([next])=>change(withTime?`${next}T${time}`:next)}/>
      {withTime&&<AdminTimePicker label={label} value={time} onChange={next=>change(`${date}T${next}`)}
        lang={lang} required={required} disabled={disabled} invalid={!!error} describedBy={error?errorId:undefined}/>}
    </div>
    {clearable&&value&&<div><AdminRowAction disabled={disabled} onClick={()=>change('')}>{withTime?ui.clear:ui.clearDate}</AdminRowAction></div>}
    {error&&<small id={errorId} role="alert">{error}</small>}
  </AdminField>;
}

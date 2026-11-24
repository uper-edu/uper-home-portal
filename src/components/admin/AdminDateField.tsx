import {useId,useState} from 'react';
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

export function AdminDateField({label,value:controlled,defaultValue="",name,onChange,lang,withTime=false,required=false,disabled=false,clearable=withTime&&!required,error}:{
  label:string; value?:string; defaultValue?:string; name?:string; onChange?:(value:string)=>void; lang:CrmLanguage;
  withTime?:boolean; required?:boolean; disabled?:boolean; clearable?:boolean; error?:string;
}){
  const {isLight}=useAdminTheme();
  const [internal,setInternal]=useState(defaultValue);
  const value=controlled??internal;
  const change=(next:string)=>{
    if(controlled===undefined)setInternal(next);
    onChange?.(next);
  };
  const errorId=useId();
  const ui=labels[lang];
  const [date='',time='']=value.split('T');
  const [hour='',minute='']=time.split(':');
  return <AdminField as="div" role="group" aria-label={label}>
    <AdminFieldLabel required={required}>{label}</AdminFieldLabel>
    {name&&<input type="hidden" name={name} value={value} disabled={disabled}/>}
    <div className={withTime?'admin-schedule-date-time':undefined}>
      <AdminCalendarPicker label={withTime?`${label} · ${ui.date}`:label}
        placeholder={ui.select} value={date?[date]:[]} lang={lang} disabled={disabled}
        invalid={!!error} describedBy={error?errorId:undefined}
        onChange={([next])=>change(withTime?`${next}T${time}`:next)}/>
      {withTime&&<div className="admin-schedule-time">
        <AdminSingleSelect controlId={errorId+'-hour'} label={`${label} · ${ui.hour}`} emptyLabel={ui.hour}
          lang={lang} isLight={isLight} options={hours} value={hour} onChange={next=>change(`${date}T${next}:${minute}`)}
          required={required} disabled={disabled} invalid={!!error} describedBy={error?errorId:undefined}/>
        <AdminSingleSelect controlId={errorId+'-minute'} label={`${label} · ${ui.minute}`} emptyLabel={ui.minute}
          lang={lang} isLight={isLight} options={minutes} value={minute} onChange={next=>change(`${date}T${hour}:${next}`)}
          required={required} disabled={disabled} invalid={!!error} describedBy={error?errorId:undefined}/>
      </div>}
    </div>
    {clearable&&value&&<div><AdminRowAction disabled={disabled} onClick={()=>change('')}>{withTime?ui.clear:ui.clearDate}</AdminRowAction></div>}
    {error&&<small id={errorId} role="alert">{error}</small>}
  </AdminField>;
}

import {useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode} from 'react';
import {CalendarDays, Check, ChevronLeft, ChevronRight, Circle, Plus, X} from 'lucide-react';
import type {CrmLanguage} from '../../utils/crmLanguage';

const dayMs = 86_400_000;
const dayKey = (date: Date) => date.toISOString().slice(0, 10);
const readDay = (day: string) => new Date(day + 'T00:00:00Z');
const dayOffset = (day: string, offset: number) => dayKey(new Date(readDay(day).getTime() + offset * dayMs));
const weekday = (day: string) => (readDay(day).getUTCDay() + 6) % 7;
const monthStart = (day: string) => day.slice(0, 7) + '-01';

function moveMonth(day: string, offset: number) {
  const first = readDay(monthStart(day));
  first.setUTCMonth(first.getUTCMonth() + offset + 1, 0);
  const last = first.getUTCDate();
  first.setUTCDate(Math.min(last, readDay(day).getUTCDate()));
  return dayKey(first);
}

const calendarLocale = {zh:'zh-CN',en:'en-GB',id:'id-ID'};
const copy = {
  zh:{previous:'上个月',next:'下个月',done:'完成',selected:(count:number)=>`已选 ${count} 天`},
  en:{previous:'Previous month',next:'Next month',done:'Done',selected:(count:number)=>`${count} selected`},
  id:{previous:'Bulan sebelumnya',next:'Bulan berikutnya',done:'Selesai',selected:(count:number)=>`${count} tanggal dipilih`},
};

const dayMarkIcons={info:Circle,warning:X,success:Plus};
export type AdminCalendarDayMark = {tone:keyof typeof dayMarkIcons;label:string};

type Props = {
  label: string;
  placeholder: string;
  value: readonly string[];
  onChange: (value: string[]) => void;
  lang: CrmLanguage;
  multiple?: boolean;
  anchorDate?: string;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
  dayMarks?: (selection: readonly string[]) => ReadonlyMap<string,AdminCalendarDayMark>;
  isDateSelectable?: (day: string, mark: AdminCalendarDayMark|undefined) => boolean;
  legend?: readonly AdminCalendarDayMark[];
  selectionPreview?: (selection: readonly string[]) => ReactNode;
};

export function AdminCalendarPicker({label,placeholder,value,onChange,lang,multiple=false,anchorDate,disabled,invalid,describedBy,dayMarks,isDateSelectable,legend,selectionPreview}:Props) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const focusDay = useRef(false);
  const [active,setActive] = useState('');
  const [selected,setSelected] = useState<string[]>([]);
  const month = active ? monthStart(active) : '';
  const marks = month&&dayMarks ? dayMarks(selected) : undefined;
  const canSelect = (day:string) => !isDateSelectable||isDateSelectable(day,marks?.get(day))||
    (multiple&&selected.includes(day));
  const ui = copy[lang];
  const format = (day:string, options:Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(calendarLocale[lang],{...options,timeZone:'UTC'}).format(readDay(day));
  const focusActiveDay = () => panel.current?.querySelector<HTMLButtonElement>('button[data-current-day]')?.focus({preventScroll:true});

  useLayoutEffect(()=>{
    if(!focusDay.current)return;
    focusDay.current=false;
    focusActiveDay();
  },[active]);
  useEffect(()=>{
    if(disabled&&panel.current?.matches(':popover-open'))panel.current.hidePopover();
  },[disabled]);

  function position() {
    const button = trigger.current?.getBoundingClientRect();
    const popup = panel.current;
    if(!button||!popup)return;
    const {width,height} = popup.getBoundingClientRect();
    const left = Math.max(8,Math.min(button.left,window.innerWidth-width-8));
    const above = button.top-height-6;
    const below = button.bottom+6;
    const top = below+height<=window.innerHeight-8 ? below : Math.max(8,above);
    Object.assign(popup.style,{left:`${left}px`,top:`${top}px`});
  }

  function close() {
    panel.current?.hidePopover();
    trigger.current?.focus({preventScroll:true});
  }

  function select(day:string) {
    if(!canSelect(day))return;
    setActive(day);
    if(!multiple){
      onChange([day]);
      close();
      return;
    }
    setSelected(dates=>dates.includes(day)?dates.filter(date=>date!==day):[...dates,day].sort());
  }

  function navigate(event:KeyboardEvent<HTMLButtonElement>,day:string) {
    let next:string;
    switch(event.key){
      case 'ArrowLeft': next=dayOffset(day,-1); break;
      case 'ArrowRight': next=dayOffset(day,1); break;
      case 'ArrowUp': next=dayOffset(day,-7); break;
      case 'ArrowDown': next=dayOffset(day,7); break;
      case 'Home': next=dayOffset(day,-weekday(day)); break;
      case 'End': next=dayOffset(day,6-weekday(day)); break;
      case 'PageUp': next=moveMonth(day,event.shiftKey?-12:-1); break;
      case 'PageDown': next=moveMonth(day,event.shiftKey?12:1); break;
      default: return;
    }
    event.preventDefault();
    if(next===active)return;
    focusDay.current=true;
    setActive(next);
  }

  return <>
    <button ref={trigger} type="button" className="admin-calendar-trigger" onClick={()=>{
      if(!panel.current?.matches(':popover-open')){
        setSelected([...value]);
        setActive(value[0]||anchorDate||dayKey(new Date()));
      }
    }} popoverTarget={id} disabled={disabled} aria-label={`${label} · ${multiple ? ui.selected(value.length) : value[0] || placeholder}`}
      aria-haspopup="dialog" aria-invalid={invalid||undefined} aria-describedby={describedBy}>
      <CalendarDays size={16} aria-hidden="true"/>
      {multiple?placeholder:value[0]||placeholder}
    </button>
    <div id={id} ref={panel} popover="auto" className="admin-calendar-popup" role="dialog" aria-label={label}
      onToggle={event=>{
        if(!event.currentTarget.matches(':popover-open'))return;
        position();
        focusActiveDay();
      }}
      onKeyDown={event=>{
        if(event.key!=='Escape')return;
        event.preventDefault();
        event.stopPropagation();
        close();
      }}>
      {month&&<>
        <header className="admin-calendar-month">
          <button type="button" className="admin-compact-action" aria-label={ui.previous}
            onClick={()=>setActive(moveMonth(active,-1))}><ChevronLeft size={18} aria-hidden="true"/></button>
          <strong id={id+'-month'} aria-live="polite">{format(month,{month:'long',year:'numeric'})}</strong>
          <button type="button" className="admin-compact-action" aria-label={ui.next}
            onClick={()=>setActive(moveMonth(active,1))}><ChevronRight size={18} aria-hidden="true"/></button>
        </header>
        <table role="grid" aria-labelledby={id+'-month'} aria-multiselectable={multiple||undefined}>
          <thead><tr>{Array.from({length:7},(_,index)=>{
            const day=dayOffset('2024-01-01',index);
            return <th key={day} scope="col" abbr={format(day,{weekday:'long'})}>{format(day,{weekday:'short'})}</th>;
          })}</tr></thead>
          <tbody>{Array.from({length:6},(_,week)=><tr key={week}>
            {Array.from({length:7},(_,index)=>{
              const day=dayOffset(month,week*7+index-weekday(month));
              const checked=selected.includes(day);
              const mark=marks?.get(day);
              const MarkIcon=mark&&dayMarkIcons[mark.tone];
              const dateLabel=format(day,{dateStyle:'full'});
              return <td key={day} aria-selected={checked}>
                <button type="button" tabIndex={day===active?0:-1} data-current-day={day===active||undefined}
                  data-adjacent={monthStart(day)!==month||undefined} data-mark={mark?.tone}
                  aria-disabled={!canSelect(day)||undefined}
                  aria-label={mark?`${dateLabel} · ${mark.label}`:dateLabel} title={mark?.label}
                  onKeyDown={event=>navigate(event,day)} onClick={()=>select(day)}>
                  {readDay(day).getUTCDate()}
                  {MarkIcon&&<MarkIcon size={11} className="admin-calendar-mark" aria-hidden="true"/>}
                  {checked&&mark?.tone!=='warning'&&<Check size={10} className="admin-calendar-check" aria-hidden="true"/>}
                </button>
              </td>;
            })}
          </tr>)}</tbody>
        </table>
        {legend&&<ul className="admin-calendar-legend">
          {legend.map(mark=>{
            const Icon=dayMarkIcons[mark.tone];
            return <li key={mark.label} data-mark={mark.tone}><Icon size={13} aria-hidden="true"/>{mark.label}</li>;
          })}
        </ul>}
        {multiple&&<footer className="admin-calendar-footer">
          <div className="admin-calendar-footer-summary">
            <span role="status">{ui.selected(selected.length)}</span>
            {selectionPreview&&<span className="admin-calendar-preview" aria-live="polite">{selectionPreview(selected)}</span>}
          </div>
          <button type="button" className="crm-work-button" data-primary onClick={()=>{onChange(selected);close();}}>{ui.done}</button>
        </footer>}
      </>}
    </div>
  </>;
}

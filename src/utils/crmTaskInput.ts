import {validateLocalInstant} from './crmOperatingTime';
import {calendarSample} from './workCalendar';
export type TaskInput = {command:string;action:string;purpose:string;reason:string;timing:string;date:string;originalDate?:string};
/** Input is interpreted in the displayed viewer timezone; stored deadlines remain instants. */
export function prepareTaskInput(input:TaskInput, timezone:string, now=Date.now()):{error?:string;field?:string;dueAt?:string} {
  if(['create','replace','create_request','edit'].includes(input.command)){
    if(!input.action.trim())return {error:'Enter the specific task action',field:'action'};
    if(input.command==='replace'&&!input.purpose.trim())return {error:'Enter the task purpose',field:'purpose'};
  }
  if(['create','replace'].includes(input.command)&&!['response','appointment','review'].includes(input.timing))return {error:'Choose what the task time means',field:'timing'};
  let dueAt:string|undefined;
  if(['create','replace','reschedule'].includes(input.command)||(input.command==='edit'&&input.date!==input.originalDate)){
    if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(input.date))return {error:'Choose a task date and time',field:'date'};
    try{dueAt=validateLocalInstant(input.date,calendarSample(input.date.slice(0,10),input.date.slice(11),timezone),timezone).toISOString();}catch{return {error:'Choose a task date and time',field:'date'};}
    if(!Number.isFinite(Date.parse(dueAt))||Date.parse(dueAt)<=now)return {error:'Choose a future time in the operating timezone',field:'date'};
  }
  if((!['create','create_request','edit'].includes(input.command)||(input.command==='edit'&&input.date!==input.originalDate))&&!input.reason.trim())return {error:'Enter the task reason or evidence',field:'reason'};
  return {dueAt};
}

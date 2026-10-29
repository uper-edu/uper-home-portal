import {validateHskAttempt} from '../data/hskAssessment';
/** Completion time is submit metadata; every other validated answer/telemetry field remains protected. */
export function sameHskSubmission(a:unknown,b:unknown){
 const content=(value:unknown)=>{const {completedAt,...rest}=validateHskAttempt(value);return JSON.stringify(rest);};
 return content(a)===content(b);
}

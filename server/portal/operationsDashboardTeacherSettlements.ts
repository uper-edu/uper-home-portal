import {randomUUID} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {dashboardLevels,dashboardTeachingFormats,type DashboardTeachingFormat} from '../../src/utils/crmOperationsDashboard.ts';
import {teacherSettlementMonth,type TeacherSettlement,type TeacherSettlementDraft,type TeacherSettlementKind,
  type TeacherSettlementTarget,type TeacherRateQuote,type TeacherServicePeriod} from '../../src/utils/crmTeacherSettlements.ts';
import {facultyDateValid,facultyEffectiveDate,facultyRateOn} from '../../src/utils/crmFaculty.ts';
import {readFacultyRates} from './faculty.ts';
import type {trafficEnvironment} from './operationsDashboardTraffic.ts';
import {invalid} from './trustWorkflow.ts';

type Environment=ReturnType<typeof trafficEnvironment>;
type Client={query:(sql:string,params:unknown[])=>Promise<{rows:any[]}>};
const prefix=(env:Environment)=>'dashboard_teacher_settlement_v1:'+env+':';
const monthPrefix=(env:Environment,month:string)=>'dashboard_teacher_settlement_month_v1:'+env+':'+month+':';
const numberPattern=/^[A-Z0-9][A-Z0-9./_-]{0,63}$/;
const referencePattern=/^[A-Za-z0-9_-]{1,64}$/;
const object=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
const trimmed=(value:unknown)=>typeof value==='string'?value.trim():'';
function monthValue(month:string){
  if(!teacherSettlementMonth.test(month))invalid('teacher_settlement_invalid');
  return month;
}
function readRecord(value:unknown):TeacherSettlement|null{
  const row=object(typeof value==='string'?JSON.parse(value):value);
  return typeof row.revision==='string'?row as TeacherSettlement:null;
}

export async function readTeacherSettlements(db:Client,env:Environment,month:string){
  const key=monthPrefix(env,monthValue(month));
  const {rows}=await db.query("SELECT value FROM portal_settings WHERE id LIKE :p1 ESCAPE '=' ORDER BY id",
    [key.replaceAll('_','=_')+'%']);
  return {month,records:rows.map(row=>readRecord(row.value)).filter(record=>record!==null)};
}

type TargetRow={id:string;level:string;format:DashboardTeachingFormat;teacher:string|null;first_lesson:string|null;batch_number:string|null;
  period:string|null;minutes:string|null;teacher_id:string|null};
function target(kind:TeacherSettlementKind,row:TargetRow):TeacherSettlementTarget|null{
  if(!dashboardLevels.some(level=>level===row.level)||!dashboardTeachingFormats.includes(row.format)||
    (kind==='appointment')!==(row.format==='one-on-one'))return null;
  return {kind,referenceId:row.id,level:row.level,format:row.format,teacher:row.teacher??'',
    firstLesson:row.first_lesson??'',batchNumber:Number(row.batch_number)||0,period:row.period??undefined,
    minutes:Number(row.minutes)||0,...(row.teacher_id?{teacherId:row.teacher_id}:{})};
}
export async function teacherSettlementTargets(db:Client,kind:TeacherSettlementKind,search:string,exact=false){
  if((kind!=='class'&&kind!=='appointment')||search.length>100)invalid('teacher_settlement_invalid');
  const flags=[search,Number(exact)];
  const {rows}=kind==='class'
    ?await db.query(`SELECT id, data->>'$.level' AS level, data->>'$.format' AS format, data->>'$.teacher' AS teacher,
        DATE_FORMAT(first_lesson_at + INTERVAL 7 HOUR,'%Y-%m-%d') AS first_lesson, data->>'$.batchNumber' AS batch_number,
        data->>'$.period' AS period,data->>'$.minutes' AS minutes,data->>'$.teacherId' AS teacher_id
      FROM enrollment_classes WHERE state IN ('published','cancelled') AND data->>'$.format' IN ('standard','small')
        AND ((:p2=1 AND BINARY id=BINARY :p1) OR (:p2=0 AND (:p1='' OR LOCATE(:p1,id)>0 OR LOCATE(:p1,data->>'$.teacher')>0)))
      ORDER BY first_lesson_at DESC,id LIMIT 30`,flags)
    :await db.query(`SELECT id, criteria->>'$.level' AS level, criteria->>'$.format' AS format,
        criteria->>'$.appointment.confirmation.teacher' AS teacher,
        criteria->>'$.appointment.confirmation.teacherId' AS teacher_id,
        DATE_FORMAT(DATE_ADD(STR_TO_DATE(LEFT(criteria->>'$.appointment.confirmation.firstLessonAt',19),'%Y-%m-%dT%H:%i:%s'),
          INTERVAL 7 HOUR),'%Y-%m-%d') AS first_lesson, NULL AS batch_number,NULL AS period,
        criteria->>'$.appointment.minutes' AS minutes
      FROM enrollment_demands WHERE criteria->>'$.format'='one-on-one' AND JSON_TYPE(criteria->'$.appointment.confirmation')='OBJECT'
        AND ((:p2=1 AND BINARY id=BINARY :p1) OR (:p2=0 AND (:p1='' OR LOCATE(:p1,id)>0
          OR LOCATE(:p1,criteria->>'$.appointment.confirmation.teacher')>0)))
      ORDER BY criteria->>'$.appointment.confirmation.firstLessonAt' DESC,id LIMIT 30`,flags);
  return rows.map(row=>target(kind,row)).filter(row=>row!==null);
}

function validServiceDates(from:string,to:string){
  return facultyDateValid(from)&&facultyDateValid(to)&&from<=to;
}
async function resolveTeacherRate(db:Client,target:TeacherSettlementTarget,from:string,to:string,lock=false):Promise<TeacherRateQuote>{
  if(!validServiceDates(from,to))invalid('teacher_settlement_invalid');
  if(!target.teacherId)return {kind:'missing'};
  const {terms,revision}=await readFacultyRates(db,target.teacherId,lock);
  const first=facultyRateOn(terms,from);
  if(first!==facultyRateOn(terms,to))return {kind:'split'};
  if(!first)return {kind:'missing'};
  const effective=facultyEffectiveDate(first);
  if(first.kind==='monthly')return {kind:'monthly',effective,revision};
  if(first.amountMinor===null||first.currency===null)return {kind:'missing'};
  return {kind:'lesson',currency:first.currency,amountMinor:first.amountMinor,effective,revision};
}
export async function quoteTeacherSettlement(db:Client,kind:TeacherSettlementKind,id:string,from:string,to:string){
  if(!referencePattern.test(id))invalid('teacher_settlement_invalid');
  const [target]=await teacherSettlementTargets(db,kind,id,true);
  if(!target)invalid('teacher_settlement_target',404);
  return resolveTeacherRate(db,target,from,to);
}

function draft(input:unknown):TeacherSettlementDraft{
  const value=object(input),number=trimmed(value.number).toUpperCase(),month=monthValue(trimmed(value.month));
  const reason=trimmed(value.reason),revision=value.revision;
  if(!numberPattern.test(number)||(revision!==null&&(typeof revision!=='string'||revision.length!==36))||
    reason.length>500||!Array.isArray(value.lines)||value.lines.length===0||value.lines.length>50)
    invalid('teacher_settlement_invalid');
  const positiveInteger=(value:unknown,max:number):value is number=>
    typeof value==='number'&&Number.isSafeInteger(value)&&value>0&&value<=max;
  const lines=value.lines.map((raw):TeacherSettlementDraft['lines'][number]=>{
    const {kind,referenceId,lessons,lessonFee,service:rawService}=object(raw);
    if((kind!=='class'&&kind!=='appointment')||typeof referenceId!=='string'||!referencePattern.test(referenceId)||
      !positiveInteger(lessons,10_000)||(rawService===undefined?!positiveInteger(lessonFee,100_000_000):lessonFee!==0))
      invalid('teacher_settlement_invalid');
    if(rawService===undefined)return {kind,referenceId,lessons,lessonFee:lessonFee as number};
    const {rateRevision,convertedIDR}=object(rawService);
    const {from,to,basis}=Object.fromEntries(['from','to','basis'].map(key=>[key,trimmed(object(rawService)[key])]));
    if(!validServiceDates(from,to)||!positiveInteger(rateRevision,Number.MAX_SAFE_INTEGER)||
      (convertedIDR!==undefined&&(!positiveInteger(convertedIDR,1_000_000_000_000)||!basis||basis.length>500))||
      (convertedIDR===undefined&&basis))invalid('teacher_settlement_invalid');
    const service:TeacherServicePeriod={from,to,rateRevision,...(convertedIDR===undefined?{}:{convertedIDR:convertedIDR as number,basis})};
    return {kind,referenceId,lessons,lessonFee:0,service};
  });
  for(const [index,line] of lines.entries()){
    if(lines.slice(0,index).some(prior=>prior.kind===line.kind&&prior.referenceId===line.referenceId&&
      (!prior.service||!line.service||prior.service.from<=line.service.to&&line.service.from<=prior.service.to)))
      invalid('teacher_settlement_lines_duplicate');
  }
  return {number,month,revision:typeof revision==='string'?revision:null,reason,lines};
}

// The caller owns the transaction. The primary key serializes submissions sharing a settlement number.
export async function saveTeacherSettlement(db:Client,env:Environment,input:unknown,actorId:string,now=Date.now()){
  const incoming=draft(input);
  const {number,month,reason}=incoming,key=prefix(env)+number;
  if(incoming.revision&&!reason)invalid('teacher_settlement_reason');
  await db.query('INSERT INTO portal_settings(id,value) VALUES(:p1,:p2) ON DUPLICATE KEY UPDATE id=id',[key,{}]);
  const {rows:[stored]}=await db.query('SELECT value FROM portal_settings WHERE id=:p1 FOR UPDATE',[key]);
  const prior=readRecord(stored.value);
  const existingLines=prior?.lines.map(({target:{kind,referenceId},lessons,lessonFee,service})=>
    ({kind,referenceId,lessons,lessonFee,...(service?{service}:{})}));
  const same=prior&&prior.month===month&&(incoming.revision===null||prior.reason===reason)&&
    isDeepStrictEqual(existingLines,incoming.lines);
  if(same)return prior;
  if(incoming.revision!==(prior?.revision??null))
    invalid(incoming.revision===null?'teacher_settlement_duplicate':'teacher_settlement_conflict',409);
  const targets=new Map(prior?.lines.map(line=>[line.target.kind+':'+line.target.referenceId,line.target]));
  const lines:TeacherSettlement['lines']=[];
  for(const {kind,referenceId,lessons,lessonFee,service} of incoming.lines){
    const ref=kind+':'+referenceId;
    const selected=targets.get(ref)??(await teacherSettlementTargets(db,kind,referenceId,true))[0];
    if(!selected)invalid('teacher_settlement_target');
    if(!selected.teacher.trim())invalid('teacher_settlement_teacher_missing');
    if(!selected.teacherId&&!service){lines.push({target:selected,lessons,lessonFee});continue;}
    if(!selected.teacherId||!service)invalid('teacher_settlement_rate_required');
    const historical=prior?.lines.find(line=>line.target.kind===kind&&line.target.referenceId===referenceId&&
      line.service?.from===service.from&&line.service.to===service.to)?.rate;
    const rate=historical??await resolveTeacherRate(db,selected,service.from,service.to,true);
    if(rate.kind!=='lesson'&&rate.kind!=='monthly')invalid('teacher_settlement_rate_'+rate.kind,409);
    if(rate.revision!==service.rateRevision)invalid('teacher_settlement_rate_changed',409);
    if((rate.kind==='lesson'&&rate.currency==='CNY')!==(service.convertedIDR!==undefined))
      invalid('teacher_settlement_invalid');
    lines.push({target:selected,lessons,lessonFee,service,rate});
  }
  const revision=randomUUID();
  const next={number,month,lines,reason,revision,updatedAt:new Date(now).toISOString()};
  await db.query('UPDATE portal_settings SET value=:p2 WHERE id=:p1',[key,next]);
  if(prior&&prior.month!==month)await db.query('DELETE FROM portal_settings WHERE id=:p1',[monthPrefix(env,prior.month)+number]);
  await db.query('INSERT INTO portal_settings(id,value) VALUES(:p1,:p2) ON DUPLICATE KEY UPDATE value=:p2',
    [monthPrefix(env,month)+number,next]);
  await db.query('INSERT INTO portal_settings(id,value) VALUES(:p1,:p2)',
    ['dashboard_teacher_settlement_revision_v1:'+env+':'+revision,{actorId,before:prior,after:next}]);
  await db.query('INSERT INTO portal_audit(actor,action,data) VALUES(:p1,:p2,:p3)',
    [actorId,'dashboard.teacher-settlement.save',{number,month,revision}]);
  return next;
}

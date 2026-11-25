import {createHash} from 'node:crypto';
import {dashboardDate,dashboardDay,dashboardLevels,dashboardReportingDates,dashboardTeachingFormats,
  type DashboardEconomicsRow,type DashboardTeaching,type DashboardTeachingFormat,type DashboardTeachingRow} from '../../src/utils/crmOperationsDashboard.ts';
import type {trafficEnvironment} from './operationsDashboardTraffic.ts';

type Environment=ReturnType<typeof trafficEnvironment>;
type Client={query:(sql:string,params?:unknown[])=>Promise<{rows:any[]}>};
type SourceBinding={kind:'class'|'appointment';referenceId:string};
type VerifiedBinding=SourceBinding&{level:string;format:DashboardTeachingFormat};
type FinanceFact={currency:string;costedLessons:number;teacherCost:number|null;revenue:number|null;directCost:number|null};
type TeachingFact=Pick<DashboardTeachingRow,'lessons'|'minutes'|'rosterLessons'|'expected'|'recorded'|'present'>;
type ReportDay=TeachingFact&{date:string;finance:FinanceFact|null};
type StoredTeachingDay=Omit<ReportDay,'date'>&VerifiedBinding&{extractedAt:string};

function object(value:unknown,field:string){
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid teaching report field: '+field);
  return value as Record<string,unknown>;
}
function text(value:unknown,pattern:RegExp,field:string){
  if(typeof value!=='string'||!pattern.test(value))throw Error('Invalid teaching report field: '+field);
  return value;
}
function count(value:unknown,max:number,field:string){
  if(typeof value!=='number'||!Number.isSafeInteger(value)||value<0||value>max)
    throw Error('Invalid teaching report count: '+field);
  return value;
}
function money(value:unknown,field:string,negative=false){
  if(value===null||value===undefined)return null;
  // The source supplies amounts in whole IDR. Downstream never estimates from reservations.
  if(negative&&typeof value==='number'&&value<0)return -count(-value,1_000_000_000_000,field);
  return count(value,1_000_000_000_000,field);
}
const datePattern=/^\d{4}-\d{2}-\d{2}$/;
const idPattern=/^[A-Za-z0-9_-]{1,64}$/;
const blank=():TeachingFact=>({lessons:0,minutes:0,rosterLessons:0,expected:0,recorded:0,present:0});

export function parseDashboardTeaching(input:unknown,environment:Environment,now=Date.now()){
  const report=object(input,'report');
  if(report.version!==1||report.environment!==environment||report.timeZone!=='Asia/Jakarta')
    throw Error('Use a version 1 teaching report for the requested environment in Asia/Jakarta');
  const rawBinding=object(report.binding,'binding');
  if(rawBinding.kind!=='class'&&rawBinding.kind!=='appointment')throw Error('Use a class or appointment binding');
  const binding:SourceBinding={kind:rawBinding.kind,referenceId:text(rawBinding.referenceId,idPattern,'referenceId')};
  const extractedAt=text(report.extractedAt,/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/,'extractedAt');
  const extracted=Date.parse(extractedAt);
  if(!Number.isFinite(extracted)||new Date(extracted).toISOString()!==extractedAt||extracted>now)
    throw Error('Invalid teaching report extraction timestamp');
  const dates=dashboardReportingDates(text(report.from,datePattern,'from'),text(report.to,datePattern,'to'),extracted);
  if(!Array.isArray(report.days)||report.days.length!==dates.length)throw Error('Provide every date in the teaching report');
  const daily=new Map<string,ReportDay>();
  const lessons=new Set<string>();
  for(const rawDay of report.days){
    const day=object(rawDay,'day');
    const date=text(day.date,datePattern,'day date');
    if(daily.has(date)||!Array.isArray(day.lessons))throw Error('Duplicate teaching date or invalid lessons');
    const result:ReportDay={date,...blank(),finance:null};
    for(const rawLesson of day.lessons){
      const lesson=object(rawLesson,'lesson');
      const id=text(lesson.id,idPattern,'lesson id');
      if(lessons.has(id))throw Error('Duplicate delivered lesson');
      lessons.add(id);
      const minutes=count(lesson.minutes,1440,'lesson minutes');
      if(!minutes)throw Error('Delivered lessons require positive minutes');
      result.lessons++;
      result.minutes+=minutes;
      if(lesson.attendance!==null&&lesson.attendance!==undefined){
        const attendance=object(lesson.attendance,'attendance');
        const expected=count(attendance.expected,10000,'eligible learner lessons');
        const recorded=count(attendance.recorded,expected,'registered learner lessons');
        const present=count(attendance.present,recorded,'present learner lessons');
        result.rosterLessons++;
        result.expected+=expected;
        result.recorded+=recorded;
        result.present+=present;
      }
    }
    if(day.finance!==null&&day.finance!==undefined){
      const finance=object(day.finance,'finance');
      const costedLessons=count(finance.costedLessons,result.lessons,'costed lessons');
      const teacherCost=money(finance.teacherCost,'teacher cost'),revenue=money(finance.revenue,'recognized revenue',true);
      const directCost=money(finance.directCost,'all direct costs');
      if(finance.currency!=='IDR'||(costedLessons>0)!==(teacherCost!==null)||
        (!result.lessons&&(revenue!==null||directCost!==null))||
        (directCost!==null&&teacherCost!==null&&directCost<teacherCost))
        throw Error('Teaching finance requires approved IDR amounts and matching delivered lessons');
      result.finance={currency:'IDR',costedLessons,teacherCost,revenue,directCost};
    }
    daily.set(date,result);
  }
  const days=dates.map(date=>{
    const day=daily.get(date);
    if(!day)throw Error('Provide every date in the teaching report');
    return day;
  });
  return {environment,binding,extractedAt,days};
}

const prefix=(environment:Environment,date:string)=>`dashboard_teaching_v1:${environment}:${date}:`;
export async function storeDashboardTeaching(db:Client,report:ReturnType<typeof parseDashboardTeaching>){
  const {environment,binding,days,extractedAt}=report;
  const {rows:[classInfo]}=binding.kind==='class'
    ?await db.query("SELECT data->>'$.level' AS level,data->>'$.format' AS format FROM enrollment_classes WHERE id=:p1 AND state IN ('published','cancelled')",[binding.referenceId])
    :await db.query(`SELECT criteria->>'$.level' AS level,criteria->>'$.format' AS format FROM enrollment_demands
      WHERE id=:p1 AND criteria->>'$.format'='one-on-one' AND JSON_TYPE(JSON_EXTRACT(criteria,'$.appointment.confirmation'))='OBJECT'`,[binding.referenceId]);
  if(!classInfo||!dashboardLevels.includes(classInfo.level)||!dashboardTeachingFormats.includes(classInfo.format)||
    (binding.kind==='appointment')!==(classInfo.format==='one-on-one'))
    throw Error('Teaching report must match a published or historical class, or a confirmed appointment');
  const cohortKey=createHash('sha256').update(binding.kind+':'+binding.referenceId).digest('hex');
  for(const {date,...day} of days){
    const stored:StoredTeachingDay={...binding,level:classInfo.level,format:classInfo.format,...day,extractedAt};
    await db.query(`INSERT INTO portal_settings(id,value) VALUES(:p1,:p2)
      ON DUPLICATE KEY UPDATE value=IF(value->>'$.extractedAt'<:p3,:p2,value)`,
    [prefix(environment,date)+cohortKey,stored,extractedAt]);
  }
}

type ReportRange={from:string;to:string;level:string;format:string;now:number};
type CohortAggregate={
  teaching:DashboardTeachingRow;costedLessons:number;teacherCost:number;revenue:number;directCost:number;
  revenueDays:number;directCostDays:number;
};
export async function readDashboardTeaching(db:Client,environment:Environment,range:ReportRange,finance:boolean){
  const {from,to,level,format,now}=range;
  if(from>to)return {teaching:null,economics:null};
  const dates=dashboardReportingDates(from,to,now);
  const after=dashboardDate(Date.parse(to+'T00:00:00+07:00')+dashboardDay);
  const {rows}=await db.query("SELECT IF(:p3=1,value,JSON_REMOVE(value,'$.finance')) AS value FROM portal_settings WHERE id>=:p1 AND id<:p2",
    [prefix(environment,from),prefix(environment,after),Number(finance)]);
  const cohorts=new Map<string,CohortAggregate>();
  let asOf:string|null=null;
  for(const {value} of rows){
    const day=(typeof value==='string'?JSON.parse(value):value) as StoredTeachingDay;
    if((level&&day.level!==level)||(format&&day.format!==format))continue;
    const {kind,referenceId}=day;
    const key=kind+':'+referenceId;
    const record=cohorts.get(key)??{
      teaching:{kind,referenceId,level:day.level,format:day.format,days:0,...blank()},
      costedLessons:0,teacherCost:0,revenue:0,directCost:0,revenueDays:0,directCostDays:0,
    };
    const metrics=record.teaching;
    metrics.days++;
    metrics.lessons+=day.lessons;
    metrics.minutes+=day.minutes;
    metrics.rosterLessons+=day.rosterLessons;
    metrics.expected+=day.expected;
    metrics.recorded+=day.recorded;
    metrics.present+=day.present;
    if(finance&&day.finance){
      const fact=day.finance;
      record.costedLessons+=fact.costedLessons;
      record.teacherCost+=fact.teacherCost??0;
      if(fact.revenue!==null){
        record.revenue+=fact.revenue;
        record.revenueDays++;
      }
      if(fact.directCost!==null&&fact.costedLessons===day.lessons){
        record.directCost+=fact.directCost;
        record.directCostDays++;
      }
    }
    if(!day.lessons){record.revenueDays++;record.directCostDays++;}
    if(!asOf||day.extractedAt<asOf)asOf=day.extractedAt;
    cohorts.set(key,record);
  }
  if(!asOf)return {teaching:null,economics:null};
  const header={from,to,expectedDays:dates.length,asOf};
  const sorted=[...cohorts.values()].sort((left,right)=>right.teaching.lessons-left.teaching.lessons||
    left.teaching.referenceId.localeCompare(right.teaching.referenceId));
  const teaching:DashboardTeaching={...header,cohorts:sorted.map(record=>record.teaching)};
  const economics:DashboardTeaching<DashboardEconomicsRow>|null=finance?{...header,cohorts:sorted.map(record=>{
    const hasRevenue=record.teaching.lessons>0&&record.revenueDays===dates.length;
    const hasDirectCost=record.teaching.lessons>0&&record.directCostDays===dates.length;
    return {...record.teaching,costedLessons:record.costedLessons,currency:record.costedLessons||hasRevenue||hasDirectCost?'IDR':null,
      teacherCost:record.costedLessons?record.teacherCost:null,revenue:hasRevenue?record.revenue:null,
      directCost:hasDirectCost?record.directCost:null,contribution:hasRevenue&&hasDirectCost?record.revenue-record.directCost:null};
  })}:null;
  return {teaching,economics};
}

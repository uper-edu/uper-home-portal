import assert from 'node:assert/strict';
import test from 'node:test';
import { demandMatches, enrollmentPhone, parseDemand, parseEnrollmentInterests, type Interests } from '../src/utils/enrollmentInterests';
import {enrollmentRecordClassLookup,sortEnrollmentRecords} from '../src/utils/enrollmentRecordOrder';
import {enrollmentInterestStillAvailable} from '../server/portal/enrollmentInterestDelivery';

test('enrollment history only loads matching class metadata when a preference is opened',()=>{
  const cohort=(id:string)=>({id,level:'HSK 1',firstLesson:'2027-01-09T09:00'});
  const saved:Interests['demands'][number]={
    id:'preference',revision:1,state:'active',
    criteria:{level:'HSK 1',period:'weekend',format:'standard',notes:'',phone:'081234567890'},
    matches:[cohort('matched-b'),cohort('matched-a'),cohort('matched-b')],
  };
  const interests:Interests={
    waitlist:[{...cohort('waitlist-entry'),classId:'waitlist-class',state:'waiting'}],
    demands:[saved,{...saved,id:'withdrawn',state:'withdrawn'}],
  };
  const orders=[{classId:'order-class'},{classId:'waitlist-class'}];
  assert.equal(enrollmentRecordClassLookup(orders,interests),'order-class,waitlist-class');
  assert.equal(enrollmentRecordClassLookup(undefined,interests,{kind:'waitlist',id:'waitlist-entry'}),'waitlist-class');
  assert.equal(enrollmentRecordClassLookup(undefined,interests,{kind:'demands',id:'preference'}),'matched-a,matched-b');
  assert.equal(enrollmentRecordClassLookup(undefined,interests,{kind:'demands',id:'withdrawn'}),'');
  assert.equal(enrollmentRecordClassLookup(undefined,interests,{kind:'demands',id:'missing'}),'');
});
test('retrying a saved waitlist entry after a seat opens confirms only the same learner',async()=>{
  await import('./helpers/mockPortalDatabase.mjs');
  const {mountEnrollmentInterests}=await import('../server/portal/enrollmentInterests');
  type Context = Parameters<typeof mountEnrollmentInterests>[1];
  type Handler = Parameters<Context['post']>[1];
  const routes=new Map<string,Handler>();
  const classId='hsk1-weekend',email='learner@example.test';
  let activeOrder=false;
  let verifiedEmail=email;
  const context:Context={
    wrap:()=>()=>{},
    post:(path,handler)=>{routes.set(path,handler);},
    session:async()=>verifiedEmail,
    lockClass:async(_,id)=>{
      assert.equal(id,classId);
      return {id,state:'published',accepting:1,course_active:1,data:{capacity:6}};
    },
    expireSeats:async()=>{},
    requireNewEnrollment:async()=>assert.fail('Recovery must not start a new waitlist entry'),
    transact:async callback=>callback({async query(sql,params){
      if(sql.startsWith('SELECT (SELECT COUNT(*)'))return {rows:[{count:5}]};
      assert.deepEqual(params,[classId,verifiedEmail]);
      if(sql.includes('FROM enrollment_waitlist w')){
        return {rows:verifiedEmail===email?[{id:'original-entry',learner_name:'Ayu Putri'}]:[]};
      }
      if(sql.includes('FROM enrollment_orders'))return {rows:activeOrder?[{data:{name:'Ayu Putri'}}]:[]};
      assert.fail('Unexpected query during recovery: '+sql);
    }}),
  };
  mountEnrollmentInterests({get:()=>{}} as never,context);
  const join=routes.get('/api/enrollment/waitlist')!;
  const retry=async(name:string)=>{
    let payload:unknown;
    await join({body:{classId,name,phone:'081234567890'}} as never,{
      set:()=>({json:(response:unknown)=>{payload=response;}}),
    } as never);
    return payload;
  };
  assert.deepEqual(await retry('ayu putri'),{id:'original-entry'});
  await assert.rejects(retry('Maya Putri'),/enrollment_seat_available/);
  verifiedEmail='someone-else@example.test';
  await assert.rejects(retry('Ayu Putri'),/enrollment_seat_available/);
  verifiedEmail=email;
  activeOrder=true;
  await assert.rejects(retry('Ayu Putri'),/enrollment_seat_available/);
});

test('queued availability mail checks current seats, vacancy round and demand preferences',async()=>{
  const recipient='learner@example.test',classId='hsk1-weekend',subject_id='interest-id';
  const cohort={data:{capacity:6,level:'HSK 1',period:'weekend',format:'small'},occupied:5};
  const mail={kind:'waitlist_vacancy',subject_id,payload:{classId}};
  const event='email:waitlist_vacancy:'+subject_id+':'+classId+':3';
  const waitlistClient=(occupied:number,waiting:boolean)=>({async query(sql:string,args?:unknown[]){
    if(sql.includes('FROM enrollment_classes'))return {rows:[{...cohort,occupied}]};
    assert.deepEqual(args,[subject_id,recipient,classId,'3']);
    return {rows:waiting?[{id:subject_id}]:[]};
  }});
  assert.equal(await enrollmentInterestStillAvailable(waitlistClient(5,true),event,recipient,mail),true);
  assert.equal(await enrollmentInterestStillAvailable(waitlistClient(6,true),event,recipient,mail),false);
  assert.equal(await enrollmentInterestStillAvailable(waitlistClient(5,false),event,recipient,mail),false);
  const demand={...mail,kind:'demand_match',payload:{}};
  const legacyEvent='email:demand_match:'+subject_id+':'+classId+':0';
  const demandClient=(period:string)=>({async query(sql:string){
    return {rows:sql.includes('FROM enrollment_classes')?[cohort]:[{criteria:{level:'HSK 1',period,format:'small'}}]};
  }});
  assert.equal(await enrollmentInterestStillAvailable(demandClient('any'),legacyEvent,recipient,demand),true);
  assert.equal(await enrollmentInterestStillAvailable(demandClient('weekday-evening'),legacyEvent,recipient,demand),false);
});

test('my enrollments reads the latest waitlist and preference events by owner and type',async()=>{
  await import('./helpers/mockPortalDatabase.mjs');
  const {mountEnrollmentInterests}=await import('../server/portal/enrollmentInterests');
  const {bindSql}=await import('../cloud/mysql/sql.mjs');
  type Context=Parameters<typeof mountEnrollmentInterests>[1];
  type Handler=Parameters<Context['post']>[1];
  const handlers=new Map<string,Handler>();
  const email='activity-learner@example.invalid',classId='fixture-class',id='shared-fixture-id';
  const first='2027-01-09T09:00';
  const older='2026-11-22T08:00:00.000001Z',newer='2026-11-22T08:00:00.000002Z';
  let activityReads=0,hasRecords=true;
  mountEnrollmentInterests({get:(path:string,handler:Handler)=>handlers.set(path,handler)} as never,{
    wrap:handler=>handler,post:()=>{},session:async()=>email,expireSeats:async()=>{},
    requireNewEnrollment:async()=>assert.fail('Reading history must not start a new enrollment'),
    lockClass:async(_,requested)=>({id:requested,state:'draft',accepting:1,course_active:1,data:{level:'HSK 1',firstLesson:first}}),
    transact:async callback=>callback({async query(sql,params){
      if(sql.startsWith('SELECT (SELECT COUNT(*)'))return {rows:[{count:0}]};
      assert.deepEqual(params,[email]);
      if(sql.includes('JOIN enrollment_interest_events')){
        activityReads++;
        const bound=bindSql(sql,params);
        assert.deepEqual(bound.parameters,[email,email]);
        assert.match(sql,/enrollment_waitlist w JOIN enrollment_interest_events e ON e.kind='vacancy' AND e.interest_id=w.id\s+WHERE w.email=:p1/);
        assert.match(sql,/enrollment_demands d JOIN enrollment_interest_events e ON e.kind='match' AND e.interest_id=d.id\s+WHERE d.email=:p1/);
        return {rows:[{kind:'vacancy',interest_id:id,updatedAt:older},{kind:'match',interest_id:id,updatedAt:newer}]};
      }
      if(sql.includes('FROM enrollment_waitlist'))return {rows:hasRecords?[{id,class_id:classId,state:'closed',updatedAt:older}]:[]};
      if(sql.includes('FROM enrollment_demands'))return {rows:hasRecords?[{id,state:'withdrawn',revision:1,criteria:{},updatedAt:older}]:[]};
      assert.fail('Unexpected history query: '+sql);
    }}),
  });
  const read=async()=>{
    let body!:Interests;
    await handlers.get('/api/enrollment/interests')!({headers:{cookie:'uper_enrollment_session='+'a'.repeat(64)}} as never,{
      set:()=>({json:(value:Interests)=>{body=value;}}),
    } as never);
    return body;
  };
  const records=await read();
  assert.equal(records.waitlist[0]?.updatedAt,older);
  assert.equal(records.demands[0]?.updatedAt,newer);
  assert.equal(activityReads,1);
  hasRecords=false;
  const blank=await read();
  assert.deepEqual([blank.waitlist,blank.demands],[[],[]]);
  assert.equal(activityReads,1);
});

test('other needs an explanation and stays for human review; any can match a published cohort', () => {
  const input = { level: 'HSK 4', period: 'any', format: 'small', notes: '', phone: '+628111234567' };
  const criteria = parseDemand(input);
  assert.ok(criteria);
  assert.equal(demandMatches(criteria, { level:'HSK 4A', period:'weekend', format:'small' }),true);
  assert.equal(demandMatches(criteria, { level:'HSK 4B', period:'weekday-evening', format:'standard' }),false);
  assert.equal(parseDemand({...input,period:'other',notes:'  '}),null);
  assert.equal(demandMatches(parseDemand({...input,period:'other',notes:'Sunday evening'})!,
    { level:'HSK 4A', period:'weekend', format:'small' }),false);
  assert.equal(parseDemand({...input,phone:'+123'}),null);
});
test('my enrollments ranks actionable records first, then interleaves all categories by update time',()=>{
  const records=[
    {key:'order-awaiting',needsAction:true,updatedAt:'2026-11-14T00:00:00.000001Z'},
    {key:'order-verified',needsAction:false,updatedAt:'2026-11-15T00:00:00.000001Z'},
    {key:'demand-match',needsAction:true,updatedAt:'2026-11-15T00:00:00.000002Z'},
    {key:'waitlist-full',needsAction:false,updatedAt:'2026-11-15T00:00:00.000002Z'},
    {key:'demand-older',needsAction:false},
  ];
  assert.deepEqual(sortEnrollmentRecords(records).map(row=>row.key),
    ['demand-match','order-awaiting','waitlist-full','order-verified','demand-older']);
  assert.equal(records[0].key,'order-awaiting');
});

test('enrollment intake uses the shared country numbering rules', () => {
  const invalidNumber = '+6280650713191';
  const validNumber = '0812-5071-3191';
  assert.equal(enrollmentPhone(invalidNumber), null);
  assert.equal(enrollmentPhone(' '+validNumber+' '), validNumber);
  assert.equal(parseDemand({level:'HSK 1',period:'any',format:'any',notes:'',phone:invalidNumber}), null);
});

test('interest reads reject malformed rows before rendering and accept nullable historical fields', () => {
  const match={id:'class-1',level:'HSK 1',firstLesson:'2027-01-04T19:00'};
  const waitlist={...match,id:'waitlist-1',classId:match.id,state:'closed',learnerName:null,orderId:null,updatedAt:null};
  const demand={id:'demand-1',revision:2,state:'active',updatedAt:null,matches:[match],
    criteria:{level:'HSK 1',period:'weekend',format:'small',notes:'',phone:'081234567890'}};
  assert.deepEqual(parseEnrollmentInterests({waitlist:[waitlist],demands:[demand]}),{waitlist:[waitlist],demands:[demand]});
  assert.deepEqual(parseEnrollmentInterests({waitlist:[],demands:[]}),{waitlist:[],demands:[]});
  for(const payload of [
    {waitlist:[null],demands:[]},
    {waitlist:[{...waitlist,state:'toString'}],demands:[]},
    {waitlist:[{...waitlist,firstLesson:null}],demands:[]},
    {waitlist:[{...waitlist,updatedAt:123}],demands:[]},
    {waitlist:[],demands:[{...demand,criteria:null}]},
    {waitlist:[],demands:[{...demand,matches:[null]}]},
  ]) assert.throws(()=>parseEnrollmentInterests(payload),/Invalid enrollment interests/);
});

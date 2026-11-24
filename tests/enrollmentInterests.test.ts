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

test('verified private lesson requests reuse one active record across independent submissions',async()=>{
  await import('./helpers/mockPortalDatabase.mjs');
  const {mountEnrollmentInterests}=await import('../server/portal/enrollmentInterests');
  type Context=Parameters<typeof mountEnrollmentInterests>[1];
  const handlers=new Map<string,Parameters<Context['post']>[1]>();
  const email='private-learner@example.invalid';
  const phone='+6281234567890';
  const lead={id:'fixture-lead',profile:{id:'fixture-lead',fullName:'Ayu Putri',email,whatsapp:phone}};
  const appointments:any[]=[];
  const receipts=new Map<string,any>();
  const attribution:unknown[][]=[];
  let verified=false;
  let unitPrice=350000;
  let activeLock=Promise.resolve();
  mountEnrollmentInterests({get:()=>{}} as never,{
    wrap:handler=>handler,post:(path,handler)=>{handlers.set(path,handler);},
    session:async()=>{
      if(!verified)throw Error('enrollment_verification_required');
      return email;
    },
    lockClass:async()=>assert.fail('Private requests do not acquire class seats'),
    expireSeats:async()=>assert.fail('Private requests do not release class seats'),
    requireNewEnrollment:async()=>assert.fail('Private requests do not start payable orders'),
    transact:async callback=>{
      let unlock:(()=>void)|undefined;
      try{
        return await callback({async query(sql,params=[]){
          if(sql.startsWith('SELECT GET_LOCK')&&String(params[0]).startsWith('enrollment-email:')){
            const previous=activeLock;
            activeLock=new Promise(resolve=>{unlock=resolve;});
            await previous;
            return {rows:[]};
          }
          if(sql.startsWith('SELECT GET_LOCK'))return {rows:[]};
          if(sql.includes('FROM crm_operations'))return {rows:receipts.has(String(params[1]))?[receipts.get(String(params[1]))]:[]};
          if(sql.includes('INSERT INTO crm_operations')){
            receipts.set(String(params[1]),{fingerprint:params[2],result:params[3]});
            return {rows:[]};
          }
          if(sql.includes('appointment.templateId')){
            assert.match(sql,/learnerKey.*AS BINARY.*LIMIT 1$/);
            assert.equal(params[0],email);
            return {rows:appointments.filter(row=>row.state==='active'&&
              row.criteria.appointment.templateId===params[1]&&row.criteria.appointment.learnerKey===params[2]).slice(0,1)};
          }
          if(sql.includes('state,criteria FROM enrollment_demands WHERE id=:p1 AND email=:p2')){
            assert.equal(params[1],email);
            return {rows:appointments.filter(row=>row.id===params[0])};
          }
          if(sql.includes('FROM portal_settings t JOIN crm_courses'))return {rows:[{
            template:{id:'private-1',teacherType:'local',saleUnitPrice:unitPrice,standardUnitPrice:400000},
            course:{name:'Fixture',sessions:23,active:true,teaching:{level:'HSK 1',minutes:45}},
          }]};
          if(sql.includes('INSERT INTO enrollment_demands')){
            appointments.push({id:params[0],revision:1,state:'active',criteria:params[2]});
            return {rows:[]};
          }
          if(sql.includes('INSERT INTO enrollment_record_attribution')){attribution.push(params);return {rows:[]};}
          if(sql.includes('SELECT id,profile FROM portal_leads'))return {rows:[lead]};
          if(sql.includes('INSERT INTO enrollment_opportunities')||sql.includes('INSERT INTO enrollment_customer_records')||
            sql.includes('FROM enrollment_customer_records')||sql.includes('FROM enrollment_opportunities'))return {rows:[]};
          assert.fail('Unexpected SQL: '+sql);
        }});
      }finally{unlock?.();}
    },
  });
  const request=async(id:string,source:string,forAnother=false)=>{
    let result:unknown;
    await handlers.get('/api/enrollment/demands')!({body:{id,source,revision:0,appointmentId:'private-1',forAnother,
      name:'Ayu Putri',criteria:{level:'HSK 1',period:'weekend',format:'one-on-one',notes:'',phone}}} as never,
      {set:()=>({json:(data:unknown)=>{result=data;}})} as never);
    return result;
  };
  const first='11111111-1111-4111-8111-111111111111';
  const second='22222222-2222-4222-8222-222222222222';
  await assert.rejects(request(first,'entry_point=website'),/verification_required/);
  assert.equal(appointments.length,0);
  verified=true;
  const [one,two]=await Promise.all([request(first,'entry_point=website&lang=id'),request(second,'entry_point=direct&lang=en')]);
  const quote={lessons:23,minutes:45,total:8050000};
  assert.deepEqual(one,{id:first,revision:1,reused:undefined,quote});
  assert.deepEqual(two,{id:first,revision:1,reused:true,quote});
  unitPrice=375000;
  assert.deepEqual(await request(second,'entry_point=direct'),two);
  delete receipts.get(second).result.quote;
  assert.deepEqual(await request(second,'entry_point=direct'),two);
  assert.deepEqual(await request('44444444-4444-4444-8444-444444444444','entry_point=website'),two);
  assert.equal(appointments.length,1);
  assert.equal(attribution.length,1);
  assert.equal((attribution[0][2] as {lang:string}).lang,'id');
  assert.equal(appointments[0].criteria.appointment.total,8050000);
  await request('33333333-3333-4333-8333-333333333333','entry_point=website',true);
  assert.equal(appointments.length,2);
  assert.equal(demandMatches(appointments[0].criteria,{level:'HSK 1',period:'weekend',format:'one-on-one'}),false);
  appointments[0].state='withdrawn';
  const replacement='55555555-5555-4555-8555-555555555555';
  assert.deepEqual(await request(replacement,'entry_point=website'),{
    id:replacement,revision:1,reused:undefined,quote:{...quote,total:8625000},
  });
  assert.equal(appointments.length,3);
});

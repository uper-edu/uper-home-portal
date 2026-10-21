import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID,scryptSync} from 'node:crypto';import sharp from 'sharp';
import {openTrialDatabase} from '../database.mjs';
import {collectionFor,projectContent} from '../content-query.mjs';
function client(){const cookies=new Map(),base='http://127.0.0.1:4412';return async(path,body,method=body===undefined?'GET':'POST',origin=base)=>{const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',Origin:origin,Cookie:[...cookies].map(([k,v])=>k+'='+v).join(';')},body:body===undefined?undefined:JSON.stringify(body)});for(const header of r.headers.getSetCookie()){const [k,v]=header.split(';')[0].split('=');cookies.set(k,v);}return {status:r.status,headers:r.headers,json:r.headers.get('content-type')?.includes('application/json')?await r.json():null,bytes:r.headers.get('content-type')?.includes('application/json')?null:Buffer.from(await r.arrayBuffer())};};}
test('content query types, ordering, limits and missing slug are explicit',()=>{
 assert.equal(collectionFor('*[_type == "newsPage"]'),'newsPage');assert.throws(()=>collectionFor('*[_type == "crm_users"]'));
 const items=[{_id:'a',order:2,slug:{current:'a'}},{_id:'b',order:1,slug:{current:'b'},isActive:false}];
 assert.equal(projectContent(items,'*[_type == "partner"] | order(order asc)[0...1]')[0]._id,'b');
 assert.equal(projectContent(items,'*[_type == "campaign" && slug.current == $slug][0]',{slug:'missing'}),null);
 assert.equal(projectContent(items,'*[_type == "partner" && isActive == true]').length,1);
});
test('MySQL CMS, publication, image, intake, application and permission acceptance',{skip:!process.env.MYSQL_SITE_TEST},async()=>{
 const leader=client(),sales=client(),anon=client(),visitor=client();
 assert.equal((await leader('/api/crm/auth/login',{loginId:'Robert',password:'Robert'})).status,200);
 for(const name of ['Suki','Tester','Zainul','Wigar']){const denied=client();assert.equal((await denied('/api/crm/auth/login',{loginId:name,password:name})).status,200);assert.equal((await denied('/api/cms/content/news')).status,403);}
 const fenny=client();const fennyLogin=await fenny('/api/crm/auth/login',{loginId:'Fenny',password:'Fenny'});assert.equal(fennyLogin.status,200);assert.ok(fennyLogin.json.employee.permissions.includes('cms.manage'));assert.equal((await fenny('/api/crm/leads')).status,403);assert.equal((await fenny('/api/crm/notification-rules')).status,403);assert.equal((await fenny('/api/cms/content/news')).status,200);
 assert.equal((await sales('/api/crm/auth/login',{loginId:'Fadhil',password:'Fadhil'})).status,200);
 assert.equal((await anon('/api/cms/content/news')).status,401);
 assert.equal((await sales('/api/cms/content/news')).status,403);
 assert.equal((await sales('/api/cms/content/news',{item:{title:'TEST forbidden'},requestId:randomUUID()})).status,403);
 assert.equal((await leader('/api/cms/content/news',{},'POST','https://untrusted.example')).status,403);
 assert.equal((await leader('/api/cms/content/secrets')).status,400);
 const types={partners:'partner',news:'news',newsPage:'newsPage',trendingPrograms:'trendingProgram',studentStories:'studentStory',campaigns:'campaign',admissionsList:'admissionsList'};
 for(const [collection,type] of Object.entries(types)){
  const body={requestId:randomUUID(),item:{title:'TEST '+collection,name:'TEST '+collection,slug:{current:randomUUID()},isActive:true,order:1}};
  const created=await leader('/api/cms/content/'+collection,body);assert.equal(created.status,200);assert.ok(created.json.item._id);
  const retries=await Promise.all(Array.from({length:10},()=>leader('/api/cms/content/'+collection,body)));assert.ok(retries.every(r=>r.status===200&&r.json.item._id===created.json.item._id));
  const content=await leader('/api/cms/content/'+collection);assert.equal(content.json.items.filter(x=>x._id===created.json.item._id).length,1);
  const publicContent=await anon('/api/content',{query:`*[_type == "${type}"]`});assert.equal(publicContent.status,200);assert.ok(publicContent.json.result.some(x=>x._id===created.json.item._id));
  const edit={requestId:randomUUID(),item:{...created.json.item,title:'TEST revised '+collection,isActive:false}};
  const changed=await leader('/api/cms/content/'+collection,edit);assert.equal(changed.status,200);
  assert.ok(!(await anon('/api/content',{query:`*[_type == "${type}"]`})).json.result.some(x=>x._id===created.json.item._id));
  assert.equal((await leader('/api/cms/content/'+collection,{requestId:randomUUID(),item:{...created.json.item,title:'TEST stale overwrite'}})).status,409);
  const removed=await leader('/api/cms/content/'+collection+'/'+created.json.item._id,{requestId:randomUUID(),itemVersion:changed.json.item._cmsVersion},'DELETE');assert.equal(removed.status,200);
  assert.ok(!(await anon('/api/content',{query:`*[_type == "${type}"]`})).json.result.some(x=>x._id===created.json.item._id));
 }
 const exactItem={title:'TEST exact decimals',hotspot:{height:0.9237762237762238,width:0.12345678901234567},original:'TEST exact content'};
 const exactBody={requestId:randomUUID(),item:exactItem};
 const exact=await leader('/api/cms/content/news',exactBody);assert.equal(exact.status,200);
 const exactRead=(await leader('/api/cms/content/news')).json.items.find(x=>x._id===exact.json.item._id);
 assert.deepEqual(exactRead.hotspot,exactItem.hotspot);
 const exactReplay=await leader('/api/cms/content/news',exactBody);assert.deepEqual(exactReplay.json,exact.json);
 const badType=await fetch('http://127.0.0.1:4412/api/inquiry',{method:'POST',headers:{'Content-Type':'text/plain'},body:'TEST invalid content type'});assert.equal(badType.status,415);
 const collection=await leader('/api/cms/content/news');const beforeCount=collection.json.count;
 assert.equal((await leader('/api/cms/content/news',{requestId:randomUUID(),revision:collection.json.revision,items:[{_id:'TEST duplicate'},{_id:'TEST duplicate'}]})).status,400);
 assert.equal((await leader('/api/cms/content/news')).json.count,beforeCount);
 assert.equal((await anon('/api/content',{query:'*[_type == "crm_users"]'})).status,400);
 const image=await sharp({create:{width:4,height:4,channels:3,background:'#009688'}}).png().toBuffer();
 const upload=await leader('/api/cms/upload',{name:'../../TEST.png',data:'data:image/png;base64,'+image.toString('base64')});assert.equal(upload.status,200);assert.match(upload.json.url,/^\/images\/uploads\/[a-f0-9]{64}\.webp$/);
 const imageRead=await anon(upload.json.url);assert.equal(imageRead.status,200);assert.equal(imageRead.headers.get('content-type'),'image/webp');assert.ok(imageRead.bytes.length>10);
 assert.equal((await sales('/api/cms/upload',{data:'data:image/png;base64,'+image.toString('base64')})).status,403);
 assert.equal((await leader('/api/cms/upload',{data:'data:image/svg+xml;base64,'+Buffer.from('<svg/>').toString('base64')})).status,400);
 const inquiry={requestId:randomUUID(),fullName:'TEST Site Inquiry',email:randomUUID()+'@example.invalid',phone:'+6281234567890',interest:'TEST Mandarin information',message:'  TEST exact original inquiry text\n'};
 const saved=await visitor('/api/inquiry',inquiry);assert.equal(saved.status,200);assert.equal(saved.json.saved,true);assert.equal(saved.json.emailSent,false);
 const repeats=await Promise.all(Array.from({length:10},()=>visitor('/api/inquiry',inquiry)));assert.ok(repeats.every(x=>x.status===200&&x.json.id===saved.json.id));
 const detail=await leader('/api/crm/leads/'+saved.json.leadId);assert.equal(detail.status,200);assert.equal(detail.json.chatTranscript.filter(m=>m.content===inquiry.message).length,1);assert.equal(detail.json.tasks.length,1);
 assert.equal((await anon('/api/inquiry',inquiry)).status,409);
 const application={requestId:randomUUID(),fullName:'TEST Applicant',email:randomUUID()+'@example.invalid',phone:'0000007772',roleId:'TEST Mandarin teacher',resumeFileName:'TEST.pdf',resumeFileBase64:Buffer.from('%PDF-1.4\nTEST synthetic attachment').toString('base64')};
 const apply=await visitor('/api/apply',application);assert.equal(apply.status,200);assert.equal(apply.json.emailSent,false);
 assert.equal((await visitor('/api/apply',application)).json.id,apply.json.id);
 assert.equal((await anon('/api/staff/submissions/'+apply.json.id+'/attachment')).status,401);
 assert.equal((await sales('/api/staff/submissions')).status,403);
 assert.equal((await leader('/api/staff/submissions/'+apply.json.id+'/attachment')).status,403);
 assert.equal((await fenny('/api/staff/submissions')).status,403);
 const seedDb=await openTrialDatabase(process.env),salt=randomUUID().replaceAll('-',''),passwordHash=salt+':'+scryptSync('TEST_HR',salt,64).toString('hex');
 try{await seedDb.execute('INSERT INTO crm_users(id,login_id,display_name,password_hash,roles,teams) VALUES(?,?,?,?,?,?) ON DUPLICATE KEY UPDATE id=id',['TEST_HR','TEST_HR','TEST HR Reader',passwordHash,JSON.stringify(['hr_reader']),'[]']);}finally{await seedDb.end();}
 const hr=client();assert.equal((await hr('/api/crm/auth/login',{loginId:'TEST_HR',password:'TEST_HR'})).status,200);
 assert.equal((await hr('/api/staff/submissions/'+apply.json.id+'/attachment')).bytes.toString(),'%PDF-1.4\nTEST synthetic attachment');
 assert.ok((await hr('/api/staff/submissions')).json.items.every(x=>x.kind==='application'));
 assert.ok((await leader('/api/staff/submissions')).json.items.every(x=>x.kind==='inquiry'));
 assert.equal((await anon('/api/health')).json.database,'mysql');const health=JSON.stringify((await anon('/api/health')).json);assert.ok(!health.includes('.env')&&!health.includes('password'));
 assert.equal((await anon('/api/ai-model-info')).status,200);
 assert.equal((await anon('/api/not-a-route')).status,404);
 assert.equal((await anon('/news')).status,200);
 assert.ok(!(await anon('/sitemap.xml')).bytes.toString().includes('/crm'));
 assert.equal((await leader('/api/crm/campaigns/ai-generate',{name:'TEST material',code:'TEST_material',keyTopics:['TEST factual topic']})).status,200);
 assert.equal((await sales('/api/crm/campaigns/ai-generate',{name:'TEST forbidden'})).status,403);
 const db=await openTrialDatabase(process.env);try{const [r]=await db.execute("SELECT COUNT(*) n FROM site_submissions WHERE request_id IN (?,?)",[inquiry.requestId,application.requestId]);assert.equal(Number(r[0].n),2);}finally{await db.end();}
 const faultDb=await openTrialDatabase(process.env),trigger='test_cms_'+randomUUID().replaceAll('-','');
 const faultKey='TEST_DB_FAIL_'+randomUUID();const baseline=(await leader('/api/cms/content/news')).json;
 try{
  await faultDb.query(`ALTER TABLE portal_audit ADD CONSTRAINT ${trigger} CHECK (NOT(action='cms.mutation' AND JSON_UNQUOTE(JSON_EXTRACT(data,'$.requestId'))='${faultKey}'))`);
  assert.equal((await leader('/api/cms/content/news',{requestId:faultKey,item:{title:'TEST must roll back'}})).status,503);
  const after=(await leader('/api/cms/content/news')).json;assert.equal(after.count,baseline.count);assert.equal(after.revision,baseline.revision);assert.deepEqual(after.items,baseline.items);
 }finally{await faultDb.query(`ALTER TABLE portal_audit DROP CHECK ${trigger}`);await faultDb.end();}
});

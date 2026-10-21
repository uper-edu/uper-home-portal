import {validContactPhone, CONTACT_PHONE_ERROR} from "../../src/utils/contactPhone.ts";
import {permittedRecord} from '../../src/utils/accessControl.ts';
import crypto from 'node:crypto';
import sharp from 'sharp';
import {transaction} from './database.mjs';
import {runtimeEnvironment} from '../../server/runtimeVersion.mjs';
import {collections,collectionFor,projectContent} from './content-query.mjs';
const id=()=>crypto.randomUUID();
const digest=value=>crypto.createHash('sha256').update(typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value)).digest('hex');
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
const requestKey=b=>{if(typeof b.requestId!=='string'||!b.requestId.trim()||b.requestId.length>100)fail(400,'Request ID required; refresh the page and retry');return b.requestId;};
const validCollection=name=>{if(!collections.includes(name))fail(400,'Invalid collection');return name;};
const text=(b,key,max,required=false)=>{const value=b[key]??'';if(typeof value!=='string'||value.length>max||(required&&!value.trim()))fail(400,'Invalid '+key);return value.trim();};
export async function mountSite(app,{db,platform,visitor,portalTx,leadTier,taskDeadline,runtimeVersion}){
  for(const name of collections)await db.execute('INSERT INTO cms_collections(name,items) VALUES(?,JSON_ARRAY()) ON DUPLICATE KEY UPDATE name=name',[name]);
  const wrap=fn=>(q,r,next)=>Promise.resolve(fn(q,r,next)).catch(e=>r.status(e.status||503).json({error:e.status&&e.status<500?e.message:'Storage unavailable; operation not saved'}));
  const staff=async q=>{const employee=await platform.authenticate(q);if(!employee)fail(401,'Login required');if(!employee.permissions.includes('cms.manage'))fail(403,'CMS management permission required');return employee;};
  const collection=async(name,c=db)=>{validCollection(name);const [rows]=await c.execute('SELECT items,items_text,revision FROM cms_collections WHERE name=?',[name]);const row=rows[0];return {...row,items:row.items_text===null?row.items:JSON.parse(row.items_text)};};
  app.use('/api/cms',wrap(async(q,r,next)=>{r.setHeader('Cache-Control','no-store');r.locals.cmsEmployee=await staff(q);if(!['GET','HEAD'].includes(q.method)&&(q.headers.origin!==`${q.protocol}://${q.get('host')}`||!q.is('application/json')))fail(403,'Origin or content type rejected');next();}));
  app.get('/api/cms/content/:type',wrap(async(q,r)=>{const row=await collection(q.params.type);r.json({success:true,items:row.items,count:row.items.length,revision:Number(row.revision)});}));
  const mutate=async(q,r,remove=false)=>{
    const name=validCollection(q.params.type),key=requestKey(q.body),actor=r.locals.cmsEmployee.id;
    const inputHash=digest({name,remove,id:q.params.id,body:q.body});
    const response=await transaction(db,async c=>{
      const [rows]=await c.execute('SELECT items,items_text,revision FROM cms_collections WHERE name=? FOR UPDATE',[name]);const row={...rows[0],items:rows[0].items_text===null?rows[0].items:JSON.parse(rows[0].items_text)};
      const [old]=await c.execute("SELECT data FROM portal_audit WHERE actor=? AND action='cms.mutation' AND data->>'$.requestId'=?",[actor,key]);
      if(old[0]){if(old[0].data.inputHash!==inputHash)fail(409,'Request ID conflict');return old[0].data.responseText?JSON.parse(old[0].data.responseText):old[0].data.response;}
      let items=row.items,saved;
      if(remove){const found=items.find(x=>(x._id||x.id)===q.params.id);if(!found)fail(404,'Content item not found');if(q.body.itemVersion!==found._cmsVersion)fail(409,'Content changed; reload before deleting');items=items.filter(x=>(x._id||x.id)!==q.params.id);}
      else if(q.body.items!==undefined){
        if(!Array.isArray(q.body.items)||q.body.items.length>500||q.body.items.some(x=>!x||typeof x!=='object'||Array.isArray(x))||Number(q.body.revision)!==Number(row.revision))fail(409,'Collection changed or invalid bulk input');
        items=q.body.items.map(x=>({...x,_id:x._id||x.id||id(),_cmsVersion:Number(row.revision)+1}));
        if(items.some(x=>typeof x._id!=='string'||x._id.length>191)||new Set(items.map(x=>x._id)).size!==items.length)fail(400,'Duplicate or invalid content ID');
      }else{
        const item=q.body.item;if(!item||typeof item!=='object'||Array.isArray(item)||JSON.stringify(item).length>1000000)fail(400,'Content item required');
        const itemId=item._id||item.id||id();if(typeof itemId!=='string'||itemId.length>191)fail(400,'Invalid content ID');
        const current=items.find(x=>(x._id||x.id)===itemId);
        if(current&&item._cmsVersion!==current._cmsVersion)fail(409,'Content changed; reload before saving');
        const at=new Date().toISOString();saved={...current,...item,_id:itemId,_createdAt:current?._createdAt||at,_updatedAt:at,_cmsVersion:(current?._cmsVersion||0)+1};
        items=current?items.map(x=>(x._id||x.id)===itemId?saved:x):[saved,...items];
      }
      if(JSON.stringify(items).length>10000000)fail(413,'Collection size limit exceeded');
      await c.execute('UPDATE cms_collections SET items=?,items_text=?,revision=revision+1,updated_at=UTC_TIMESTAMP(6) WHERE name=?',[JSON.stringify(items),JSON.stringify(items),name]);
      const response={success:true,...(saved?{item:saved}:{}),count:items.length,revision:Number(row.revision)+1};
      await c.execute("INSERT INTO portal_audit(actor,action,data) VALUES(?,'cms.mutation',?)",[actor,JSON.stringify({collection:name,requestId:key,inputHash,responseText:JSON.stringify(response)})]);
      return response;
    });r.json(response);
  };
  app.post('/api/cms/content/:type',wrap((q,r)=>mutate(q,r)));
  app.delete('/api/cms/content/:type/:id',wrap((q,r)=>mutate(q,r,true)));
  app.post('/api/cms/upload',wrap(async(q,r)=>{
    const source=q.body.data;
    if(typeof source!=='string'||source.length>3000000||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(source))fail(400,'Use PNG, JPEG or WebP up to 2 MB');
    const input=Buffer.from(source.split(',')[1],'base64');if(input.length>2097152)fail(413,'Image exceeds 2 MB');
    let content;try{content=await sharp(input,{limitInputPixels:16000000}).rotate().webp({quality:85}).toBuffer();}catch{fail(400,'Invalid image');}
    if(content.length>2097152)fail(413,'Image exceeds 2 MB');const hash=digest(content);
    await db.execute('INSERT INTO cms_media(id,mime,content,uploaded_by) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE id=id',[hash,'image/webp',content,r.locals.cmsEmployee.id]);
    r.json({success:true,url:'/images/uploads/'+hash+'.webp'});
  }));
  app.get('/images/uploads/:asset',wrap(async(q,r)=>{if(!/^[a-zA-Z0-9_.-]{1,191}$/.test(q.params.asset))fail(404,'Image not found');const hash=/^[a-f0-9]{64}\.webp$/.test(q.params.asset);const [rows]=await db.execute(hash?'SELECT mime,content FROM cms_media WHERE id=?':'SELECT mime,content FROM cms_media WHERE legacy_name=?',[hash?q.params.asset.slice(0,-5):q.params.asset]);if(!rows[0])fail(404,'Image not found');r.set({'Content-Type':rows[0].mime,'X-Content-Type-Options':'nosniff','Cache-Control':'public, max-age=31536000, immutable'}).send(rows[0].content);}));
  const queryContent=wrap(async(q,r)=>{const query=q.method==='POST'?q.body.query:q.query.query;let params=q.method==='POST'?q.body.params:q.query.params,name;try{if(typeof params==='string')params=JSON.parse(params);name=collectionFor(query);}catch(e){e.status=400;throw e;}const row=await collection(name);let result;try{result=projectContent(row.items.filter(item=>item.isActive!==false),query,params);}catch(e){e.status=400;throw e;}r.setHeader('Cache-Control','no-store');r.json({result});});
  for(const route of ['/api/content','/api/sanity']){app.get(route,queryContent);app.post(route,queryContent);}
  app.get('/api/health',wrap(async(_q,r)=>{await db.query("SELECT 1");r.setHeader('Cache-Control','no-store');r.json({status:'ok',database:'mysql',dataset:process.env.TRIAL_DATASET||'unknown',environment:runtimeEnvironment(),...(runtimeVersion?{version:runtimeVersion}:{})});}));
  app.get('/api/ai-model-info',(_q,r)=>r.json({success:true,activeModel:process.env.OPENAI_API_KEY?process.env.OPENAI_MODEL||'gpt-4o':'deepseek-chat',provider:process.env.OPENAI_API_KEY?'openai':'deepseek',hasOpenAiKey:!!process.env.OPENAI_API_KEY,hasDeepseekKey:!!process.env.DEEPSEEK_API_KEY}));
  app.post('/api/log',(_q,r)=>r.status(204).send()); // Never persist arbitrary browser payloads or credentials.
  app.get('/sitemap.xml',wrap(async(_q,r)=>{const base=(process.env.APP_URL||'http://127.0.0.1:4412').replace(/\/$/,'');const news=(await collection('news')).items.filter(x=>x.isActive!==false);const campaigns=(await collection('campaigns')).items.filter(x=>x.isActive!==false);const routes=['/','/contact','/careers','/news',...news.map(x=>'/news/'+encodeURIComponent(x.slug?.current||x.slug||x._id)),...campaigns.map(x=>'/campaign/'+encodeURIComponent(x.slug?.current||x.slug||x._id))];const escape=x=>x.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));r.type('application/xml').send('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+routes.map(route=>'<url><loc>'+escape(base+route)+'</loc></url>').join('')+'</urlset>');}));

  app.use(['/api/inquiry','/api/apply'],(q,r,next)=>{if(q.method==='POST'&&!q.is('application/json'))return r.status(415).json({error:'JSON request required'});next();});
  app.post('/api/inquiry',wrap(async(q,r)=>{
    if(!validContactPhone(q.body?.phone))fail(400,CONTACT_PHONE_ERROR);
    const b=q.body,key=requestKey(b),fullName=text(b,'fullName',100,true),email=text(b,'email',150,true).toLowerCase(),phone=text(b,'phone',40,true),interest=text(b,'interest',150,true),message=text(b,'message',5000);
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))fail(400,'Invalid email');
    const originalMessage=b.message??message;
    const v=await visitor(q,r),input={fullName,email,phone,interest,message:originalMessage},hash=digest(input);
    const result=await portalTx(async c=>{
      await c.query("SELECT GET_LOCK(:p1,5) AS acquired",['inquiry:'+key]);
      const previous=(await c.query("SELECT id,input_hash,visitor_id,lead_id FROM site_submissions WHERE kind='inquiry' AND request_id=:p1",[key])).rows[0];
      if(previous){if(previous.input_hash!==hash||previous.visitor_id!==v.id)fail(409,'Inquiry request conflict');return {id:previous.id,leadId:previous.lead_id};}
      const session=(await c.query("SELECT * FROM visitor_sessions WHERE id=:p1 FOR UPDATE",[v.id])).rows[0];const leadId=session.lead_id||id();
      const old=(await c.query("SELECT profile FROM portal_leads WHERE id=:p1 FOR UPDATE",[leadId])).rows[0]?.profile;
      const profile=old||{id:leadId,name:fullName,fullName,email,whatsapp:phone,team:'sales',owner:null,currentStage:'New',tier:'Unqualified',submittedAt:new Date().toISOString(),entryPoint:'contact_form',goal:interest};
      if(!old){profile.tier=leadTier(profile);await c.query("INSERT INTO portal_leads(id,profile) VALUES(:p1,:p2)",[leadId,profile]);await c.query("UPDATE visitor_sessions SET lead_id=:p1 WHERE id=:p2",[leadId,v.id]);}
      const conversationId=id(),submissionId=id();await c.query("INSERT INTO conversations(id,visitor_id,lead_id,source) VALUES(:p1,:p2,:p3,:p4)",[conversationId,v.id,leadId,'contact_form']);
      await c.query("INSERT INTO messages(id,conversation_id,request_id,role,content,status,metadata) VALUES(:p1,:p2,:p3,'user',:p4,'saved',:p5)",[id(),conversationId,key,originalMessage||interest,{submissionId,interest}]);
      const existingTask=(await c.query("SELECT id FROM followup_tasks WHERE lead_id=:p1 AND kind='consultation' AND status IN ('open','overdue') FOR UPDATE",[leadId])).rows[0];let taskId=existingTask?.id;
      if(!taskId){taskId=id();const settings=(await c.query("SELECT value FROM portal_settings WHERE id='sla'")).rows[0].value;const {due}=taskDeadline(profile,'consultation',settings);await c.query("INSERT INTO followup_tasks(id,lead_id,kind,owner_id,due_at,details) VALUES(:p1,:p2,'consultation',:p3,:p4,:p5)",[taskId,leadId,profile.owner||null,due,{source:'contact_form',submissionId}]);}
      await c.query("INSERT INTO site_submissions(id,kind,request_id,input_hash,visitor_id,lead_id,payload) VALUES(:p1,'inquiry',:p2,:p3,:p4,:p5,:p6)",[submissionId,key,hash,v.id,leadId,input]);
      await c.query("INSERT INTO outbox(id,type,lead_id,payload) VALUES(:p1,:p2,:p3,:p4)",[id(),old?'conversation.updated':'lead.created',leadId,{source:'contact_form',taskId,submissionId}]);
      return {id:submissionId,leadId};
    });r.json({success:true,saved:true,...result,emailSent:false});
  }));
  app.post('/api/apply',wrap(async(q,r)=>{
    const b=q.body,key=requestKey(b),payload={};for(const [field,max,required] of [['fullName',100,true],['email',150,true],['phone',50,true],['roleId',100,true],['roleTitle',150],['experience',1000],['resumeUrl',2000],['coverLetter',5000]])payload[field]=text(b,field,max,required);
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email))fail(400,'Invalid email');
    let attachment=null;if(b.resumeFileBase64){if(typeof b.resumeFileBase64!=='string'||b.resumeFileBase64.length>14000000)fail(413,'Resume exceeds 10 MB');attachment=Buffer.from(b.resumeFileBase64.replace(/^data:[^;]+;base64,/,''),'base64');if(attachment.length>10485760||!(attachment.subarray(0,5).toString()==='%PDF-'||attachment.subarray(0,2).toString()==='PK'||attachment.subarray(0,4).equals(Buffer.from([208,207,17,224]))))fail(400,'Use PDF or Word resume');}
    for(const field of ['experience','coverLetter'])if(b[field]!==undefined)payload[field]=b[field];
    const filename=text(b,'resumeFileName',150),hash=digest({payload,filename,attachmentHash:attachment?digest(attachment):null}),v=await visitor(q,r);
    const result=await transaction(db,async c=>{await c.execute('INSERT INTO site_submissions(id,kind,request_id,input_hash,visitor_id,payload,attachment,attachment_name) VALUES(?,\'application\',?,?,?,?,?,?) ON DUPLICATE KEY UPDATE id=id',[id(),key,hash,v.id,JSON.stringify(payload),attachment,filename]);const [rows]=await c.execute("SELECT id,input_hash,visitor_id FROM site_submissions WHERE kind='application' AND request_id=?",[key]);if(rows[0].input_hash!==hash||rows[0].visitor_id!==v.id)fail(409,'Application request conflict');return {id:rows[0].id};});r.json({success:true,saved:true,...result,emailSent:false});
  }));
  app.get('/api/staff/submissions',wrap(async(q,r)=>{const e=await platform.authenticate(q);if(!e)fail(401,'Login required');const inquiries=e.permissions.includes('crm.assign'),applications=e.permissions.includes('applications.read');if(!inquiries&&!applications)fail(403,'Submission access requires separate permission');const [rows]=await db.execute('SELECT id,kind,payload,lead_id,created_at,attachment IS NOT NULL has_attachment FROM site_submissions WHERE kind IN (?,?) ORDER BY created_at DESC LIMIT 200',[inquiries?'inquiry':'',applications?'application':'']);r.setHeader('Cache-Control','no-store');const [leads]=await db.execute('SELECT id,profile FROM portal_leads');const byId=new Map(leads.map(l=>[l.id,l.profile]));const visible=rows.filter(row=>row.kind==='application'||(byId.has(row.lead_id)?permittedRecord(e,byId.get(row.lead_id),'crm.read')&&permittedRecord(e,byId.get(row.lead_id),'crm.assign'):(e.grants?.['crm.read']||[e.scope]).includes('all')&&(e.grants?.['crm.assign']||[e.scope]).includes('all')));r.json({success:true,items:visible});}));
  app.get('/api/staff/submissions/:id/attachment',wrap(async(q,r)=>{const e=await platform.authenticate(q);if(!e)fail(401,'Login required');if(!e.permissions.includes('applications.read'))fail(403,'Recruitment access requires separate permission');const [rows]=await db.execute("SELECT attachment FROM site_submissions WHERE id=? AND kind='application'",[q.params.id]);if(!rows[0]?.attachment)fail(404,'Attachment not found');r.set({'Content-Type':'application/octet-stream','Content-Disposition':'attachment; filename="resume-download"','X-Content-Type-Options':'nosniff','Cache-Control':'no-store'}).send(rows[0].attachment);}));
}

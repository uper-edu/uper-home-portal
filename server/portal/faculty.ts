import {isDeepStrictEqual} from 'node:util';
import {facultyDateValid,facultyEffectiveDate,facultyFields,facultyFileLimits,facultyIdPattern,facultyLanguages,facultyName,
  type FacultyBio,type FacultyChoice,type FacultyFileKind,type FacultyProfile,type FacultyRateChange,type FacultyRates,type FacultyTerm} from '../../src/utils/crmFaculty.ts';
import {matchesEnrollmentProofSignature} from '../../src/utils/enrollmentProofFile.ts';
import {invalid} from './trustWorkflow.ts';

type Client={query:(sql:string,params:unknown[])=>Promise<{rows:any[]}>};
const key=(section:string,id:string)=>'faculty:'+section+':'+id;
const blankRates:FacultyRates={revision:0,terms:[],source:''};
const record=(raw:unknown)=>raw&&typeof raw==='object'&&!Array.isArray(raw)?raw as Record<string,unknown>:{};
const fileKinds=['photo','cv'] as const;
export const facultyError=(code='invalid',status=400):never=>invalid('faculty_'+code,status);
export const checkedFacultyId=(id:unknown)=>{
  if(typeof id!=='string'||!facultyIdPattern.test(id))return facultyError();
  return id;
};
const string=(value:unknown,max:number)=>{
  if(typeof value!=='string'||value.length>max)return facultyError();
  return value;
};
const integer=(value:unknown,min:number,max:number)=>{
  if(typeof value!=='number'||!Number.isSafeInteger(value)||value<min||value>max)return facultyError();
  return value;
};
function choice(profile:FacultyProfile):FacultyChoice{
  const {id,category,active,content}=profile;
  return {id,category,active,names:Object.fromEntries(facultyLanguages.map(lang=>[lang,content[lang]?.name]).filter(([,name])=>name))};
}
async function readValue<T>(db:Client,id:string,lock=false):Promise<T|undefined>{
  const sql=lock?'SELECT value FROM portal_settings WHERE id=:p1 FOR SHARE':'SELECT value FROM portal_settings WHERE id=:p1';
  return (await db.query(sql,[id])).rows[0]?.value;
}
export async function readFacultyProfile(db:Client,id:string,lock=false){
  return readValue<FacultyProfile>(db,key('profile',checkedFacultyId(id)),lock);
}
export async function listFacultyChoices(db:Client,includeInactive=false){
  const rows=(await db.query('SELECT value FROM portal_settings WHERE id LIKE :p1 ORDER BY id',['faculty:profile:%'])).rows;
  return rows.filter(({value})=>value.revision&&(includeInactive||value.active)).map(({value})=>choice(value));
}
export async function assignedFaculty(db:Client,id:unknown,category?:string){
  const profile=await readFacultyProfile(db,checkedFacultyId(id),true);
  if(!profile?.active||category&&profile.category!==category)return facultyError('unavailable',409);
  const selected=choice(profile);
  return {teacherId:selected.id,teacher:facultyName(selected.names,'en')};
}
export async function readFacultyRates(db:Client,id:string,lock=false){
  return await readValue<FacultyRates>(db,key('rate',checkedFacultyId(id)),lock)??blankRates;
}
export async function readFacultyRateDetails(db:Client,id:string){
  const rates=await readFacultyRates(db,id);
  const {rows}=await db.query('SELECT value FROM portal_settings WHERE id LIKE :p1 ORDER BY id',[key('rate-history',id)+':%']);
  return {...rates,history:rows.map(row=>row.value as FacultyRateChange).reverse()};
}

async function beginEdit<T extends {revision:number}>(db:Client,id:string){
  await db.query('INSERT INTO portal_settings(id,value) VALUES(:p1,:p2) ON DUPLICATE KEY UPDATE id=id',[id,{}]);
  const {rows:[row]}=await db.query('SELECT value FROM portal_settings WHERE id=:p1 FOR UPDATE',[id]);
  return row.value.revision?row.value as T:undefined;
}
async function persist(db:Client,id:string,value:unknown){
  await db.query('UPDATE portal_settings SET value=:p2 WHERE id=:p1',[id,value]);
}
async function audit(db:Client,actor:string,action:string,id:string,revision:number){
  await db.query('INSERT INTO portal_audit(actor,action,data) VALUES(:p1,:p2,:p3)',[actor,action,{teacherId:id,revision}]);
}

function validateFile(raw:unknown,kind:FacultyFileKind){
  const input=record(raw),name=string(input.name,180);
  if(!name.trim()||/[\u0000-\u001f/\\]/.test(name))return facultyError('file');
  const limit=facultyFileLimits[kind];
  const type=string(input.type,50),data=string(input.data,4*Math.ceil(limit/3));
  if(!['image/jpeg','image/png',...(kind==='cv'?['application/pdf']:[])].includes(type))return facultyError('file');
  const bytes=Buffer.from(data,'base64');
  if(bytes.toString('base64')!==data||bytes.length<16||bytes.length>limit||!matchesEnrollmentProofSignature(bytes,type))
    return facultyError('file');
  return {name,type,size:bytes.length,data};
}

export async function saveFacultyProfile(db:Client,id:string,input:unknown,actor:string){
  checkedFacultyId(id);
  const body=record(input),revision=integer(body.revision,0,Number.MAX_SAFE_INTEGER-1);
  if((body.category!=='local'&&body.category!=='foreign')||typeof body.active!=='boolean')return facultyError();
  const content:FacultyProfile['content']={};
  for(const lang of facultyLanguages){
    const incoming=record(record(body.content)[lang]),bio:FacultyBio={};
    for(const field of ['name',...Object.keys(facultyFields)] as (keyof FacultyBio)[]){
      if(Object.hasOwn(incoming,field))bio[field]=string(incoming[field],field==='name'?120:20_000);
    }
    if(Object.keys(bio).length)content[lang]=bio;
  }
  if(!facultyLanguages.some(lang=>content[lang]?.name?.trim()))return facultyError('name');
  const changes=record(body.files);
  const uploads=fileKinds.map(kind=>({kind,value:Object.hasOwn(changes,kind)?
    (changes[kind]===null?null:validateFile(changes[kind],kind)):undefined}));
  const idKey=key('profile',id),prior=await beginEdit<FacultyProfile>(db,idKey);
  const files={...prior?.files};
  const writes=[];
  for(const {kind,value} of uploads){
    if(value===undefined)continue;
    const fileKey=key(kind,id);
    if(value===null){
      if(files[kind]){delete files[kind];writes.push({fileKey,value:null});}
    }else{
      const stored=await readValue<typeof value>(db,fileKey);
      if(!isDeepStrictEqual(stored,value)){
        const {data,...meta}=value;
        files[kind]=meta;
        writes.push({fileKey,value:{...meta,data}});
      }
    }
  }
  const next:FacultyProfile={id,category:body.category,active:body.active,content,files,revision:revision+1};
  if(prior&&!writes.length&&isDeepStrictEqual(prior,{...next,revision:prior.revision}))return prior;
  if((prior?.revision??0)!==revision)return facultyError('conflict',409);
  for(const {fileKey,value} of writes){
    if(value===null)await db.query('DELETE FROM portal_settings WHERE id=:p1',[fileKey]);
    else await db.query('INSERT INTO portal_settings(id,value) VALUES(:p1,:p2) ON DUPLICATE KEY UPDATE value=:p2',[fileKey,value]);
  }
  await persist(db,idKey,next);
  await audit(db,actor,'faculty.profile.save',id,next.revision);
  return next;
}

export async function saveFacultyRates(db:Client,id:string,input:unknown,actor:string,actorName=actor){
  const body=record(input),revision=integer(body.revision,0,Number.MAX_SAFE_INTEGER-1);
  if(!await readFacultyProfile(db,id,true))return facultyError('not_found',404);
  if(!Array.isArray(body.terms)||body.terms.length>120)return facultyError();
  const terms=body.terms.map((raw):FacultyTerm=>{
    const term=record(raw),contractStart=string(term.contractStart,10);
    const pendingCurrency=term.kind==='monthly'&&term.amountMinor===null&&term.currency===null;
    if((contractStart!==''&&!facultyDateValid(contractStart))||(term.kind!=='lesson'&&term.kind!=='monthly')||
      (!pendingCurrency&&term.currency!=='CNY'&&term.currency!=='IDR'))return facultyError();
    const result:FacultyTerm={contractStart,monthsAfterStart:integer(term.monthsAfterStart,0,120),
      kind:term.kind,currency:pendingCurrency?null:term.currency as FacultyTerm['currency'],amountMinor:term.amountMinor===null&&term.kind==='monthly'?null:integer(term.amountMinor,1,1_000_000_000),
      note:string(term.note,4000)};
    if(contractStart&&!facultyDateValid(facultyEffectiveDate(result)))return facultyError();
    return result;
  }).sort((a,b)=>a.contractStart.localeCompare(b.contractStart)||a.monthsAfterStart-b.monthsAfterStart);
  for(const [index,entry] of terms.entries()){
    const previous=terms[index-1];
    if(previous?.contractStart===entry.contractStart?previous.monthsAfterStart===entry.monthsAfterStart:entry.monthsAfterStart!==0)
      return facultyError('rate_phases');
  }
  const idKey=key('rate',id);
  const prior=await beginEdit<FacultyRates>(db,idKey)??blankRates;
  const source=body.source===undefined?prior.source:string(body.source,12_000);
  const reason=body.reason===undefined?'':string(body.reason,500).trim();
  if(isDeepStrictEqual(prior.terms,terms)&&prior.source===source)return prior;
  if(prior.revision!==revision)return facultyError('conflict',409);
  const next={revision:revision+1,terms,source};
  await persist(db,idKey,next);
  const change:FacultyRateChange={revision:next.revision,actor:actorName,at:new Date().toISOString(),reason,before:prior.terms,after:next.terms};
  await db.query('INSERT INTO portal_settings(id,value) VALUES(:p1,:p2) ON DUPLICATE KEY UPDATE value=:p2',
    [key('rate-history',id)+':'+String(next.revision).padStart(16,'0'),change]);
  await audit(db,actor,'faculty.rate.save',id,next.revision);
  return next;
}

export async function readFacultyFile(db:Client,id:string,kind:FacultyFileKind){
  return readValue<{data:string;name:string;type:string}>(db,key(kind,checkedFacultyId(id)));
}

import type {Express,Request,Response} from 'express';
import {facultyEndpoint} from '../../src/utils/crmFaculty.ts';
import {permittedRecord} from '../../src/utils/accessControl.ts';
import {validMutationOrigin} from './accessTransport.ts';
import type {Employee} from './identity.ts';
import {tx} from './store.ts';
import {checkedFacultyId as checkedId,facultyError as error,listFacultyChoices,readFacultyFile,readFacultyProfile,readFacultyRateDetails,saveFacultyProfile,saveFacultyRates} from './faculty.ts';

export function mountFaculty(app:Express,{wrap,staff,authenticate}:{
  wrap:(fn:(q:Request,r:Response)=>Promise<unknown>)=>(q:Request,r:Response)=>void;
  staff:(q:Request,permission:string)=>Promise<Employee>;
  authenticate:(q:Request)=>Promise<Employee|null>;
}){
  const noStore=(r:Response)=>r.set('Cache-Control','private, no-store');
  const finance=(actor:Employee)=>permittedRecord(actor,{},'crm.read')&&permittedRecord(actor,{},'crm.payments.verify');
  const profileAccess=async(q:Request)=>{
    const actor=await authenticate(q);
    if(!actor)return error('forbidden',401);
    if(!actor.permissions.includes('crm.operations.manage')&&!finance(actor))return error('forbidden',403);
    return actor;
  };
  const write=(q:Request)=>{if(!validMutationOrigin(q))error('forbidden',403);};
  app.get(facultyEndpoint+'/choices',wrap(async(q,r)=>{
    const actor=await authenticate(q);
    if(!actor)return error('forbidden',401);
    if(!actor.permissions.some(p=>p==='crm.operations.manage'||p==='crm.followup'))return error('forbidden',403);
    noStore(r).json(await tx(c=>listFacultyChoices(c)));
  }));
  app.get(facultyEndpoint,wrap(async(q,r)=>{
    await profileAccess(q);
    noStore(r).json(await tx(c=>listFacultyChoices(c,true)));
  }));
  app.get(facultyEndpoint+'/:id',wrap(async(q,r)=>{
    const actor=await profileAccess(q),id=checkedId(q.params.id);
    const result=await tx(async c=>{
      const profile=await readFacultyProfile(c,id);
      if(!profile)return error('not_found',404);
      return {profile,rates:finance(actor)?await readFacultyRateDetails(c,id):undefined};
    });
    noStore(r).json(result);
  }));
  app.put(facultyEndpoint+'/:id',wrap(async(q,r)=>{
    write(q);
    const actor=await staff(q,'crm.operations.manage');
    noStore(r).json(await tx(c=>saveFacultyProfile(c,checkedId(q.params.id),q.body,actor.id)));
  }));
  app.put(facultyEndpoint+'/:id/rates',wrap(async(q,r)=>{
    write(q);
    const actor=await staff(q,'crm.payments.verify');
    if(!finance(actor))return error('forbidden',403);
    const id=checkedId(q.params.id);
    noStore(r).json(await tx(async c=>{
      await saveFacultyRates(c,id,q.body,actor.id,actor.displayName);
      return readFacultyRateDetails(c,id);
    }));
  }));
  app.get(facultyEndpoint+'/:id/files/:kind',wrap(async(q,r)=>{
    await profileAccess(q);
    const kind=q.params.kind;
    if(kind!=='photo'&&kind!=='cv')return error('not_found',404);
    const file=await tx(c=>readFacultyFile(c,checkedId(q.params.id),kind));
    if(!file)return error('not_found',404);
    if(kind==='cv')r.attachment(file.name);
    noStore(r).set('X-Content-Type-Options','nosniff').type(file.type);
    r.send(Buffer.from(file.data,'base64'));
  }));
}

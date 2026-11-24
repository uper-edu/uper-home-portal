import type {Express,Request,Response} from 'express';
import {randomUUID} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {log} from './logger.ts';

function enrollmentRoute(request: Pick<Request,'path'|'route'>) {
  if(!request.path.startsWith('/api/enrollment/')&&!request.path.startsWith('/api/crm/enrollment/'))return undefined;
  return typeof request.route?.path==='string'?request.route.path:'/api/:enrollment';
}

export function requestErrorContext(request: Pick<Request,'path'|'route'>, error: unknown) {
  const path=enrollmentRoute(request);
  if(!path)return {path:request.path,error};
  const code=(error as {code?:unknown} | null)?.code;
  const message=(error as {message?:unknown} | null)?.message;
  const errorCode=typeof code==='string'&&/^ER_[A-Z0-9_]+$/.test(code)?code:
    typeof message==='string'&&/^enrollment_[a-z_]+$/.test(message)?message:undefined;
  return {path,errorCode};
}

export async function measureEnrollmentPhase<T>(response:Response,phase:'transaction'|'mail_dispatch'|'proof_validation',work:()=>T|Promise<T>) {
  const started=performance.now();
  let outcome:'resolved'|'rejected'='rejected';
  try{
    const value=await work();
    outcome='resolved';
    return value;
  }
  finally{
    if(response.locals){
      const timings=response.locals.enrollmentTimings??={};
      const durationMs=Math.round(performance.now()-started);
      timings[phase]=(timings[phase]??0)+durationMs;
      if(response.destroyed&&!response.writableFinished&&response.locals.traceId)
        log.info('enrollment.phase_after_disconnect',{traceId:response.locals.traceId,phase,outcome,durationMs});
    }
  }
}
/**
 * Request tracing middleware: adopt a well-formed incoming X-Trace-Id (the nginx edge
 * overwrites client values with its own $request_id) or generate one, echo it on the
 * response, and log one access line per /api request — on finish, or on close when the
 * client aborts. X-Request-Id is deliberately not adopted: nothing trusted injects it.
 * The actor field appears only where crmEmployee is already resolved (campaign routes today).
 */
export function mountRequestTracing(app: Express) {
  app.use((q:any,r:any,next:any)=>{
    const incoming=String(q.headers['x-trace-id']||'');
    const traceId=/^[A-Za-z0-9_-]{8,64}$/.test(incoming)?incoming:randomUUID().replaceAll('-','').slice(0,16);
    r.locals.traceId=traceId;
    r.setHeader('X-Trace-Id',traceId);
    const started=performance.now();
    let logged=false;
    const access=(outcome:'finished'|'aborted')=>{
      const promotion=/^\/s\/[^/]+\/?$/.test(q.path);
      if(logged||!promotion&&!q.path.startsWith('/api'))return;
      logged=true;
      const enrollment=enrollmentRoute(q);
      log.info('http.request',{method:q.method,path:promotion?'/s/:code':enrollment??q.path,status:outcome==='finished'?r.statusCode:undefined,
        durationMs:Math.round(performance.now()-started),outcome,traceId,actor:enrollment?undefined:r.locals.crmEmployee?.id,
        ...(enrollment&&r.locals.enrollmentTimings ? {phases:r.locals.enrollmentTimings} : {})});
    };
    r.on('finish',()=>access('finished'));
    r.on('close',()=>access(r.writableFinished?'finished':'aborted'));
    next();
  });
}

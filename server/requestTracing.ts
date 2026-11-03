import type {Express} from 'express';
import {randomUUID} from 'node:crypto';
import {log} from './logger.ts';
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
    const started=Date.now();
    let logged=false;
    const access=()=>{
      if(logged||!q.path.startsWith('/api'))return;
      logged=true;
      log.info('http.request',{method:q.method,path:q.path,status:r.statusCode,durationMs:Date.now()-started,traceId,actor:r.locals.crmEmployee?.id});
    };
    r.on('finish',access);
    r.on('close',access);
    next();
  });
}

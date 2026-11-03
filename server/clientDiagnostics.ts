import type {Express} from 'express';
import {sanitizeClientDiagnostic,type ClientDiagnostic} from '../src/utils/clientDiagnostics';
import {log} from './logger.ts';
/** Bounded log output, independent of customer storage, auth, business events and notifications. */
export function mountClientDiagnostics(app: Express, write: (value: ClientDiagnostic)=>void = value=>log.warn('client.diagnostic',{...value})) {
  let windowStart=Date.now(),received=0;
  app.post('/api/client-diagnostics',(req,res)=>{
    if(Date.now()-windowStart>60000){windowStart=Date.now();received=0;}
    if(++received>20){res.status(429).end();return;}
    const diagnostic=sanitizeClientDiagnostic(req.body);
    if(!diagnostic){res.status(400).json({error:'Invalid diagnostic'});return;}
    write(diagnostic);res.status(204).end();
  });
}

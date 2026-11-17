import {parseArgs} from 'node:util';
import {register} from 'tsx/esm/api';
import {environmentName, loadPortalEnvironment} from '../server/environment.mjs';

const {values} = parseArgs({options:{
  environment:{type:'string'},
  'event-key':{type:'string',multiple:true},
  apply:{type:'boolean',default:false},
}});
const target = environmentName(values.environment);
const keys = values['event-key'];
if (!keys?.length || keys.some(key => !key.trim() || key.length > 160)) {
  throw Error('Specify at least one valid --event-key');
}
if (process.env.PORTAL_ENV && process.env.PORTAL_ENV !== target) {
  throw Error('The requested environment differs from PORTAL_ENV');
}
loadPortalEnvironment({target});
register();
const {pool} = await import('../server/portal/store.ts');
try {
  const {reconcileLegacyEnrollmentMail} = await import('../server/portal/enrollmentMail.ts');
  const result = await reconcileLegacyEnrollmentMail(keys, {preview:!values.apply});
  console.log(JSON.stringify({environment:target,mode:values.apply?'apply':'preview',...result},null,2));
} finally {
  await pool.end();
}

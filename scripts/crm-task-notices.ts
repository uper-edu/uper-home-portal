import {activateTaskNotifications} from '../server/portal/taskNotificationActivation.ts';
// Read the selected environment exactly as the application does. Default is a read-only plan.
if(process.argv[1]?.endsWith('crm-task-notices.ts')){
 const {loadPortalEnvironment}=await import('../server/environment.mjs');loadPortalEnvironment();
 const {pool,tx}=await import('../server/portal/store.ts');
 try{const apply=process.argv.includes('--apply');console.log(JSON.stringify(await tx(c=>activateTaskNotifications(c,'operator:task-notice-activation',apply))));}
 finally{await pool.end();}
}

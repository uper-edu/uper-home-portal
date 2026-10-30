import {projectPendingTasks} from './crmTaskPresentation';
/** A canonical customer response is a replacement, never a patch over the source identity. */
export function identityReviewedDetail(current:any,sourceId:string,data:any,employeeId:string){
 if(current?.id!==sourceId||!data.lead?.id)return current;
 return {...data.lead,attention:{isMine:data.lead.owner===employeeId,tasks:projectPendingTasks(data.tasks||[],data.lead.currentStage)}};
}

/** Never treat another customer or command's cached response as this save. */
export function confirmCrmOperation(data: any, leadId: string, kind: string) {
  if (data?.saved !== true || data.leadId !== leadId || data.operationKind !== kind)
    throw Error("Save response does not match this customer and action");
}

/** A stage receipt must identify both the customer and the requested new stage. */
export function confirmedStageLead(data:any,leadId:string,expectedStage:string|undefined){
  confirmCrmOperation(data,leadId,'stage');
  if(!expectedStage||data.lead?.id!==leadId||data.lead.currentStage!==expectedStage)
    throw Error('Save response does not match this customer and action');
  return data.lead;
}

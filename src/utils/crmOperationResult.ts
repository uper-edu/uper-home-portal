/** Never treat another customer or command's cached response as this save. */
export function confirmCrmOperation(data: any, leadId: string, kind: string) {
  if (data?.saved !== true || data.leadId !== leadId || data.operationKind !== kind)
    throw Error("Save response does not match this customer and action");
}

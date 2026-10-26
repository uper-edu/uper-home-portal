/** Preserve the saved operational choice while replacing the old inverse switch. */
export function ownerManagerOnly(config:any){
 return typeof config?.ownerAssignmentManagerOnly==='boolean'?config.ownerAssignmentManagerOnly:config?.selfClaimEnabled===false;
}

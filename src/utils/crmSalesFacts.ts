/** Stage observations are append-only statements, separate from the current-stage projection. */
export const salesStageOptions=['New','Contacted','Assessment Booked','Assessment Done','Trial Booked','Trial Attended','Enrolled','Lost'] as const;
export function observedStageFacts(body:any){if(body.stageObservations===undefined)return [];if(!Array.isArray(body.stageObservations)||body.stageObservations.length>8||body.stageObservations.some((v:any)=>!salesStageOptions.includes(v)))throw Error('请选择有效的阶段事实');return [...new Set<string>(body.stageObservations)];}

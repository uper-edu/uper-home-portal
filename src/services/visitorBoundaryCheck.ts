import type {VisitorSession} from './visitorScope';
export interface BoundaryState {ready:string;failed:boolean;checking:boolean}
/** Background rechecks retain a mounted visitor; scope changes always clear it. */
export function createBoundaryCheck(verify:()=>Promise<VisitorSession>,scope:()=>string,publish:(s:BoundaryState)=>void,hydrate:(s:VisitorSession)=>void){
 let state:BoundaryState={ready:'',failed:false,checking:true},generation=0,active=true;
 const update=(next:BoundaryState)=>{state=next;publish(next);};
 const check=()=>{
  const ticket=++generation;
  // Do not clear a previous failure until a successful check. No foreground flash on focus.
  if(!state.ready||state.ready!==scope())update({...state,checking:true});
  void verify().then(s=>{
   if(!active||ticket!==generation||scope()!==s.cacheScope)return;
   hydrate(s);update({ready:s.cacheScope,failed:false,checking:false});
  }).catch(()=>{if(active&&ticket===generation)update({...state,failed:true,checking:false});});
 };
 return {check,invalidate(){update({ready:'',failed:false,checking:true});check();},dispose(){active=false;generation++;}};
}

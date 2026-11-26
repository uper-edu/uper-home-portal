import type {VisitorSession} from './visitorScope';
export interface BoundaryState {ready:string;failed:boolean;checking:boolean}
/** Background rechecks retain a mounted visitor; scope changes always clear it. */
export function createBoundaryCheck(verify:()=>Promise<VisitorSession>,scope:()=>string,publish:(s:BoundaryState)=>void,hydrate:(s:VisitorSession)=>void){
  let state:BoundaryState={ready:'',failed:false,checking:true};
  let generation=0;
  let active=true;
  let inFlight=false;
  let reconnected=false;
  const update=(next:BoundaryState)=>{state=next;publish(next);};
  const supersede=()=>{
    generation++;
    inFlight=false;
    reconnected=false;
  };
  const check=()=>{
    if(!active||inFlight)return;
    const ticket=++generation;
    inFlight=true;
    reconnected=false;
    // Do not clear a previous failure until a successful check. No foreground flash on focus.
    if(!state.ready||state.ready!==scope())update({...state,checking:true});
    void verify().then(session=>{
      if(!active||ticket!==generation)return;
      if(scope()===session.cacheScope){
        hydrate(session);
        update({ready:session.cacheScope,failed:false,checking:false});
      }
      inFlight=false;
    }).catch(()=>{
      if(!active||ticket!==generation)return;
      inFlight=false;
      // An online event can arrive before the interrupted request rejects.
      if(reconnected){
        update({...state,checking:true});
        check();
        return;
      }
      update({...state,failed:true,checking:false});
    });
  };
  return {
    check,
    reconnect(){if(inFlight)reconnected=true;else check();},
    suspend(){supersede();update({...state,checking:true});},
    invalidate(){supersede();update({ready:'',failed:false,checking:true});check();},
    dispose(){active=false;supersede();},
  };
}

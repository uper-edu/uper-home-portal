/** One explicit user action: test the exact selection, then activate its server-issued check. */
export async function testAndSaveAi({call,selection,revision,requestId,onChecked,beforeActivate,current}:{call:(path:string,body:any)=>Promise<any>;selection:{primary:string;fallback:string};revision:number;requestId:string;onChecked:(check:any)=>void;beforeActivate:()=>void;current?:{primary:string;fallback:string}}){
 const check=await call('/test',{selection,revision});onChecked(check);
 if(!check.ok)return {saved:false,check};
 if(current&&JSON.stringify(current)===JSON.stringify(selection))return {saved:false,unchanged:true,check};
 beforeActivate();
 const result=await call('/activate',{revision,checkId:check.id,requestId});
 return {saved:true,check,result};
}

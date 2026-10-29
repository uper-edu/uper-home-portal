import {collections} from './content-query.mjs';
export async function cmsOperationResult(db,{actor,requestId,kind,collection}){
 if(typeof requestId!=='string'||!requestId.trim()||requestId.length>100||!['save','upload'].includes(kind)||(kind==='save'&&!collections.includes(collection)))throw Object.assign(Error('Invalid operation query'),{status:400});
 const [rows]=await db.execute("SELECT data FROM portal_audit WHERE actor=? AND action=? AND data->>'$.requestId'=? ORDER BY id DESC LIMIT 1",[actor,kind==='upload'?'cms.upload':'cms.mutation',requestId]);
 if(!rows[0]||(kind==='save'&&rows[0].data.collection!==collection))return {state:'not_found'};
 const data=rows[0].data,result=data.responseText?JSON.parse(data.responseText):data.response;
 return {state:'committed',result};
}
